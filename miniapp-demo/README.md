# SurveyKing 小程序 MVP Demo

一份**可直接导入微信开发者工具**的最小项目，用于验证 [`docs/miniapp-api.md`](../docs/miniapp-api.md) 中列出的核心接口链路。

## 一、准备工作

### 1. 后端已就绪
- 部署地址：`https://test.huaiyu.cn`
- 测试问卷：`VEb4hf`（21 题，覆盖 16 种题型）
- curl 冒烟已通过：
  ```
  POST /api/public/loadProject  {"id":"VEb4hf"}  → 200 OK  273 KB
  GET  /api/system                              → 200 OK
  ```

### 2. 安装微信开发者工具
下载：<https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>

### 3. 导入本项目
1. 打开微信开发者工具 → **导入项目**
2. 目录选择：`/Users/williampamg/Works/yuejuan_online_testing/SurveyKing/miniapp-demo`
3. AppID：**点"测试号"** 即可（`project.config.json` 里已经写了 `wxa7a092d968b13e37`）
4. 项目名称：任意

### 4. ⚠️ 关闭域名校验（关键）
导入后：
- 右上角 **详情** → **本地设置**
- 勾选 ✅ **"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"**

否则 `wx.request` 会因为 `https://test.huaiyu.cn` 不是 HTTPS 而直接 fail。

## 二、跑通验证

### Step 1 · 测试 /api/system
点击首页 **Step 1** 按钮，期望：
- ✅ Toast "系统接口 OK"
- 页面下方展示 JSON 响应

### Step 2 · 加载问卷 loadProject
点击 **Step 2** 按钮，期望：
- ✅ Toast "加载成功 · 21 题"
- 出现 **Step 3 · 进入答卷页** 按钮

### Step 3 · 进入答卷页
点击 **Step 3**，进入答卷页：
- 会渲染所有 21 道题
- **已支持**：Radio（单选）、Checkbox（多选）、Select（下拉）、FillBlank（填空）、Textarea（多行）、HorzBlank、Score（评分）、Nps
- **未支持**（显示黄色占位提示）：Cascader、MultipleBlank、Barcode、MatrixRadio、MatrixCheckbox、MatrixFillBlank、MatrixAuto、User、Dept

### Step 4 · 提交答卷
- 回答几道题（必填题必须答完，否则弹提示）
- 点击底部 **提交答卷** 按钮
- 期望：
  - ✅ 弹窗 "提交成功 🎉"，返回 answerId
  - 页面下方展示完整响应 JSON
  - **在管理后台 → 数据 → 该问卷下能看到新答卷**

## 三、目录结构

```
miniapp-demo/
├── app.js                        # 全局入口，配置 baseUrl
├── app.json                      # 页面路由
├── app.wxss                      # 全局样式
├── sitemap.json
├── project.config.json           # 项目配置（已关闭 urlCheck）
├── utils/
│   └── helper.wxs                # WXML 辅助函数
└── pages/
    ├── index/                    # 入口页：输入 shortId + 加载
    │   ├── index.js
    │   ├── index.wxml
    │   ├── index.wxss
    │   └── index.json
    └── answer/                   # 答卷页：渲染 + 提交
        ├── answer.js
        ├── answer.wxml
        ├── answer.wxss
        └── answer.json
```

## 四、关键代码片段

### 4.1 全局 baseUrl
[`app.js`](./app.js)：
```javascript
App({
  globalData: {
    baseUrl: 'https://test.huaiyu.cn'
  }
});
```

### 4.2 加载问卷
[`pages/index/index.js`](./pages/index/index.js)：
```javascript
wx.request({
  url: `${baseUrl}/api/public/loadProject`,
  method: 'POST',
  data: { id: 'VEb4hf' },
  success(res) {
    const project = res.data.data; // 注意：外层有 {code, data} 包装
    // project.survey.children 是题目数组
  }
});
```

