// utils/storage.js - 本地"我的测评"参与记录 + 白名单手机号缓存
// 后端 /api/answer/list 需登录（/api/** authenticated），小程序匿名调不了，
// 且 /api/public/** 白名单里没有"我参与的测评"接口，故改用 localStorage 记录。

const KEY = 'huaiyu_my_surveys';
const W_KEY = 'huaiyu_whitelist_cache';   // { shortId: phone } 已校验白名单手机号缓存
const MAX = 20;

/** 读取我参与过的测评列表 [{ shortId, title, time }] */
function getMySurveys() {
  try {
    const list = wx.getStorageSync(KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * 记录一次参与：按 shortId 去重、新记录置顶、最多保留 MAX 条
 * @param {{shortId:string, title?:string, time?:number, answers?:Object}} item answers 为提交时的表单原始答案（用于再次进入回填）
 */
function recordMySurvey(item) {
  if (!item || !item.shortId) return;
  const list = getMySurveys().filter(x => x.shortId !== item.shortId);
  list.unshift({
    shortId: item.shortId,
    title: item.title || '',
    time: item.time || Date.now(),
    answers: item.answers || null
  });
  try {
    wx.setStorageSync(KEY, list.slice(0, MAX));
  } catch (e) {
    console.warn('[storage] setMySurveys fail', e);
  }
}

/** 取某测评的参与记录（含上次提交答案），无则 null */
function getMySurvey(shortId) {
  if (!shortId) return null;
  return getMySurveys().find(x => x.shortId === shortId) || null;
}

/**
 * 删除某条参与记录
 * @param {string} shortId
 */
function removeMySurvey(shortId) {
  if (!shortId) return;
  const list = getMySurveys().filter(x => x.shortId !== shortId);
  try {
    wx.setStorageSync(KEY, list);
  } catch (e) {
    console.warn('[storage] removeMySurvey fail', e);
  }
  // 同步清除该测评的白名单手机号缓存，下次进入需重新授权
  clearWhitelistCache(shortId);
}

/* ==========================================================
 * 白名单手机号缓存：{ shortId: phone }
 * 目的：同一测评下次打开时直接拿缓存手机号调 /api/public/validateProject，
 * 无需重新弹微信手机号授权面板。
 * 失效时机：后端返回"不在白名单"/"名单已移除"等业务错误时自动清除。
 * ========================================================== */

/** 读取指定测评缓存的已校验手机号，无则返回 '' */
function getWhitelistCache(shortId) {
  if (!shortId) return '';
  try {
    const map = wx.getStorageSync(W_KEY) || {};
    return (map && map[shortId]) ? String(map[shortId]) : '';
  } catch (e) {
    return '';
  }
}

/** 写入/更新指定测评的已校验手机号（validateProject 成功后调用） */
function setWhitelistCache(shortId, phone) {
  if (!shortId || !phone) return;
  try {
    const map = wx.getStorageSync(W_KEY) || {};
    map[shortId] = String(phone);
    wx.setStorageSync(W_KEY, map);
  } catch (e) {
    console.warn('[storage] setWhitelistCache fail', e);
  }
}

/** 清除指定测评的手机号缓存（validateProject 校验失败/名单被移除时调用） */
function clearWhitelistCache(shortId) {
  if (!shortId) return;
  try {
    const map = wx.getStorageSync(W_KEY) || {};
    if (map && map[shortId] !== undefined) {
      delete map[shortId];
      wx.setStorageSync(W_KEY, map);
    }
  } catch (e) {
    console.warn('[storage] clearWhitelistCache fail', e);
  }
}

/** 读取全部白名单缓存（调试/清空全部时用） */
function getAllWhitelistCache() {
  try { return wx.getStorageSync(W_KEY) || {}; } catch (e) { return {}; }
}

module.exports = {
  getMySurveys: getMySurveys,
  getMySurvey: getMySurvey,
  recordMySurvey: recordMySurvey,
  removeMySurvey: removeMySurvey,
  getWhitelistCache: getWhitelistCache,
  setWhitelistCache: setWhitelistCache,
  clearWhitelistCache: clearWhitelistCache,
  getAllWhitelistCache: getAllWhitelistCache
};
