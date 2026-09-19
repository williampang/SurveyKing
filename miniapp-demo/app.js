// app.js
App({
  globalData: {
    // ⚠️ 本地测试用，微信开发者工具需要关闭"域名校验"
    // 上线前必须换成 https://<你的备案域名>
    baseUrl: 'https://test.huaiyu.cn',

    // 腾讯位置服务 key（用于 Address 题逆地址解析：坐标 → 文字地址）
    // 申请地址：https://lbs.qq.com → 应用管理 → 创建应用 → 添加 key（勾选 WebServiceAPI）
    // 申请后还需在微信公众平台「开发管理 → 服务器域名 → request 合法域名」加入 https://apis.map.qq.com
    // 留空则跳过逆地址解析，仅保留经纬度坐标（不影响其它功能）
    qqMapKey: ''
  },

  onLaunch() {
    console.log('[SurveyKing Mini] launched, baseUrl =', this.globalData.baseUrl);
  },

  onError(err) {
    console.error('[App onError]', err);
  }
});
