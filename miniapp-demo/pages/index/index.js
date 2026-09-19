// pages/index/index.js - 首页：欢迎 + 广告词 + 扫码进入测评 + 演示地址
// 首页只负责"入口"：扫码解析测评ID / 点击演示 → 跳转 pages/survey/survey 承接问卷主体

const DEFAULT_BASE_URL = 'https://test.huaiyu.cn';
const storage = require('../../utils/storage.js');

const MY_PAGE_SIZE = 5;      // 我的测评每页条数
const SWIPE_DEL_W = 80;      // 滑动删除按钮宽度（px，与 wxss .my-del 一致）

Page({
  data: {
    baseUrl: DEFAULT_BASE_URL,
    // 我参与过的测评（本地 localStorage，后端无公开接口）
    myAll: [],          // 全量记录
    mySurveys: [],      // 当前页可见记录
    myPage: 0,          // 当前页码（0-based）
    myTotalPages: 1,    // 总页数
    offsets: {},        // { shortId: 滑动偏移px } 用于滑动删除
    // 演示测评列表：一点即跳转对应测评页
    demos: [
      { shortId: 'Lrq82h', title: '选举1' },
      { shortId: 'x41UMW', title: '选举2' },
      { shortId: 'VEb4hf', title: '演示1' },
      { shortId: 'tmjWKk', title: '演示2' }
    ]
  },

  onLoad() {
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.baseUrl) {
        this.setData({ baseUrl: app.globalData.baseUrl });
      }
    } catch (e) { console.warn(e); }
    this._loadMySurveys();
  },

  // 从测评页返回时刷新"我的测评"列表
  onShow() {
    this._loadMySurveys();
  },

  /** 读取本地"我的测评"记录，附 timeText 后分页展示 */
  _loadMySurveys() {
    const pad = n => (n < 10 ? '0' + n : '' + n);
    const all = storage.getMySurveys().map(x => {
      const d = x.time ? new Date(x.time) : null;
      const timeText = d
        ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
        : '';
      return Object.assign({}, x, { timeText });
    });
    this.setData({ myAll: all }, () => this._sliceMy());
  },

  /** 按当前页码从 myAll 切片出 mySurveys（每页 MY_PAGE_SIZE 条） */
  _sliceMy() {
    const all = this.data.myAll || [];
    const totalPages = Math.max(1, Math.ceil(all.length / MY_PAGE_SIZE));
    let page = this.data.myPage;
    if (page > totalPages - 1) page = totalPages - 1;
    if (page < 0) page = 0;
    this.setData({
      myPage: page,
      myTotalPages: totalPages,
      mySurveys: all.slice(page * MY_PAGE_SIZE, page * MY_PAGE_SIZE + MY_PAGE_SIZE),
      offsets: {}
    });
  },

  onMyPrev() {
    if (this.data.myPage > 0) {
      this.setData({ myPage: this.data.myPage - 1 });
      this._sliceMy();
    }
  },
  onMyNext() {
    if (this.data.myPage < this.data.myTotalPages - 1) {
      this.setData({ myPage: this.data.myPage + 1 });
      this._sliceMy();
    }
  },

  /* ---------- 滑动删除 ---------- */
  onSwipeStart(e) {
    const sid = e.currentTarget.dataset.shortid;
    this._swipeSid = sid;
    this._swipeStartX = e.touches[0].clientX;
    this._swipeStartY = e.touches[0].clientY;
    this._swipeStartOff = this.data.offsets[sid] || 0;
    this._swipeMoved = false;
  },
  onSwipeMove(e) {
    const sid = this._swipeSid;
    if (!sid) return;
    const t = e.touches[0];
    const dx = t.clientX - this._swipeStartX;
    const dy = t.clientY - this._swipeStartY;
    // 竖直为主 → 交给页面滚动，不横向滑动
    if (!this._swipeMoved && Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) > 8) this._swipeMoved = true;
    let off = this._swipeStartOff + dx;
    if (off > 0) off = 0;
    if (off < -SWIPE_DEL_W) off = -SWIPE_DEL_W;
    const offsets = Object.assign({}, this.data.offsets, { [sid]: off });
    this.setData({ offsets });
  },
  onSwipeEnd() {
    const sid = this._swipeSid;
    if (!sid) return;
    const off = this.data.offsets[sid] || 0;
    const open = off < -SWIPE_DEL_W / 2;
    const offsets = {};
    Object.keys(this.data.offsets).forEach(k => { offsets[k] = 0; });  // 只允许一条展开
    offsets[sid] = open ? -SWIPE_DEL_W : 0;
    this.setData({ offsets });
    this._swipeSid = null;
  },

  /** 删除某条记录（滑动后点删除按钮） */
  onMySurveyDel(e) {
    const sid = e.currentTarget.dataset.shortid;
    storage.removeMySurvey(sid);
    wx.showToast({ title: '已删除', icon: 'success' });
    this._loadMySurveys();
  },

  /** 点击"我的测评"某条 → 重新进入（滑动中/已展开删除时不跳转） */
  onMySurveyTap(e) {
    if (this._swipeMoved) { this._swipeMoved = false; return; }
    const sid = e.currentTarget.dataset.shortid;
    if ((this.data.offsets[sid] || 0) !== 0) {   // 已展开 → 先收起
      const offsets = Object.assign({}, this.data.offsets, { [sid]: 0 });
      this.setData({ offsets });
      return;
    }
    const { title } = e.currentTarget.dataset;
    this._gotoSurvey(sid, title);
  },

  /* ==========================================================
   * 扫码进入测评：扫描二维码 → 解析 URL 中的 /s/{shortId} → 跳转
   * ========================================================== */
  onScanEnter() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const raw = res.result || '';
        console.log('[scanCode] result =', raw);
        const shortId = this._parseShortId(raw);
        if (!shortId) {
          wx.showModal({
            title: '无法识别测评 ID',
            content: `二维码内容中未匹配到 /s/xxx 形式的测评地址：\n${raw}`,
            showCancel: false
          });
          return;
        }
        this._gotoSurvey(shortId);
      },
      fail: (err) => {
        console.error('[scanCode] fail', err);
        wx.showToast({ title: '扫码已取消或失败', icon: 'none' });
      }
    });
  },

  /* ==========================================================
   * 演示地址：点击某条演示 → 跳转测评页
   * ========================================================== */
  onDemoTap(e) {
    const { shortid, title } = e.currentTarget.dataset;
    this._gotoSurvey(shortid, title);
  },

  /**
   * 从扫码/链接文本中解析测评 ID
   * 例：http://XXXXX/s/VEb4hf  →  VEb4hf
   */
  _parseShortId(text) {
    if (!text) return '';
    // 匹配 http(s)://host/s/{shortId}，ID 到 ? # / 或串尾为止
    const m = text.match(/\/s\/([A-Za-z0-9_-]+)/);
    if (m && m[1]) return m[1];
    // 兜底：扫码内容本身就是一个短 ID
    const t = String(text).trim();
    if (/^[A-Za-z0-9_-]{4,12}$/.test(t)) return t;
    return '';
  },

  /** 跳转测评页，带上 shortId / baseUrl / title */
  _gotoSurvey(shortId, title) {
    const q = [
      `shortId=${encodeURIComponent(shortId)}`,
      `baseUrl=${encodeURIComponent(this.data.baseUrl)}`
    ];
    if (title) q.push(`title=${encodeURIComponent(title)}`);
    wx.navigateTo({ url: `/pages/survey/survey?${q.join('&')}` });
  }
});
