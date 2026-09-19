# SurveyKing 公开 API 文档（微信小程序开发用）

> 本文档基于开源仓库 `server/api` 与 `server/shared` 源码整理，涵盖所有**免登录**可直接被微信小程序调用的接口。
>
> - Base URL：`https://<your-domain>`（Nginx 反代到 `127.0.0.1:1991`）
> - 所有接口前缀：`/api/public/**` 与 `/api/user/public/**`、`/api/system`、`/captcha/**`
> - 请求/响应格式：`application/json; charset=UTF-8`（上传接口除外）
> - 认证方式：**答卷页所有 `/api/public/*` 接口免登**；管理端需要 JWT（`Authorization: <token>` Header 或 Cookie）
> - 源码定位：
>   - Controller：[`server/api/src/main/java/cn/surveyking/server/api/`](../server/api/src/main/java/cn/surveyking/server/api)
>   - DTO：[`server/shared/src/main/java/cn/surveyking/server/domain/dto/`](../server/shared/src/main/java/cn/surveyking/server/domain/dto)
>   - 安全放行规则：[`WebSecurityConfig.java` L71-L73](../server/shared/src/main/java/cn/surveyking/server/core/config/WebSecurityConfig.java)

---

## 一、接口一览（按调用顺序）

| # | 场景 | 方法 | 路径 | 免登 | 源码 |
|---|---|---|---|---|---|
| 1 | 加载问卷 | POST | `/api/public/loadProject` | ✅ | [SurveyApi.java L37](../server/api/src/main/java/cn/surveyking/server/api/SurveyApi.java) |
| 2 | 密码/白名单校验 | POST | `/api/public/validateProject` | ✅ | SurveyApi.java L47 |
| 3 | 投票题统计 | POST | `/api/public/statistics` | ✅ | SurveyApi.java L57 |
| 4 | 提交答卷 | POST | `/api/public/saveAnswer` | ✅ | SurveyApi.java L67 |
| 5 | 暂存答卷 | POST | `/api/public/tempSaveAnswer` | ✅ | SurveyApi.java L78 |
| 6 | 上传附件 | POST | `/api/public/upload` | ✅ | SurveyApi.java L88 |
| 7 | 预览附件 | GET | `/api/public/preview/{attachmentId}` | ✅ | SurveyApi.java L99 |
| 8 | 加载公开查询 | POST | `/api/public/loadQuery` | ✅ | SurveyApi.java L113 |
| 9 | 获取公开查询结果 | POST | `/api/public/getQueryResult` | ✅ | SurveyApi.java L123 |
| 10 | 加载字典（级联题） | POST | `/api/public/loadDict` | ✅ | SurveyApi.java L133 |
| 11 | 加载考试结果 | POST | `/api/public/loadExamResult` | ✅ | SurveyApi.java L143 |
| 12 | 加载问卷关联结果 | POST | `/api/public/loadLinkResult` | ✅ | SurveyApi.java L153 |
| 13 | 系统信息 | GET | `/api/system` | ✅ | SystemApi.java L44 |
| 14 | 微信公众号授权启动 | POST | `/api/public/oauth/survey/wechat/start` | ✅ | OAuthApi.java L68 |
| 15 | OAuth 登录启动 | POST | `/api/public/oauth/login/{provider}/start` | ✅ | OAuthApi.java L51 |
| 16 | OAuth 回调 | GET | `/api/public/oauth/callback/{channel}` | ✅ | OAuthApi.java L76 |
| 17 | OAuth 注册信息 | GET | `/api/public/oauth/register/{ticket}` | ✅ | OAuthApi.java L99 |
| 18 | OAuth 完成注册 | POST | `/api/public/oauth/register/{ticket}` | ✅ | OAuthApi.java L104 |
| 19 | 后台账号登录 | POST | `/api/user/public/login` | ✅ | UserApi.java L49 |
| 20 | 后台账号登出 | POST | `/api/user/public/logout` | ✅ | UserApi.java L74 |
| 21 | 后台账号注册 | POST | `/api/user/public/register` | ✅ | UserApi.java L80 |
| 22 | 验证码获取 | GET | `/captcha/get` | ✅ | anji-plus captcha starter |
| 23 | 验证码校验 | POST | `/captcha/check` | ✅ | anji-plus captcha starter |