### 4.3 提交答卷
[`pages/answer/answer.js`](./pages/answer/answer.js)：
```javascript
wx.request({
  url: `${baseUrl}/api/public/saveAnswer`,
  method: 'POST',
  data: {
    projectId: 'VEb4hf',
    answer: { vbhi: 'tqc0', tspq: ['dipi', '6bqd'], o83y: 'iure' },
    tempSave: 1,
    metaInfo: {
      clientInfo: { agent: 'wx-mini-program', deviceType: 'mobile' },
      answerInfo: { startTime, endTime: Date.now() }
    }
  }
});
```

## 五、下一步

跑通 MVP 后，可以选择：

### 路线 A · web-view 套壳（3-5 天）
- 用 `<web-view src="https://h5.dxx.zone/s/VEb4hf">` 直接嵌入现有 H5
- 优点：无需重写渲染器，21 种题型全支持
- 缺点：个人主体小程序不能用 web-view；域名必须 HTTPS + 备案 + 校验文件

### 路线 B · Taro 原生重写（3-4 周 MVP）
- 用 Taro 4 + React 18 + TypeScript 重构
- 逐个补齐题型（Cascader / Matrix / Barcode / User / Dept）
- 实现完整逻辑引擎（条件显示、跳题、值计算）
- 微信授权登录（后端需要新增 `jscode2session` 接口）

### 路线 C · 当前原生小程序继续扩展
- 优点：无编译层，包体最小
- 缺点：题型多了以后 WXML 会膨胀，逻辑引擎难写

## 六、常见问题

**Q: `wx.request:fail url not in domain list`**
A: 没关闭域名校验，见"准备工作 Step 4"。

**Q: 提交后返回 `code: 400 缺少必填字段`**
A: 检查 `answer` 里的 questionId 是否用了后端返回的短 id（如 `vbhi`），而不是 title。

**Q: 上传附件怎么调？**
A: MVP demo 未实现，用 `wx.uploadFile`：
```javascript
wx.uploadFile({
  url: `${baseUrl}/api/public/upload`,
  filePath,
  name: 'file',
  formData: { projectId: 'VEb4hf', questionId: 'xxx', fileType: 1 }
});
```

**Q: 生产环境怎么办？**
A: 上线前必须：
1. Nginx 反代 `https://api.dxx.zone` → `127.0.0.1:1991`
2. 域名 ICP 备案
3. 微信后台配置 request 合法域名
4. 修改 `app.js` 的 `baseUrl`

## 七、白名单一键获取微信手机号

当问卷启用白名单（`setting.answerSetting.whitelistType = 4`，导入名单）时，`loadProject` 返回的不是真实问卷，而是一个登录表单：只包含一个 `id = whitelistName` 的 `FillBlank` 题（标题“请先输入名单，再进行填写”），同时 `loginRequired = true`、`isAuthenticated = false`。

### 完整链路

```
loadProject  →  返回登录表单（whitelistName 单题）
   ↓
小程序渲染“一键获取微信手机号”按钮 + 手动输入框
   ↓
用户点击→微信授权→小程序拿到 code
   ↓
POST /api/public/wechat/getPhoneNumber  →  后端解密→返回 { phone }
   ↓
回填到 whitelistName 输入框
   ↓
POST /api/public/validateProject  →  校验名单，后端直接返回真实问卷
   payload: { id: "VEb4hf", answer: { whitelistName: { whitelistName: "15982825992" } } }
   ↓
_applyProject 重新渲染→进入正常答卷流程
   ↓
POST /api/public/saveAnswer  →  提交真实答案（payload 顶层带 whitelistName 字段）
```

### 后端需新增的接口

#### 1. `POST /api/public/wechat/getPhoneNumber`（新增）

微信官方限制：小程序无法直接拿到手机号明文，必须经由服务器解密。

