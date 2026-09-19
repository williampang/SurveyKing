// pages/index/index.js
// 单页版：一个大按钮 → 加载并渲染 VEb4hf 全部题型 → 就地校验 → 提交
const validator = require('../../utils/validator.js');
const storage = require('../../utils/storage.js');
const formula = require('../../utils/formula.js');

const DEFAULT_BASE_URL = 'https://test.huaiyu.cn';
const DEFAULT_SHORT_ID = 'VEb4hf';
// 腾讯位置服务 key（优先读 app.globalData.qqMapKey，此处为页面级兑底）
const DEFAULT_QQ_MAP_KEY = 'QZ4BZ-3BHW3-OQO3A-RIPED-2IHD3-J6F5H';
// 矩阵单选/多选展示样式配置：'chips' 胶囊样式（对齐手机浏览器 H5，默认）| 'table' 表格样式
// 页面参数 matrixStyle=table|chips 可覆盖本默认值
const DEFAULT_MATRIX_STYLE = 'chips';

Page({
  data: {
    baseUrl: DEFAULT_BASE_URL,
    shortId: DEFAULT_SHORT_ID,
    loading: false,
    submitting: false,
    status: '',
    statusType: 'info',
    error: '',
    project: null,
    questions: [],
    answers: {},          // { qid: value }
    errors: {},           // { qid: '错误消息' }
    answeredCount: 0,
    totalCount: 0,          // 需作答题数（不含 Remark 等展示型题型）
    progressPct: 0,
    startTime: 0,
    submitResult: null,
    submitResultText: '',
    lastSubmit: null,      // 上次提交信息 { time, timeText }，有则回填并提示
    headerImageUrl: '',
    sigHasStroke: {},   // { qid: true } 签名画布是否有笔迹
    sigCtxCache: {},    // { qid: canvasContext } 缓存签名上下文
    locLoading: {},     // { qid: true } 定位加载中
    qqMapKey: DEFAULT_QQ_MAP_KEY,   // 逆地址解析 key
    // 白名单登录字段（id=whitelistName）一键获取手机号
    hasWhitelistName: false,   // 本次测评是否包含白名单登录字段
    whitelistOnly: false,      // 是否只有这一个字段（true 则获取到手机号后自动提交）
    phoneLoading: false,       // 正在向后端换取手机号
    phoneTip: '',              // 手机号获取提示文案
    matrixStyle: DEFAULT_MATRIX_STYLE   // 矩阵单选/多选样式：chips 胶囊（默认）| table 表格
  },

  onLoad(options) {
    const opts = options || {};
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.baseUrl) {
        this.setData({ baseUrl: app.globalData.baseUrl });
      }
      if (app && app.globalData && app.globalData.qqMapKey) {
        this.setData({ qqMapKey: app.globalData.qqMapKey });
      }
    } catch (e) { console.warn(e); }
    // 首页跳转带入：shortId（测评ID）+ 可选 baseUrl / title
    if (opts.baseUrl) this.setData({ baseUrl: decodeURIComponent(opts.baseUrl) });
    if (opts.shortId) this.setData({ shortId: decodeURIComponent(opts.shortId) });
    if (opts.title) wx.setNavigationBarTitle({ title: decodeURIComponent(opts.title) });
    // 矩阵样式配置：页面参数 matrixStyle=table|chips，不传则用默认胶囊样式
    if (opts.matrixStyle === 'table' || opts.matrixStyle === 'chips') this.setData({ matrixStyle: opts.matrixStyle });
    // 进入测评页即自动加载问卷（无需再点大按钮）
    this.loadAndShow();
  },

  setStatus(msg, type = 'info') {
    this.setData({ status: msg, statusType: type });
  },

  /* ==========================================================
   * 加载问卷
   * ========================================================== */
  loadAndShow() {
    const { baseUrl, shortId } = this.data;
    this.setData({
      loading: true, error: '', project: null, questions: [],
      answers: {}, errors: {}, answeredCount: 0, totalCount: 0, progressPct: 0,
      submitResult: null, submitResultText: ''
    });
    this._whitelistName = '';   // 重置白名单手机号
    this.setStatus('正在加载问卷...', 'info');

    wx.request({
      url: `${baseUrl}/api/public/loadProject`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { id: shortId },
      timeout: 20000,
      success: (res) => {
        if (res.statusCode !== 200) {
          this.setData({ error: `HTTP ${res.statusCode}\n${JSON.stringify(res.data, null, 2)}` });
          this.setStatus('加载失败', 'err'); return;
        }
        const body = res.data || {};
        if (body.code !== undefined && body.code !== 200) {
          this.setData({ error: `业务错误 code=${body.code}\n${body.message || ''}` });
          this.setStatus('加载失败', 'err'); return;
        }
        this._applyProject(body.data || body);
      },
      fail: (err) => {
        this.setData({
          error: `请求失败：${err.errMsg}\n\n排查：\n1. 详情→本地设置→勾选"不校验合法域名"\n2. curl ${baseUrl}/api/system 是否可访问\n3. 检查网络`
        });
        this.setStatus('加载失败', 'err');
      },
      complete: () => this.setData({ loading: false })
    });
  },

  /**
   * 把 loadProject / validateProject 返回的 PublicProjectView 应用到页面状态。
   * 两个接口返回结构完全一致，因此提取为公用方法：
   *   - loadProject：需登录时仅返回登录表单（whitelistName 单题）
   *   - validateProject：白名单校验通过后返回真实问卷
   */
  _applyProject(project) {
    if (!project) { this.setData({ error: '后端返回空数据' }); return; }
    const children = (project.survey && project.survey.children) || [];
    if (!children.length) {
      this.setData({ error: '问卷没有题目' }); this.setStatus('加载失败', 'err'); return;
    }
    // 展示型题型（Remark 文字描述等）不占序号，避免隐藏其序号后后续题号断档
    const VOID_TYPES = ['Remark', 'SplitLine', 'Section', 'Pagination', 'QuestionSet', 'RandomSurvey'];
    let qNo = 0;
    children.forEach(q => { q.qNo = VOID_TYPES.indexOf(q.type) >= 0 ? 0 : ++qNo; });
    const totalCount = qNo;   // 循环结束后 qNo 即需作答的题数（Remark 等不计入）
    const { baseUrl, shortId } = this.data;

    // 初始化复合题型的默认答案结构
    const initAnswers = {};
    children.forEach(q => {
      initAnswers[q.id] = this.buildInitAnswer(q);
    });

    // 回填上次提交结果（本地记录；后端无公开的"取回自己答案"接口）
    let answers = initAnswers;
    let lastSubmit = null;
    const rec = storage.getMySurvey(shortId);
    if (rec && rec.answers && typeof rec.answers === 'object') {
      answers = Object.assign({}, initAnswers);
      children.forEach(q => {
        if (rec.answers[q.id] !== undefined && rec.answers[q.id] !== null) {
          answers[q.id] = rec.answers[q.id];
        }
      });
      const d = rec.time ? new Date(rec.time) : null;
      const pad = n => (n < 10 ? '0' + n : '' + n);
      lastSubmit = {
        time: rec.time || 0,
        timeText: d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` : ''
      };
    }
    this._initAnswers = initAnswers;   // 供"清空重填"恢复

    // 已答/进度统计（含回填场景），分母只用需作答的题数
    let answeredCount = 0;
    children.forEach(q => { if (!validator.isEmpty(answers[q.id])) answeredCount++; });
    const progressPct = totalCount ? Math.round(answeredCount / totalCount * 100) : 0;

    // 顶部图片
    const headerImg = project.survey && project.survey.attribute && project.survey.attribute.headerImage;
    const headerImageUrl = headerImg ? `${baseUrl}/api/public/preview/${headerImg}` : '';

    // 检测白名单登录字段（后端 whitelistType=4 时会注入 id=whitelistName 的 FillBlank）
    const hasWhitelistName = children.some(q => q.id === 'whitelistName');
    const whitelistOnly = hasWhitelistName && children.length === 1;

    // 白名单登录表单模式：优先从本地缓存拿已校验手机号，命中则自动走 validateProject 拉真实问卷
    const cachedPhone = whitelistOnly ? storage.getWhitelistCache(shortId) : '';
    if (cachedPhone) {
      initAnswers['whitelistName'] = cachedPhone;
      answers['whitelistName'] = cachedPhone;
    }

    this.setData({
      project, questions: children, answers, totalCount,
      startTime: Date.now(), headerImageUrl, lastSubmit,
      errors: {}, answeredCount, progressPct,
      submitResult: null, submitResultText: '',
      hasWhitelistName, whitelistOnly,
      phoneTip: hasWhitelistName
        ? (cachedPhone
            ? `🔄 检测到已缓存手机号 ${cachedPhone}，正在自动校验名单...`
            : '👆 点击上方按钮授权手机号，自动校验名单并加载真实问卷')
        : (this._whitelistName ? `✅ 名单已校验：${this._whitelistName}` : '')
    }, () => {
      // canvas 2d 的 node 必须在渲染完成后才能拿到，这里初始化签名画布
      this._initAllSigCanvas();
      // 命中缓存 → 直接调 validateProject，跳过手机号授权步骤
      if (cachedPhone) {
        // 放到下一个 tick，避免与 setData 回调中的初始化竞争
        setTimeout(() => this._validateWhitelist(cachedPhone, { fromCache: true }), 50);
      }
    });
    const label = hasWhitelistName ? '需先校验名单' : `共 ${totalCount} 题`;
    // 标题可能是富文本 HTML，状态栏只展示纯文本
    const plainTitle = ((project.survey && project.survey.title) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    this.setStatus(`✅ 加载成功：${project.name || plainTitle} · ${label}`, 'ok');

    // 运行公式计算与可见性联动（处理初始默认状态）
    this._evaluateRulesAndFormulas(answers);
  },

  /**
   * 根据题型构造初始 answer 值
   */
  buildInitAnswer(q) {
    switch (q.type) {
      case 'Checkbox': return [];
      case 'HorzBlank':
      case 'MultipleBlank': {
        const o = {};
        (q.children || []).forEach(c => { o[c.id] = ''; });
        return o;
      }
      case 'Cascader':
        return { path: [], labels: [] };
      case 'MatrixRadio':
      case 'MatrixFillBlank': {
        const o = {};
        (q.row || []).forEach(r => { o[r.id] = q.type === 'MatrixFillBlank' ? {} : ''; });
        return o;
      }
      case 'MatrixCheckbox': {
        const o = {};
        (q.row || []).forEach(r => { o[r.id] = []; });
        return o;
      }
      case 'MatrixAuto':
        return [this.buildEmptyAutoRow(q)];
      default:
        return '';
    }
  },

  buildEmptyAutoRow(q) {
    const row = {};
    (q.children || []).forEach(c => { row[c.id] = ''; });
    return row;
  },

  /* ==========================================================
   * 通用：设置答案 + 触发校验 + 更新进度 + 公式/可见性联动
   * ========================================================== */
  setAnswer(qid, value, skipValidate = false) {
    const answers = Object.assign({}, this.data.answers);
    answers[qid] = value;
    const errors = Object.assign({}, this.data.errors);

    // 统计已答数量
    let count = 0;
    this.data.questions.forEach(q => {
      if (!validator.isEmpty(answers[q.id])) count++;
    });
    const progressPct = Math.round(count / (this.data.totalCount || this.data.questions.length) * 100);
    this.setData({ answers, answeredCount: count, progressPct });

    // 触发公式与可见性计算及动态规则校验
    this._evaluateRulesAndFormulas(answers, skipValidate ? null : qid);
  },

  /**
   * 运行公式计算与可见性联动
   * 1. 根据当前 answers 构造 Q1, Q1A1 等变量上下文
   * 2. 计算每道题的 visibleRule，更新题目的 hidden/visible 状态
   * 3. 计算富文本题目（如 Remark）中包含的 ql-formula 公式并替换展示
   * 4. 实时执行 validateRule 规则检查并更新 errors
   * @param {Object} [currentAnswers] - 当前全部答案字典
   * @param {string} [changedQid] - 本次发生修改的题目 ID（若有传则重点实时更新其校验提示）
   */
  _evaluateRulesAndFormulas(currentAnswers, changedQid) {
    const questions = this.data.questions;
    if (!questions || !questions.length) return;

    const answers = currentAnswers || this.data.answers || {};
    const ctx = formula.buildVariableContext(questions, answers);
    let questionsChanged = false;
    const updatedQuestions = questions.map(q => {
      let qCopy = Object.assign({}, q);
      const attr = qCopy.attribute || {};

      // 1. visibleRule 计算
      if (attr.visibleRule) {
        const isVisible = formula.evaluateVisibleRule(attr.visibleRule, ctx);
        const newDisplay = isVisible ? 'visible' : 'hidden';
        if (qCopy._display !== newDisplay) {
          qCopy._display = newDisplay;
          questionsChanged = true;
        }
      } else if (attr.display === 'hidden') {
        // 如果题目原生配置了 display=hidden 且无 visibleRule
        if (qCopy._display !== 'hidden') {
          qCopy._display = 'hidden';
          questionsChanged = true;
        }
      } else {
        if (qCopy._display !== 'visible') {
          qCopy._display = 'visible';
          questionsChanged = true;
        }
      }

      // 2. 富文本公式动态渲染（如 Remark 里的 SUM(Q1~Q11)）
      const rawTitle = qCopy._rawTitle || qCopy.title || '';
      if (rawTitle.includes('ql-formula')) {
        if (!qCopy._rawTitle) qCopy._rawTitle = qCopy.title;
        const renderedTitle = formula.renderFormulaHtml(qCopy._rawTitle, ctx);
        if (qCopy.title !== renderedTitle) {
          qCopy.title = renderedTitle;
          questionsChanged = true;
        }
      }

      return qCopy;
    });

    // 3. 实时更新各题校验错误（特别是配置了 validateRule 的题目，如 Q1 限制）
    const errors = Object.assign({}, this.data.errors);
    questions.forEach(q => {
      const attr = q.attribute || {};
      const val = answers[q.id];

      // 若处于隐藏状态，清除可能残留的错误
      if (q._display === 'hidden') {
        delete errors[q.id];
        return;
      }

      // 若题目配置了 validateRule，不论是当前改动题还是受联动影响的题均重新执行验证
      if (attr.validateRule) {
        const ruleRes = formula.evaluateValidateRule(attr.validateRule, ctx);
        if (!ruleRes.valid) {
          errors[q.id] = ruleRes.message || '输入内容不符合限制规则';
        } else {
          // 如果该题没有其他基础类型错误，则清除 validateRule 错误
          const baseErr = validator.validateQuestion(q, val);
          if (baseErr) errors[q.id] = baseErr;
          else delete errors[q.id];
        }
      } else if (changedQid === q.id) {
        // 无 validateRule 的题按常规方式校验
        const err = validator.validateQuestion(q, val);
        if (err) errors[q.id] = err;
        else delete errors[q.id];
      }
    });

    const setDataObj = { errors };
    if (questionsChanged) {
      setDataObj.questions = updatedQuestions;
    }
    this.setData(setDataObj);
  },

  /* ==========================================================
   * 事件处理：基础题型
   * ========================================================== */
  onRadioChange(e)    { this.setAnswer(e.currentTarget.dataset.qid, e.detail.value); },
  onCheckboxChange(e) { this.setAnswer(e.currentTarget.dataset.qid, e.detail.value); },
    /** Radio 胶囊点击（adm-selector 风格）*/
    onRadioTap(e) {
      const { qid, val } = e.currentTarget.dataset;
      // 再次点击已选中的项，取消选择（如果非必填）
      if (this.data.answers[qid] === val) {
        const q = this.data.questions.find(x => x.id === qid);
        if (q && q.attribute && q.attribute.required) return; // 必填不允许取消
        this.setAnswer(qid, '');
      } else {
        this.setAnswer(qid, val);
      }
    },
    /** Checkbox 胶囊点击（adm-selector multiple 风格）*/
    onCheckboxTap(e) {
      const { qid, val } = e.currentTarget.dataset;
      const q = this.data.questions.find(x => x.id === qid);
      const cur = (this.data.answers[qid] || []).slice();
      const idx = cur.indexOf(val);
      if (idx >= 0) {
        cur.splice(idx, 1);
      } else {
        // 检查最大选择数限制
        const max = q && q.attribute && (q.attribute.maxNum || q.attribute.max);
        if (max && cur.length >= max) {
          wx.showToast({ title: `最多选 ${max} 项`, icon: 'none' });
          return;
        }
        cur.push(val);
      }
      this.setAnswer(qid, cur);
    },
  onTextInput(e)      { this.setAnswer(e.currentTarget.dataset.qid, e.detail.value); },
  onScoreTap(e) {
    const { qid, val } = e.currentTarget.dataset;
    this.setAnswer(qid, Number(val));
  },
  onSelectChange(e) {
    const qid = e.currentTarget.dataset.qid;
    const idx = Number(e.detail.value);
    const q = this.data.questions.find(x => x.id === qid);
    if (q && q.children && q.children[idx]) this.setAnswer(qid, q.children[idx].id);
  },
  onDatePick(e) { this.setAnswer(e.currentTarget.dataset.qid, e.detail.value); },
  onTimePick(e) {
    const qid = e.currentTarget.dataset.qid;
    const val = e.detail.value;   // picker mode=time 只返回 HH:mm
    const q = this.data.questions.find(x => x.id === qid);
    const a = (q && q.children && q.children[0] && q.children[0].attribute) || {};
    // dateTimeFormat 为 HH:mm:ss 时补齐秒，保证提交值与格式一致
    this.setAnswer(qid, (a.dateTimeFormat === 'HH:mm:ss' && /^\d{2}:\d{2}$/.test(val)) ? val + ':00' : val);
  },

  /* ==========================================================
   * 白名单登录字段（id=whitelistName）：一键获取微信手机号
   *
   * 微信官方限制：手机号必须由用户主动点击 <button open-type="getPhoneNumber">
   * 才能授权，无法在小程序里程序化获取。
   * 授权回调 e.detail 里：
   *   - 新版返回 code（动态令牌，5 分钟有效），需要后端调
   *     https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=xxx
   *     才能换到真实手机号
   *   - 旧版返回 encryptedData + iv，需要后端用 wx.login 换来的 session_key 解密
   *
   * 拿到手机号后的完整链路：
   *   1. 回填到 whitelistName 输入框
   *   2. POST /api/public/validateProject 校验名单
   *      payload: { id, answer: { whitelistName: { whitelistName: phone } } }
   *   3. 后端校验通过会直接返回真实问卷（PublicProjectView）
   *   4. 本地 _applyProject 重新渲染，进入正常答卷流程
   * ========================================================== */
  onGetPhoneNumber(e) {
    const qid = e.currentTarget.dataset.qid || 'whitelistName';
    const detail = e.detail || {};
    console.log('[getPhoneNumber] detail =', detail);

    // 用户拒绝或调用失败
    if (detail.errMsg && detail.errMsg.indexOf(':ok') === -1) {
      this.setData({ phoneTip: '❌ 未授权手机号：' + detail.errMsg + '（可手动输入名单后点“校验名单”）' });
      wx.showToast({ title: '未授权手机号', icon: 'none' });
      return;
    }
    if (!detail.code && !detail.encryptedData) {
      this.setData({ phoneTip: '❌ 微信未返回手机号凭证（开发者工具需真机预览测试）' });
      return;
    }

    this.setData({ phoneLoading: true, phoneTip: '⏳ 正在换取手机号...' });

    // 先 wx.login 拿登录 code，后端用其换 access_token / session_key
    wx.login({
      success: (loginRes) => {
        const payload = {
          code: detail.code || '',
          encryptedData: detail.encryptedData || '',
          iv: detail.iv || '',
          loginCode: (loginRes && loginRes.code) || ''
        };
        wx.request({
          url: `${this.data.baseUrl}/api/public/wechat/getPhoneNumber`,
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: payload,
          timeout: 15000,
          success: (res) => {
            console.log('[getPhoneNumber] backend =', res);
            const body = (res && res.data) || {};
            const data = body.data || body;
            const phone = data.phone || data.phoneNumber || data.purePhoneNumber || '';
            if (res.statusCode !== 200 || (body.code !== undefined && body.code !== 200) || !phone) {
              this.setData({
                phoneTip: `❌ 后端换取手机号失败：${body.message || JSON.stringify(body).slice(0, 120)}\n（需实现 POST /api/public/wechat/getPhoneNumber，可先手动输入名单后点“校验名单”）`
              });
              wx.showToast({ title: '换取手机号失败', icon: 'none' });
              return;
            }
            this.setData({ phoneTip: `✅ 已获取手机号：${phone}，正在校验名单...` });
            // 先本地回填 UI，再调 validateProject 拉取真实问卷
            this.setAnswer(qid, String(phone));
            this._validateWhitelist(String(phone));
          },
          fail: (err) => {
            this.setData({ phoneTip: `❌ 请求后端失败：${err.errMsg}\n（需在服务器实现 POST /api/public/wechat/getPhoneNumber）` });
            wx.showToast({ title: '请求失败', icon: 'none' });
          },
          complete: () => this.setData({ phoneLoading: false })
        });
      },
      fail: (err) => {
        this.setData({ phoneLoading: false, phoneTip: `❌ wx.login 失败：${err.errMsg}` });
      }
    });
  },

  /**
   * 手动输入名单后点击“校验名单”按钮（降级入口，不依赖微信手机号授权）
   */
  onValidateWhitelistTap() {
    const val = (this.data.answers['whitelistName'] || '').toString().trim();
    if (!val) {
      wx.showToast({ title: '请先输入名单', icon: 'none' });
      return;
    }
    this._validateWhitelist(val);
  },

  /**
   * 调 POST /api/public/validateProject 校验白名单，成功后后端直接返回真实问卷（PublicProjectView）
   * payload 结构与 H5 端保持一致：{ id, answer: { whitelistName: { whitelistName: <手机号> } } }
   * @param {string} phone 已拿到/已缓存的手机号
   * @param {{fromCache?: boolean}} opts fromCache=true 表示本次校验使用本地缓存，失败时需清缓存
   */
  _validateWhitelist(phone, opts) {
    const fromCache = !!(opts && opts.fromCache);
    this.setData({ phoneLoading: true, error: '' });
    this.setStatus(fromCache ? '正在使用缓存手机号自动校验名单...' : '正在校验名单...', 'info');
    wx.request({
      url: `${this.data.baseUrl}/api/public/validateProject`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        id: this.data.shortId,
        answer: { whitelistName: { whitelistName: String(phone) } }
      },
      timeout: 20000,
      success: (res) => {
        console.log('[validateProject] response =', res, 'fromCache =', fromCache);
        if (res.statusCode !== 200) {
          this.setData({ phoneTip: `❌ HTTP ${res.statusCode}\n${JSON.stringify(res.data).slice(0, 200)}` });
          this.setStatus('名单校验失败', 'err');
          if (fromCache) storage.clearWhitelistCache(this.data.shortId);
          return;
        }
        const body = res.data || {};
        if (body.code !== undefined && body.code !== 200) {
          // 业务错误：名单不在白名单/已被移除 → 缓存作废，需重新授权
          if (fromCache) {
            storage.clearWhitelistCache(this.data.shortId);
            this.setData({
              phoneTip: `⚠️ 缓存手机号 ${phone} 已失效（${body.message || '不在白名单'}），已清除本地缓存，请重新授权`
            });
          } else {
            this.setData({ phoneTip: `❌ 名单校验失败：${body.message || '不在白名单中'}` });
          }
          this.setStatus('名单校验失败', 'err');
          wx.showModal({
            title: '名单校验未通过',
            content: (fromCache ? `缓存的手机号 ${phone} 已失效：` : '') + (body.message || '您的手机号不在该问卷的白名单中，请联系管理员'),
            showCancel: false
          });
          return;
        }
        const project = body.data || body;
        // 记住名单，saveAnswer 需要带上顶层 whitelistName 字段
        this._whitelistName = String(phone);
        // 写入本地缓存，下次打开同一测评直接自动校验
        storage.setWhitelistCache(this.data.shortId, String(phone));
        // 后端返回真实问卷，直接重新渲染
        this._applyProject(project);
        wx.showToast({
          title: fromCache ? '已使用缓存名单' : '名单校验通过',
          icon: 'success'
        });
      },
      fail: (err) => {
        this.setData({ phoneTip: `❌ 请求 validateProject 失败：${err.errMsg}` });
        this.setStatus('名单校验失败', 'err');
        // 网络异常不清缓存（可能只是临时断网），下次进入仍可重试
      },
      complete: () => this.setData({ phoneLoading: false })
    });
  },

  /**
   * 失焦时校验（对应 setting.answerSetting.triggerType === 'onBlur'）
   */
  onBlurValidate(e) {
    const qid = e.currentTarget.dataset.qid;
    const q = this.data.questions.find(x => x.id === qid);
    if (!q) return;
    const err = validator.validateQuestion(q, this.data.answers[qid]);
    const errors = Object.assign({}, this.data.errors);
    if (err) errors[qid] = err; else delete errors[qid];
    this.setData({ errors });
  },

  /* ==========================================================
   * HorzBlank / MultipleBlank：{childId: value}
   * ========================================================== */
  onHorzBlankInput(e) {
    const { qid, fid } = e.currentTarget.dataset;
    const cur = Object.assign({}, this.data.answers[qid] || {});
    cur[fid] = e.detail.value;
    this.setAnswer(qid, cur);
  },

  /* ==========================================================
   * Cascader：左右多列联动，点击第 lvl 列某项
   * { path: [...values], labels: [...labels] }
   * 截断到当前级，更深层级的选择自动清空
   * ========================================================== */
  onCascaderColTap(e) {
    const { qid, level, value, label } = e.currentTarget.dataset;
    const lvl = Number(level);
    const cur = Object.assign({ path: [], labels: [] }, this.data.answers[qid]);
    const path = cur.path.slice(0, lvl);
    const labels = cur.labels.slice(0, lvl);
    path.push(value);
    labels.push(label);
    this.setAnswer(qid, { path, labels });
  },

  /* ==========================================================
   * Barcode：调用 wx.scanCode
   * ========================================================== */
  onScanCode(e) {
    const qid = e.currentTarget.dataset.qid;
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode', 'barCode', 'datamatrix', 'pdf417'],
      success: (res) => {
        console.log('[scanCode]', res);
        this.setAnswer(qid, res.result);
        wx.showToast({ title: '扫码成功', icon: 'success' });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '扫码失败', icon: 'none' });
        }
      }
    });
  },

  /* ==========================================================
   * Signature：手写签名（canvas 2d，iOS 兼容）
   * 旧版 canvas-id + ctx.draw(true) 在 iOS 真机有 bug（reserve 不生效、无痕迹），
   * 改用 type="2d" + 标准 CanvasRenderingContext2D，无需 draw()。
   * ========================================================== */
  _initSigCanvas(qid, retry) {
    const query = wx.createSelectorQuery().in(this);
    query.select(`#sig-${qid}`).fields({ node: true, size: true }).exec(res => {
      const info = res && res[0];
      if (!info || !info.node) {
        // canvas 还没渲染出来，延迟重试一次
        if (!retry) setTimeout(() => this._initSigCanvas(qid, true), 300);
        else console.warn('[sig] canvas node not found', qid);
        return;
      }
      const node = info.node;
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      node.width = info.width * dpr;
      node.height = info.height * dpr;
      const ctx = node.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1f2937';
      this.data.sigCtxCache[qid] = { node, ctx, w: info.width, h: info.height };
      console.log('[sig] canvas 2d ready', qid, info.width, info.height);
    });
  },
  _initAllSigCanvas() {
    (this.data.questions || []).forEach(q => {
      if (q.type === 'Signature') this._initSigCanvas(q.id);
    });
  },
  onSigTouchStart(e) {
    const qid = e.currentTarget.dataset.qid;
    const c = this.data.sigCtxCache[qid];
    if (!c) { this._initSigCanvas(qid); return; }
    const t = e.touches[0];
    c.ctx.beginPath();
    c.ctx.moveTo(t.x, t.y);
    this._sigLast = { qid, x: t.x, y: t.y };
  },
  onSigTouchMove(e) {
    const qid = e.currentTarget.dataset.qid;
    const c = this.data.sigCtxCache[qid];
    if (!c || !this._sigLast || this._sigLast.qid !== qid) return;
    const t = e.touches[0];
    // canvas 2d 是立即渲染，不需要 draw(true)
    c.ctx.lineTo(t.x, t.y);
    c.ctx.stroke();
    c.ctx.beginPath();
    c.ctx.moveTo(t.x, t.y);
    this._sigLast = { qid, x: t.x, y: t.y };
    if (!this.data.sigHasStroke[qid]) {
      const m = Object.assign({}, this.data.sigHasStroke);
      m[qid] = true;
      this.setData({ sigHasStroke: m });
    }
  },
  onSigTouchEnd() { this._sigLast = null; },
  onSigClear(e) {
    const qid = e.currentTarget.dataset.qid;
    const c = this.data.sigCtxCache[qid];
    if (!c) return;
    // ctx 已 scale(dpr)，clearRect 用逻辑尺寸即可覆盖全部
    c.ctx.clearRect(0, 0, c.w, c.h);
    const m = Object.assign({}, this.data.sigHasStroke);
    m[qid] = false;
    this.setAnswer(qid, '', true);
    this.setData({ sigHasStroke: m });
  },
  onSigConfirm(e) {
    const qid = e.currentTarget.dataset.qid;
    const c = this.data.sigCtxCache[qid];
    if (!c) { wx.showToast({ title: '请先签名', icon: 'none' }); return; }
    wx.canvasToTempFilePath({
      canvas: c.node,          // 2d canvas 传 node，不传 canvasId
      fileType: 'png',
      quality: 1,
      success: (res) => {
        console.log('[signature] tempFile =', res.tempFilePath);
        this.setAnswer(qid, res.tempFilePath);
        wx.showToast({ title: '签名已保存', icon: 'success' });
      },
      fail: (err) => {
        console.error('[signature] fail', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    }, this);
  },

  /* ==========================================================
   * Address：所在位置（wx.getLocation 取坐标 + 逆地址解析转文字地址）
   * ========================================================== */
  onGetLocation(e) {
    const qid = e.currentTarget.dataset.qid;
    const loading = Object.assign({}, this.data.locLoading);
    loading[qid] = true;
    this.setData({ locLoading: loading });

    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (loc) => {
        console.log('[getLocation]', loc);
        // 先存坐标（地址留空，逆解析回来再填）
        this.setAnswer(qid, {
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: '',
          name: '',
          accuracy: loc.accuracy
        });
        // 逆地址解析：坐标 → 文字地址（不依赖 chooseLocation）
        this._reverseGeocode(loc.latitude, loc.longitude).then(geo => {
          const cur = this.data.answers[qid] || {};
          if (geo && geo.error) {
            // 解析失败：把原因写入 geoError 展示，便于排查 key/域名问题
            this.setAnswer(qid, Object.assign({}, cur, { geoError: geo.error }));
            return;
          }
          this.setAnswer(qid, {
            latitude: cur.latitude != null ? cur.latitude : loc.latitude,
            longitude: cur.longitude != null ? cur.longitude : loc.longitude,
            address: geo.address || '',
            name: geo.name || '',
            accuracy: loc.accuracy,
            geoError: ''
          });
        });
      },
      fail: (err) => {
        console.error('[getLocation] fail', err);
        wx.showModal({
          title: '获取位置失败',
          content: (err.errMsg || '') + '\n\n请确认：\n1. 小程序已申请 scope.userLocation 权限\n2. app.json 里配置了 permission.scope.userLocation\n3. 用户未拒绝定位权限',
          showCancel: false
        });
      },
      complete: () => {
        const l = Object.assign({}, this.data.locLoading);
        l[qid] = false;
        this.setData({ locLoading: l });
      }
    });
  },

  /**
   * 逆地址解析：坐标 → 文字地址（腾讯位置服务 WebService，gcj02 坐标系）
   * 返回 Promise<{address, name}|null>；未配 key 或请求失败时 resolve(null)，不影响主流程
   * key 申请：https://lbs.qq.com；域名白名单：https://apis.map.qq.com
   */
  _reverseGeocode(latitude, longitude) {
    return new Promise((resolve) => {
      const key = this.data.qqMapKey;
      if (!key) {
        resolve({ error: '未配置 qqMapKey' });
        return;
      }
      if (latitude == null || longitude == null) { resolve({ error: '坐标为空' }); return; }
      wx.request({
        url: 'https://apis.map.qq.com/ws/geocoder/v1/',
        data: {
          location: `${latitude},${longitude}`,
          key: key,
          get_poi: 1
        },
        success: (res) => {
          const d = res.data;
          if (d && d.status === 0 && d.result) {
            const r = d.result;
            // formatted_addresses.recommend 更适合展示（如“北京市海淀区xx路”），address 为完整地址
            const fa = r.formatted_addresses || {};
            const address = fa.recommend || fa.rough || r.address || '';
            const name = (r.pois && r.pois[0] && r.pois[0].title)
                      || (r.address_reference && r.address_reference.landmark_l2 && r.address_reference.landmark_l2.title)
                      || '';
            console.log('[geocoder] ok', address, name);
            resolve({ address: address, name: name });
          } else {
            // status 非 0：110=请求来源未授权 / 120=key格式错 / 121=key不存在 / 199=超额 等
            const msg = `status=${d && d.status} ${(d && d.message) || ''}`;
            console.error('[geocoder] 解析失败', msg);
            resolve({ error: msg });
          }
        },
        fail: (err) => {
          // 多为 apis.map.qq.com 不在 request 合法域名（真机必须配置，开发者工具需勾"不校验合法域名"）
          const msg = (err && err.errMsg) || '请求失败';
          console.error('[geocoder] 请求失败', msg);
          resolve({ error: msg });
        }
      });
    });
  },

  /**
   * Address：是否允许拖动地图移动定位
   * 仅当显式配置 mapMove === true（q.attribute 或 children[0].attribute）；缺省/false 均不允许
   */
  _mapMoveEnabled(q) {
    if (!q) return false;
    if (q.attribute && q.attribute.mapMove === true) return true;
    if (q.children && q.children[0] && q.children[0].attribute && q.children[0].attribute.mapMove === true) return true;
    return false;
  },

  /**
   * Address：拖动地图后取中心点作为新坐标（仅当显式 mapMove === true）
   * 缺省/false 时拖动仅查看，不更新坐标、不重新逆地址解析
   */
  onMapRegionChange(e) {
    if (!e || e.type !== 'end') return;   // 只处理拖动结束
    // 由 cause 判断：gesture 才是用户手势拖动，排除程序 moveToLocation 触发
    if (e.causedBy && e.causedBy !== 'gesture' && e.causedBy !== 'drag') return;
    const qid = e.currentTarget.dataset.qid;
    const q = this.data.questions.find(x => x.id === qid);
    if (!this._mapMoveEnabled(q)) return;   // 未显式 mapMove:true，拖动不修改定位
    const ctx = wx.createMapContext(`map-${qid}`, this);
    ctx.getCenterLocation({
      success: (res) => {
        const cur = this.data.answers[qid] || {};
        this.setAnswer(qid, {
          latitude: res.latitude,
          longitude: res.longitude,
          address: cur.address || '',
          name: cur.name || '',
          movedByMap: true
        });
        // 拖动后重新逆地址解析，更新中心点的文字地址
        this._reverseGeocode(res.latitude, res.longitude).then(geo => {
          const c2 = this.data.answers[qid] || {};
          if (geo && geo.error) {
            this.setAnswer(qid, Object.assign({}, c2, { geoError: geo.error }));
            return;
          }
          this.setAnswer(qid, Object.assign({}, c2, {
            address: geo.address,
            name: geo.name,
            geoError: ''
          }));
        });
      }
    });
  },

  /* ==========================================================
   * MatrixRadio：{rowId: colId}
   * ========================================================== */
  onMatrixRadioTap(e) {
    const { qid, rowid, colid } = e.currentTarget.dataset;
    const cur = Object.assign({}, this.data.answers[qid] || {});
    cur[rowid] = colid;
    this.setAnswer(qid, cur);
  },

  /* ==========================================================
   * MatrixCheckbox：{rowId: [colId,...]}
   * ========================================================== */
  onMatrixCheckboxTap(e) {
    const { qid, rowid, colid } = e.currentTarget.dataset;
    const cur = Object.assign({}, this.data.answers[qid] || {});
    const arr = (cur[rowid] || []).slice();
    const idx = arr.indexOf(colid);
    if (idx > -1) arr.splice(idx, 1); else arr.push(colid);
    cur[rowid] = arr;
    this.setAnswer(qid, cur);
  },

  /* ==========================================================
   * MatrixFillBlank：{rowId: {colId: value}}
   * ========================================================== */
  onMatrixFillInput(e) {
    const { qid, rowid, colid } = e.currentTarget.dataset;
    const cur = Object.assign({}, this.data.answers[qid] || {});
    const row = Object.assign({}, cur[rowid] || {});
    row[colid] = e.detail.value;
    cur[rowid] = row;
    this.setAnswer(qid, cur);
  },

  /* ==========================================================
   * MatrixAuto：[{colId: value}, ...]
   * ========================================================== */
  onAutoCellInput(e) {
    const { qid, idx, colid } = e.currentTarget.dataset;
    const rows = (this.data.answers[qid] || []).slice();
    const row = Object.assign({}, rows[idx] || {});
    row[colid] = e.detail.value;
    rows[idx] = row;
    this.setAnswer(qid, rows);
  },
  /**
   * MatrixAuto 下拉列选择：picker 返回 dataSource 下标，存对应 value
   * （后端 SchemaHelper#parseMatrixAutoQuestionValue 按 value 反查 label）
   */
  onAutoCellSelect(e) {
    const { qid, idx, colid } = e.currentTarget.dataset;
    const q = this.data.questions.find(x => x.id === qid);
    const col = (q && q.children || []).find(c => c.id === colid);
    const ds = (col && col.dataSource) || [];
    const item = ds[Number(e.detail.value)];
    if (!item) return;
    const rows = (this.data.answers[qid] || []).slice();
    const row = Object.assign({}, rows[idx] || {});
    row[colid] = item.value;
    rows[idx] = row;
    this.setAnswer(qid, rows);
  },
  onAutoRowAdd(e) {
    const qid = e.currentTarget.dataset.qid;
    const q = this.data.questions.find(x => x.id === qid);
    const rows = (this.data.answers[qid] || []).slice();
    rows.push(this.buildEmptyAutoRow(q));
    this.setAnswer(qid, rows);
  },
  onAutoRowDel(e) {
    const { qid, idx } = e.currentTarget.dataset;
    const rows = (this.data.answers[qid] || []).slice();
    if (rows.length <= 1) {
      wx.showToast({ title: '至少保留一行', icon: 'none' });
      return;
    }
    rows.splice(Number(idx), 1);
    this.setAnswer(qid, rows);
  },

  /* ==========================================================
   * 提交
   * ========================================================== */

  /**
   * 将小程序内部存储的答案格式转换为 H5/后端识别的提交格式。
   *
   * 后端 ProjectStatHelper 要求 answer[qid] 必须是 Map 对象：
   *   - Radio/Select:  {optId: true}
   *   - Checkbox:      {optId1: true, optId2: true}
   *   - Score/Nps:     {childId: number}
   *   - FillBlank/Textarea: {childId: "text"}
   *   - MatrixRadio:   {rowId: {colId: true}}
   *   - MatrixCheckbox:{rowId: {colId1: true, colId2: true}}
   *   - HorzBlank/MultipleBlank/MatrixFillBlank: {childId: value} —— 已正确
   *   - Cascader:      {childId_level0: val0, childId_level1: val1, ...}
   *   - Address:       {childId: {latitude, longitude, address, name}}
   *   - Signature:     {childId: tempFilePath}  (TODO: 需先上传)
   */
  _toSubmitFormat(q, v) {
    const childId = (q.children && q.children[0] && q.children[0].id) || q.id;
    switch (q.type) {
      case 'Radio':
      case 'Select':
      case 'Judge':
        // 内部存 "optId" → 提交 {optId: true}
        if (typeof v === 'string' && v) return { [v]: true };
        return v;

      case 'Checkbox':
        // 内部存 ["opt1","opt2"] → 提交 {opt1: true, opt2: true}
        if (Array.isArray(v)) {
          const obj = {};
          v.forEach(id => { obj[id] = true; });
          return obj;
        }
        return v;

      case 'Score':
      case 'Nps':
        // 内部存 number → 提交 {childId: number}
        if (typeof v === 'number') return { [childId]: v };
        return v;

      case 'FillBlank':
      case 'Textarea':
        // 内部存 "text" → 提交 {childId: "text"}
        if (typeof v === 'string') return { [childId]: v };
        return v;

      case 'MatrixRadio': {
        // 内部存 {rowId: "colId"} → 提交 {rowId: {colId: true}}
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const out = {};
          Object.keys(v).forEach(rowId => {
            const colVal = v[rowId];
            if (typeof colVal === 'string' && colVal) {
              out[rowId] = { [colVal]: true };
            } else {
              out[rowId] = colVal;
            }
          });
          return out;
        }
        return v;
      }

      case 'MatrixCheckbox': {
        // 内部存 {rowId: ["col1","col2"]} → 提交 {rowId: {col1: true, col2: true}}
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const out = {};
          Object.keys(v).forEach(rowId => {
            const arr = v[rowId];
            if (Array.isArray(arr)) {
              const obj = {};
              arr.forEach(id => { obj[id] = true; });
              out[rowId] = obj;
            } else {
              out[rowId] = arr;
            }
          });
          return out;
        }
        return v;
      }

      case 'MatrixFillBlank':
        // 内部存 {rowId: {colId: value}} → 格式已正确，直接返回
        return v;

      case 'HorzBlank':
      case 'MultipleBlank':
        // 内部存 {childId: value} → 格式已正确
        return v;

      case 'Cascader': {
        // 内部存 {path: [v0,v1,...], labels: [...]} → 提交 {child_level0: v0, child_level1: v1, ...}
        const path = (v && v.path) || (Array.isArray(v) ? v : []);
        const obj = {};
        path.forEach((val, idx) => {
          const cid = (q.children && q.children[idx] && q.children[idx].id) || (`level_${idx}`);
          obj[cid] = val;
        });
        return obj;
      }

      case 'Address':
        // 内部存 {latitude, longitude, address, name} → 提交 {childId: {...}}
        if (v && typeof v === 'object') return { [childId]: v };
        return v;

      case 'Signature':
        // 内部存 tempFilePath → 提交 {childId: filePath} (TODO: 需先调 upload 接口)
        if (typeof v === 'string' && v) return { [childId]: v };
        return v;

      case 'Barcode':
        // 内部存 "扫码结果" → 提交 {childId: "扫码结果"}
        if (typeof v === 'string') return { [childId]: v };
        return v;

      case 'MatrixAuto':
        // 内部存 [{colId: val}, ...] → 后端 parseMatrixAutoQuestionValue 直接按 List<Map> 解析，
        // 不能包 {childId: ...}，原样提交数组
        return v;

      default:
        // User / Dept / Upload 等其他题型，默认包装为 {childId: v}
        if (v !== null && v !== undefined && typeof v !== 'object') return { [childId]: v };
        return v;
    }
  },

  /** 清空上次回填的答案，恢复初始空表单 */
  onClearRefill() {
    if (!this._initAnswers) return;
    this.setData({
      answers: Object.assign({}, this._initAnswers), lastSubmit: null, errors: {},
      answeredCount: 0, progressPct: 0
    });
    wx.showToast({ title: '已清空重填', icon: 'success' });
  },

  submit() {
    if (this.data.submitting) return;
    const { baseUrl, project, answers, shortId, startTime, questions } = this.data;

    // 全量校验
    const result = validator.validateAll(questions, answers);
    if (!result.valid) {
      this.setData({ errors: result.errors });
      const firstErrTitle = (questions.find(q => q.id === result.firstErrorQid) || {}).title || '';
      wx.showModal({
        title: '表单校验未通过',
        content: `共 ${Object.keys(result.errors).length} 题有误，第一处："${firstErrTitle}"`,
        showCancel: false
      });
      // 滚动到第一个错误题
      if (result.firstErrorQid) {
        wx.pageScrollTo({ selector: `#q-${result.firstErrorQid}`, duration: 300 });
      }
      return;
    }

    // 转换答案格式：小程序内部存储格式 → H5/后端识别的提交格式
    // 后端 ProjectStatHelper 要求 answer[qid] 必须是 Map 对象，不能是字符串/数组/数字
    const cleanAnswer = {};
    questions.forEach(q => {
      let v = answers[q.id];
      if (validator.isEmpty(v) && !(q.attribute && q.attribute.required)) return;
      cleanAnswer[q.id] = this._toSubmitFormat(q, v);
    });

    let sysInfo = {};
    try { sysInfo = wx.getSystemInfoSync(); } catch (e) {}

    const payload = {
      projectId: shortId || project.id,
      answer: cleanAnswer,
      tempSave: 1,
      metaInfo: {
        clientInfo: {
          agent: 'wx-mini-program',
          platform: sysInfo.platform || 'unknown',
          deviceType: 'mobile',
          browser: 'wechat',
          browserVersion: sysInfo.version || ''
        },
        answerInfo: { startTime, endTime: Date.now() }
      }
    };
    // 白名单问卷（whitelistType=4）需将已校验的名单手机号作为顶层 whitelistName 字段一并提交，
    // 后端依赖该字段定位 ProjectPartner（参见 SurveyServiceImpl#updateProjectPartnerByAnswer）
    if (this._whitelistName) {
      payload.whitelistName = this._whitelistName;
    }

    console.log('[saveAnswer] payload =', payload);
    this.setData({ submitting: true, error: '', submitResult: null });
    this.setStatus('正在提交...', 'info');

    wx.request({
      url: `${baseUrl}/api/public/saveAnswer`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: payload,
      timeout: 20000,
      success: (res) => {
        console.log('[saveAnswer] response =', res);
        if (res.statusCode !== 200) {
          this.setData({ error: `HTTP ${res.statusCode}\n${JSON.stringify(res.data, null, 2)}` });
          this.setStatus('提交失败', 'err'); return;
        }
        const body = res.data || {};
        if (body.code !== undefined && body.code !== 200) {
          this.setData({ error: `业务错误 code=${body.code}\n${body.message || ''}` });
          this.setStatus('提交失败', 'err'); return;
        }
        const r = body.data || body;
        this.setData({ submitResult: r, submitResultText: JSON.stringify(r, null, 2) });
        this.setStatus('🎉 提交成功', 'ok');
        // 记录到本地"我的测评"（后端无公开接口，用 localStorage）
        const p = this.data.project || {};
        const rawTitle = (p.survey && p.survey.title) || p.name || '';
        const plainTitle = rawTitle.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        storage.recordMySurvey({
          shortId: this.data.shortId,
          title: plainTitle || '未命名问卷',
          answers: this.data.answers   // 存表单原始答案，供再次进入回填
        });
        wx.showModal({
          title: '提交成功 🎉',
          content: '问卷到此结束，感谢您的参与！answerId: ' + (r.answerId || '问卷到此结束，感谢您的参与！'),
          showCancel: false,
          confirmText: '确认',
          success: () => {
            // 返回首页：index.onShow 会自动刷新“我参加过的测评”列表
            const pages = getCurrentPages();
            if (pages && pages.length > 1) {
              wx.navigateBack({ delta: 1 });
            } else {
              // 页面栈只有一页（例如直接通过分享链接进入 survey），则 reLaunch 回首页
              wx.reLaunch({ url: '/pages/index/index' });
            }
          }
        });
      },
      fail: (err) => {
        this.setData({ error: `请求失败：${err.errMsg}` });
        this.setStatus('提交失败', 'err');
      },
      complete: () => this.setData({ submitting: false })
    });
  }
});