**小程序 MVP 只需要 1、4、6、7、10、11、13 这 7 个接口即可完成"加载问卷 → 答题 → 上传附件 → 提交 → 看结果"的完整闭环。**

---

## 二、核心接口详解

### 2.1 加载问卷 · `POST /api/public/loadProject`

**用途**：用户扫码或点击 `/s/{shortId}` 后，前端拿到 `shortId` 调用此接口获取完整问卷结构。

**请求体**（[`ProjectQuery`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/ProjectQuery.java)）：
```json
{
  "id": "VEb4hf",
  "password": "可选，如果问卷设置了密码",
  "answerId": "可选，续答场景传入",
  "mode": "survey | exam"
}
```

**响应体**（[`PublicProjectView`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicProjectView.java)）：
```json
{
  "id": "VEb4hf",
  "name": "问卷标题",
  "mode": "survey",
  "status": 1,
  "survey": { /* SurveySchema，见 2.13 */ },
  "setting": { /* ProjectSetting，见 2.14 */ },
  "passwordRequired": false,
  "loginRequired": false,
  "wechatAuthorizationRequired": false,
  "isAuthenticated": false,
  "submittedHtml": "<p>提交后展示的富文本</p>",
  "createAt": "2026-09-17T10:00:00",
  "answerId": "已提交时返回，用于查询结果",
  "answer": { /* 已提交的答案（如果有） */ },
  "tempAnswer": { /* 暂存的答案（如果有） */ }
}
```

**小程序示例**：
```javascript
wx.request({
  url: 'https://api.dxx.zone/api/public/loadProject',
  method: 'POST',
  header: { 'content-type': 'application/json' },
  data: { id: 'VEb4hf' },
  success(res) {
    if (res.data.passwordRequired) {
      // 弹密码框，调 validateProject
    } else {
      renderSurvey(res.data.survey, res.data.setting);
    }
  }
});
```

---

### 2.2 密码/白名单校验 · `POST /api/public/validateProject`

**用途**：问卷设置了访问密码或白名单时，先校验再拉完整 schema。

**请求体**：同 `loadProject`，`password` 必填。

**响应体**：`PublicProjectView`，校验通过后返回完整问卷。校验失败抛业务异常，HTTP 200 + 错误码。

---

### 2.3 投票题统计 · `POST /api/public/statistics`

**用途**：单选/多选投票题实时显示票数分布。

**请求体**：`ProjectQuery`（`id` 必填）。

**响应体**（[`PublicStatisticsView`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicStatisticsView.java)）：
```json
{
  "questionStatistics": {
    "q1_id": {
      "total": 100,
      "options": [
        { "optionId": "opt_a", "count": 60, "percentage": 60 },
        { "optionId": "opt_b", "count": 40, "percentage": 40 }
      ]
    }
  }
}
```

---

### 2.4 提交答卷 · `POST /api/public/saveAnswer`

**用途**：用户点击"提交"按钮。

**请求体**（[`AnswerRequest`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/AnswerRequest.java)）：
```json
{
  "projectId": "VEb4hf",
  "answer": {
    "q1_id": "opt_a",
    "q2_id": ["opt_b", "opt_c"],
    "q3_id": "填空题文本",
    "q4_id": { "fileName": "xxx.jpg", "id": "attachment_id" }
  },
  "tempAnswer": null,
  "tempSave": 1,
  "metaInfo": {
    "clientInfo": {
      "agent": "wx-mini-program",
      "platform": "iOS",
      "deviceType": "mobile",
      "remoteIp": "",
      "region": ""
    },
    "answerInfo": {
      "startTime": 1726531200000,
      "endTime": 1726531260000
    }
  },
  "examInfo": {
    "questionScore": { "q1_id": 5.0, "q2_id": 10.0 }
  },
  "whitelistName": "如果通过白名单进入，填对应名称",
  "queryId": "如果是公开查询场景"
}
```

**字段说明**：
- `tempSave`：`0` = 暂存，`1` = 已完成
- `answer`：`LinkedHashMap<questionId, value>`，value 类型随题型变化（字符串/数组/对象/数字）
- `metaInfo.clientInfo`：客户端信息，用于反作弊；小程序里 `remoteIp` 由后端从请求头解析，不用前端填
- `examInfo.questionScore`：仅考试模式需要，前端把每题得分回传（后端会二次校验）