```
Request Body:
{
  "code": "...",           // getPhoneNumber 回调 e.detail.code（优先使用）
  "encryptedData": "...",  // 旧版兼容字段
  "iv": "...",             // 旧版兼容字段
  "loginCode": "..."       // wx.login 拿到的登录 code
}

Response:
{ "code": 200, "data": { "phone": "15982825992" } }
```

服务端两种解密方式（任选一种）：

1. **新版 code 方式**（推荐，小程序基础库 2.21.2+）
   ```
   POST https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=ACCESS_TOKEN
   Body: { "code": "<上面的 code>" }
   → phone_info.purePhoneNumber
   ```
   `ACCESS_TOKEN` 需先调 `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=APPID&secret=APPSECRET` 获取（服务端缓存 2 小时）。

2. **旧版 encryptedData 方式**
   ```
   1) 用 loginCode 调 jscode2session 拿 session_key
      GET https://api.weixin.qq.com/sns/jscode2session?appid=&secret=&js_code=&grant_type=authorization_code
   2) AES-128-CBC 解密 encryptedData（key = base64decode(session_key)，iv = base64decode(iv)）
   ```

#### 2. `POST /api/public/validateProject`（已存在）

后端 [`SurveyApi.java`](../server/api/src/main/java/cn/surveyking/server/api/SurveyApi.java) 已实现，返回 `PublicProjectView`，与 `loadProject` 同构。小程序直接复用 `_applyProject()` 重新渲染即可。

#### 3. `POST /api/public/saveAnswer`（已存在）

提交时需带上顶层 `whitelistName` 字段，后端 [`SurveyServiceImpl#updateProjectPartnerByAnswer`](../server/rdbms/src/main/java/cn/surveyking/server/impl/SurveyServiceImpl.java) 依赖它定位 `ProjectPartner`：

```
{
  "projectId": "VEb4hf",
  "whitelistName": "15982825992",
  "answer": { ...真实题目的答案... },
  "tempSave": 1,
  "metaInfo": { ... }
}
```

### 小程序后台配置

微信公众平台 → 开发管理 → 服务器域名 → request 合法域名，需包含：
- 你自己的 `baseUrl`（小程序只直接请求自己后端，不直连微信官方接口）

### 降级行为

- 后端 `getPhoneNumber` 接口未实现时：提示“后端换取手机号失败”，用户仍可在下方输入框手动输入名单后点“✅ 校验名单并加载问卷”
- 用户拒绝授权：同上，手动输入 + 手动校验
- 名单不在白名单中：`validateProject` 返回业务错误，弹窗提示“您的手机号不在该问卷的白名单中”

### 本地手机号缓存（免二次授权）

校验成功后，小程序会把 `{ shortId → phone }` 写入本地存储 `huaiyu_whitelist_cache`。下次打开同一测评：

```
loadProject → 检测到 whitelistOnly → 读本地缓存
  ↓ 命中
直接 POST /api/public/validateProject（缓存手机号）
  ↓ 后端返回真实问卷
_applyProject → 进入答卷页面
```

用户全程无需再弹微信手机号授权面板。失效机制：

| 场景 | 处理 |
|------|------|
| `validateProject` 返回业务错误（名单已移除/不在白名单） | 自动清除缓存，提示“缓存手机号 XXX 已失效，请重新授权” |
| `validateProject` HTTP 错误（非 200） | 自动清除缓存 |
| 网络异常（wx.request fail） | **不清除**缓存（可能只是临时断网），下次仍可重试 |
| 首页“我的测评”列表左滑删除 | 同步清除该测评的手机号缓存 |

相关代码：[`utils/storage.js`](./utils/storage.js) 中 `getWhitelistCache / setWhitelistCache / clearWhitelistCache`。

## 参考

- 完整 API 文档：[`docs/miniapp-api.md`](../docs/miniapp-api.md)
- 后端源码：[`server/api/src/main/java/cn/surveyking/server/api/SurveyApi.java`](../server/api/src/main/java/cn/surveyking/server/api/SurveyApi.java)