**响应体**（[`PublicAnswerView`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicAnswerView.java)）：
```json
{
  "answerId": "答卷 ID，可用于后续查询/更新",
  "examScore": 85.0,
  "examRanking": 12,
  "questionScore": { "q1_id": 5.0 },
  "answer": { /* 回显提交的答案 */ },
  "createAt": "2026-09-17T10:05:00"
}
```

---

### 2.5 暂存答卷 · `POST /api/public/tempSaveAnswer`

**用途**：答题过程中定期保存草稿，仅支持问题随机模式。

**请求体**：同 `saveAnswer`，`tempSave=0`，`tempAnswer` 填当前已答内容。

**响应体**：无（HTTP 200 即成功）。

---

### 2.6 上传附件 · `POST /api/public/upload`

**用途**：题型为 `Upload` / `Signature` 时上传文件。

**请求格式**：`multipart/form-data`

**表单字段**（[`UploadFileRequest`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/UploadFileRequest.java)）：
| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `file` | File | ✅ | 文件本体 |
| `projectId` | String | ✅ | 问卷 id（用于隔离目录） |
| `questionId` | String | ❌ | 题目 id |
| `basePath` | String | ❌ | 存储基路径，一般传 projectId |
| `fileType` | int | ❌ | 1=图片 2=文件 3=签名（具体见源码枚举） |

**响应体**（[`FileView`](../server/shared/src/main/java/cn/surveyking/server/domain/dto)）：
```json
{
  "id": "attachment_id",
  "name": "xxx.jpg",
  "url": "/api/public/preview/attachment_id",
  "size": 12345
}
```

**小程序示例**：
```javascript
wx.uploadFile({
  url: 'https://api.dxx.zone/api/public/upload',
  filePath: tempFilePath,
  name: 'file',
  formData: {
    projectId: 'VEb4hf',
    questionId: 'q_upload_1',
    fileType: 1
  },
  success(res) {
    const data = JSON.parse(res.data);
    // 把 data.id 塞进 answer[questionId]
  }
});
```

---

### 2.7 预览附件 · `GET /api/public/preview/{attachmentId}`

**用途**：`<image src="...">` 或 `<a download>` 直接使用。

**响应**：二进制流，带 30 天 HTTP 缓存头。

**小程序**：直接把 URL 塞进 `<image>` 组件即可：
```xml
<image src="https://api.dxx.zone/api/public/preview/{{attachmentId}}" mode="aspectFit" />
```

---

### 2.8 加载公开查询 · `POST /api/public/loadQuery`

**用途**：查询自己历史答卷时先获取查询表单 schema。

**请求体**（[`PublicQueryRequest`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicQueryRequest.java)）：
```json
{ "id": "查询 id", "resultId": "可选，具体结果 id" }
```

**响应体**（[`PublicQueryVerifyView`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicQueryVerifyView.java)）：
```json
{
  "password": "如果需要密码，返回密码字段名",
  "schema": { /* SurveySchema，查询表单结构 */ }
}
```

---

### 2.9 获取公开查询结果 · `POST /api/public/getQueryResult`

**请求体**：`PublicQueryRequest`，`answer` 填查询表单的答案。

**响应体**（[`PublicQueryView`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicQueryView.java)）：
```json
{
  "schema": { /* 展示用的问卷 schema */ },
  "answers": [ /* PublicAnswerView 列表 */ ],
  "fieldPermission": { "q1_id": 1 }  // 1=可见 0=隐藏
}
```

---

### 2.10 加载字典 · `POST /api/public/loadDict`

**用途**：级联题、下拉题的动态数据源（例如省市区）。

**请求体**（[`PublicDictRequest`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicDictRequest.java)）：
```json
{
  "dictCode": "region",         // 字典编码，必填
  "search": "北京",              // 搜索关键字，可选
  "parentValue": "110000",      // 父级值，级联时用
  "cascaderLevel": 2,           // 级联层级
  "limit": 100                  // 最大条数
}
```

**响应体**（`List<PublicDictView>`）：
```json
[
  { "label": "北京市", "value": "110000" },
  { "label": "天津市", "value": "120000" }
]
```

---

### 2.11 加载考试结果 · `POST /api/public/loadExamResult`

**请求体**（[`PublicExamRequest`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicExamRequest.java)）：
```json
{ "id": "问卷 id", "answerId": "答卷 id" }
```

**响应体**（[`PublicExamResult`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicExamResult.java)）：
```json
{
  "name": "期末考试",
  "schema": { /* 完整问卷 schema，包含正确答案 */ },
  "examScore": 85.0,
  "metaInfo": { /* AnswerMetaInfo */ },
  "examInfo": { "questionScore": { "q1": 5.0 } },
  "answer": { /* 用户提交的答案 */ },
  "rank": 12
}
```

---

### 2.12 加载问卷关联结果 · `POST /api/public/loadLinkResult`

**用途**：题目之间有联动关系（选了 A 题某选项，B 题自动填入历史答案）。

**请求体**（[`PublicLinkRequest`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicLinkRequest.java)）：
```json
{
  "projectId": "VEb4hf",
  "questionId": "q1",
  "optionId": "opt_a",
  "value": "触发联动的输入值"
}
```

**响应体**（[`PublicLinkResult`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/PublicLinkResult.java)）：
```json
{
  "answer": {
    "q2_id": { "q2_sub_1": "值1", "q2_sub_2": "值2" }
  }
}
```

---

### 2.13 数据结构 · `SurveySchema`

**源码**：[`SurveySchema.java`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/SurveySchema.java)

```typescript
interface SurveySchema {
  id: string;                    // 题目 id
  title: string;                 // 题干
  description?: string;          // 说明
  type: QuestionType;            // 题型，见下表
  attribute: Attribute;          // 题目属性（必填、随机、逻辑等）
  dataSource?: DataSource[];     // 选项列表
  children?: SurveySchema[];     // 子题目（题组、分页）
  row?: Row[];                   // 矩阵题的行
  linkSurveys?: LinkSurvey[];    // 联动配置
  tags?: string[];               // 标签
}
```

**题型枚举 `QuestionType`（27 种）**：

| 分类 | 题型 | 说明 |
|---|---|---|
| **数据类型** | `FillBlank` | 单行填空 |
| | `Textarea` | 多行填空 |
| | `MultipleBlank` | 多项填空 |
| | `HorzBlank` | 横向填空 |
| | `Signature` | 手写签名 |
| | `Score` | 评分题 |
| | `Radio` | 单选 |
| | `Checkbox` | 多选 |
| | `Select` | 下拉 |
| | `Cascader` | 级联选择 |
| | `Upload` | 文件上传 |
| | `Nps` | NPS 打分 |
| | `Address` | 位置 |
| | `Barcode` | 条码/二维码 |
| | `Judge` | 判断题 |
| | `RichText` | 富文本题 |
| | `User` | 成员题（需登录） |
| | `Dept` | 部门题（需登录） |
| **矩阵类** | `MatrixAuto` | 自适应矩阵 |
| | `MatrixRadio` | 矩阵单选 |
| | `MatrixCheckbox` | 矩阵多选 |
| | `MatrixFillBlank` | 矩阵填空 |
| | `MatrixScore` | 矩阵评分 |
| | `MatrixNps` | 矩阵 NPS |
| **结构类型**（无值） | `Survey` | 问卷根节点 |
| | `QuestionSet` | 题组 |
| | `Pagination` | 分页 |
| | `Remark` | 备注/说明 |
| | `SplitLine` | 分割线 |
| | `Option` | 选项节点 |
| | `RandomSurvey` | 随机题组 |

**考试自动判分支持的题型**（`examType()`）：`FillBlank`、`Textarea`、`MultipleBlank`、`Radio`、`Checkbox`、`Select`、`HorzBlank`。

**小程序 MVP 建议先支持**：`Radio`、`Checkbox`、`FillBlank`、`Textarea`、`Select`、`Score`、`Nps`、`Upload`（覆盖 80% 场景）。

---

### 2.14 数据结构 · `ProjectSetting`

**源码**：[`ProjectSetting.java`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/ProjectSetting.java)

关键字段（答卷页会用到）：

```typescript
interface ProjectSetting {
  answerSetting: {
    progressBar: boolean;           // 显示进度条
    loginRequired: boolean;         // 需要登录
    questionNumber: boolean;        // 显示题号
    autoSave: boolean;              // 自动暂存
    initialValues: object;          // 默认值
    maxAnswers: number;             // 最大回收数
    endTime: number;                // 截止时间戳
    wechatOnly: boolean;            // 仅微信作答
    wechatUserInfo: boolean;        // 记录 openid/昵称/头像
    ipLimit: UniqueLimitSetting;    // IP 限制
    cookieLimit: UniqueLimitSetting;
    loginLimit: UniqueLimitSetting;
    whitelistLimit: UniqueLimitSetting;
    onePageOneQuestion: boolean;    // 一页一题
    answerSheetVisible: boolean;    // 答题卡
    whitelistType: number;          // 白名单类型
    triggerType: 'onInput' | 'onBlur' | 'onSubmit';
    copyEnabled: boolean;           // 允许复制
    defaultLocale: string;          // 默认语言
  };
  examSetting?: {
    exerciseMode: string;           // 练习模式
    maxSwitchScreenTimes: number;   // 最大切屏次数
    randomSurveyWrong: boolean;     // 随机错题
  };
  submittedSetting: {
    contentHtml: string;            // 提交后展示 HTML
    enableUpdate: boolean;          // 允许更新答案
    redirectUrl: string;            // 提交后跳转
    publicQuery: PublicQuery[];     // 公开查询配置
    answerAnalysis: boolean;        // 显示答案解析
    transcriptVisible: boolean;     // 显示成绩单
    rankVisible: boolean;           // 显示排行榜
  };
}
```

---

## 三、微信授权相关

### 3.1 微信公众号授权（现有能力，H5 场景）

**接口**：`POST /api/public/oauth/survey/wechat/start`

**请求体**（`SurveyWechatOAuthStartRequest`）：
```json
{
  "projectId": "VEb4hf",
  "redirect": "https://your-domain/s/VEb4hf"
}
```

**响应体**（`OAuthStartResponse`）：
```json
{
  "redirectUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?...",
  "flowCookie": "xxx"
}
```

**流程**：前端拿到 `redirectUrl` → 跳微信授权 → 微信回调 `/api/public/oauth/callback/wechat` → 后端种下 `survey-wechat` Cookie → 跳回 `redirect`。

⚠️ **小程序无法直接使用该流程**，因为：
1. 小程序 `wx.request` 不接收 `Set-Cookie`
2. 小程序内无法跳转微信 OAuth H5 页面

### 3.2 小程序端获取 openid 的推荐做法

**方案 A（推荐）**：**后端新增一个接口**（约 30 行代码）：

```java
// 新增到 OAuthApi.java
@PostMapping("/public/oauth/miniapp/login")
public MiniAppLoginView miniAppLogin(@RequestBody MiniAppLoginRequest request) {
    // 1. 调 https://api.weixin.qq.com/sns/jscode2session
    //    ?appid=xxx&secret=xxx&js_code={request.code}&grant_type=authorization_code
    // 2. 拿到 openid、session_key、unionid
    // 3. 生成 JWT token，写入 survey_wechat_identity 表（复用现有逻辑）
    // 4. 返回 { token, openid, expiresIn }
}
```

小程序端：
```javascript
wx.login({
  success: ({ code }) => {
    wx.request({
      url: 'https://api.dxx.zone/api/public/oauth/miniapp/login',
      method: 'POST',
      data: { code },
      success: ({ data }) => {
        wx.setStorageSync('token', data.token);
        wx.setStorageSync('openid', data.openid);
      }
    });
  }
});
```

后续所有 `/api/public/*` 请求 header 加：
```javascript
header: { 'Authorization': wx.getStorageSync('token') }
```

**方案 B**：不获取 openid，走匿名提交（问卷没设置 `wechatOnly` 时可用）。

---

## 四、后台登录接口（管理端小程序才需要）

### 4.1 登录 · `POST /api/user/public/login`

**请求体**（[`AuthRequest`](../server/shared/src/main/java/cn/surveyking/server/domain/dto/AuthRequest.java)）：
```json
{
  "username": "admin",
  "password": "<RSA 加密后的密码>",
  "captchaVerification": "<captcha/check 返回的验证结果>",
  "authType": "PWD"
}
```

⚠️ **密码必须 RSA 加密**，源码 [`UserApi.java L57`](../server/api/src/main/java/cn/surveyking/server/api/UserApi.java)：`RSAUtils.decrypt(request.getPassword())`。公钥需要从后端获取或硬编码（参考现有前端产物里的 `umi.*.js`）。

**响应**：
- Header `Authorization: <JWT token>`
- Header `Set-Cookie: <cookie>`

**小程序**：只取 Header 里的 token 存本地：
```javascript
wx.request({
  url: 'https://api.dxx.zone/api/user/public/login',
  method: 'POST',
  data: { username, password: rsaEncrypt(pwd), captchaVerification },
  success(res) {
    wx.setStorageSync('token', res.header.Authorization);
  }
});
```

### 4.2 验证码 · `GET /captcha/get`、`POST /captcha/check`

使用的是 [anji-plus captcha](https://gitee.com/anji-plus/captcha) 组件（滑块/点选验证码），接口协议参考其官方文档。

---

## 五、错误码与响应包装

**统一响应包装**（[`CustomResponseBodyAdvice.java`](../server/shared/src/main/java/cn/surveyking/server/core/mvc/advice/CustomResponseBodyAdvice.java)）：

⚠️ **实测确认**：所有 `/api/**` 接口的响应都会被自动包一层 `{code, data}`，**业务数据在 `data` 字段里**，不是直接返回 DTO。

**成功响应**：
```json
{
  "code": 200,
  "data": { /* 实际业务数据（PublicProjectView 等）*/ }
}
```

**失败响应**（[`GlobalExceptionHandler.java`](../server/shared/src/main/java/cn/surveyking/server/core/mvc/advice/GlobalExceptionHandler.java)）：

```json
{
  "code": 400,
  "message": "错误描述"
}
```

**小程序取值写法**：
```javascript
wx.request({
  url: 'https://api.dxx.zone/api/public/loadProject',
  method: 'POST',
  data: { id: 'VEb4hf' },
  success(res) {
    // res.data       → HTTP 响应体，即 { code, data }
    // res.data.data  → 真正的 PublicProjectView
    const project = res.data.data;
    console.log(project.survey.children); // 题目数组
  }
});
```

**小程序请求封装建议**：
```javascript
function api(path, data = {}, method = 'POST') {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://api.dxx.zone${path}`,
      method,
      data,
      header: {
        'content-type': 'application/json',
        'Authorization': wx.getStorageSync('token') || ''
      },
      success(res) {
        const body = res.data || {};
        if (res.statusCode === 200 && (!body.code || body.code === 200)) {
          resolve(body.data !== undefined ? body.data : body);
        } else {
          reject(new Error(body.message || `HTTP ${res.statusCode}`));
        }
      },
      fail: reject
    });
  });
}
```

---

## 六、小程序合法域名配置清单

微信小程序管理后台 → 开发管理 → 服务器域名，需要配置：

| 类型 | 域名 | 用途 |
|---|---|---|
| **request 合法域名** | `https://api.dxx.zone` | 所有 `/api/public/*` 调用 |
| **uploadFile 合法域名** | `https://api.dxx.zone` | `/api/public/upload` |
| **downloadFile 合法域名** | `https://api.dxx.zone` | `/api/public/preview/*` |
| **业务域名**（web-view 用） | `https://h5.dxx.zone` | 如果走 web-view 套壳方案 |

⚠️ 所有域名必须：
1. **HTTPS**（TLS 1.2+）
2. **ICP 备案**
3. **不带端口号**（默认 443）
4. **不能是 IP 或 localhost**

---

## 七、30 分钟验证清单

按顺序跑通以下 4 步，就能确认后端可用：

### Step 1（5 分钟）· 启动后端 + 建一份问卷
```bash
docker run -d --name surveyking -p 1991:1991 surveyking/surveyking:latest
# 浏览器打开 http://localhost:1991  admin/123456
# 创建一个最简单的问卷（1 道单选题），发布后拿到 shortId，例如 VEb4hf
```

### Step 2（5 分钟）· curl 验证 loadProject
```bash
curl -X POST http://localhost:1991/api/public/loadProject \
  -H 'Content-Type: application/json' \
  -d '{"id":"VEb4hf"}'
# 期望：返回 JSON，包含 survey / setting / name
```

### Step 3（10 分钟）· 小程序开发工具里跑通 wx.request
1. 微信开发者工具新建"小程序"项目
2. 关闭"域名校验"（本地测试用）
3. `app.js` 里加：
   ```javascript
   wx.request({
     url: 'http://localhost:1991/api/public/loadProject',
     method: 'POST',
     data: { id: 'VEb4hf' },
     success: console.log
   });
   ```
4. 期望：控制台打出问卷 JSON

### Step 4（10 分钟）· 跑通 saveAnswer
```javascript
wx.request({
  url: 'http://localhost:1991/api/public/saveAnswer',
  method: 'POST',
  data: {
    projectId: 'VEb4hf',
    answer: { '<第一题的 id>': '<选项 id>' },
    tempSave: 1,
    metaInfo: { clientInfo: { agent: 'wx-mini-program', deviceType: 'mobile' } }
  },
  success: console.log
});
// 期望：返回 { answerId, ... }，且后台"数据"页能看到新答卷
```

跑通这 4 步后，你就可以进入下一阶段（web-view 套壳 或 Taro 原生重写）了。

---

## 八、后续扩展接口（管理端）

如果小程序还要做"我的问卷"、"答卷统计"等管理功能，会用到：

| 路径 | 用途 |
|---|---|
| `GET /api/project/list` | 我的项目列表 |
| `GET /api/project` | 项目详情 |
| `POST /api/project/create` | 创建项目 |
| `GET /api/answer/list` | 答卷列表 |
| `GET /api/answer/download` | 答卷导出 |
| `GET /api/report/*` | 报表数据 |
| `GET /api/dashboard/*` | 首页统计 |

**这些都需要 JWT**，调用前必须先 `POST /api/user/public/login` 拿到 token，然后每个请求 header 加 `Authorization: <token>`。

具体入参出参可查阅：
- [`ProjectApi.java`](../server/api/src/main/java/cn/surveyking/server/api/ProjectApi.java)（280 行）
- [`AnswerApi.java`](../server/api/src/main/java/cn/surveyking/server/api/AnswerApi.java)（155 行）
- [`ReportApi.java`](../server/api/src/main/java/cn/surveyking/server/api/ReportApi.java)
- [`DashboardApi.java`](../server/api/src/main/java/cn/surveyking/server/api/DashboardApi.java)

---

## 附录 A · 源码位置速查

| 内容 | 路径 |
|---|---|
| 所有 Controller | [`server/api/src/main/java/cn/surveyking/server/api/`](../server/api/src/main/java/cn/surveyking/server/api) |
| 所有 DTO | [`server/shared/src/main/java/cn/surveyking/server/domain/dto/`](../server/shared/src/main/java/cn/surveyking/server/domain/dto) |
| Service 实现 | [`server/rdbms/src/main/java/cn/surveyking/server/impl/`](../server/rdbms/src/main/java/cn/surveyking/server/impl) |
| 安全配置 | [`WebSecurityConfig.java`](../server/shared/src/main/java/cn/surveyking/server/core/config/WebSecurityConfig.java) |
| 应用配置 | [`application.yml`](../server/api/src/main/resources/application.yml) |
| 前端打包产物 | [`server/api/src/main/resources/static/`](../server/api/src/main/resources/static)（可反查接口调用示例） |

## 附录 B · 已压缩产物中可挖掘的信息

`server/api/src/main/resources/static/` 里的 `.async.js` 文件虽然压缩过，但可以搜索到：
- 所有 API 调用路径（grep `/api/public/`）
- 请求参数结构（grep `loadProject`、`saveAnswer` 等函数名）
- 前端渲染逻辑（Formily 组件树）

命令示例：
```bash
grep -oE '"/api/public/[a-zA-Z]+"' server/api/src/main/resources/static/*.js | sort -u
```

这对**逆向理解字段含义**很有帮助，尤其是 `SurveySchema.attribute` 里各种逻辑配置的字段名。

---

**文档版本**：v1.0 · 基于 SurveyKing v1.13.0 源码整理
