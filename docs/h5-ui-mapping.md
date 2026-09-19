# H5 页面 → 微信小程序 UI 映射表

> 数据来源：`miniapp-demo/snapshots/huaiyu-VEb4hf.html`（CDP 抓取 `https://test.huaiyu.cn/s/VEb4hf` 渲染后的完整 DOM）
> 抓取工具：`miniapp-demo/tools/cdp-dump.py` + `tools/cdp-shot.py`
> 用途：小程序端 UI 与 H5 端视觉/交互对齐的**唯一参考基准**

---

## 一、H5 用到的 UI 库

| 库 | 类名前缀 | 出现次数 | 用途 |
|---|---|---|---|
| **Ant Design (Web)** | `ant-*` | 主体 | Form/Input/Rate/Row/Col 等 |
| **antd-mobile** | `adm-*` | 20+ | Space / Selector（Radio/Checkbox 胶囊）|
| **SurveyKing 自定义** | `survey-antdMobile-*` / `question-*` / `nps-*` / `option-*` / `checkbtn-*` / `pe-view` | 100+ | 问卷容器、题号、必答星、NPS 按钮 |

## 二、H5 DOM 顶层结构

```html
<div id="root">
  <div class="survey-antdMobile">
    <div class="survey-antdMobile-header">    <!-- 顶部图片/标题 -->
    <div class="survey-antdMobile-body">
      <div class="survey-antdMobile-body-question">    <!-- 每道题容器 -->
        <div class="survey-antdMobile-body-question-header">
          <span class="question-required">*</span>     <!-- 必答星 -->
          <span class="question-seq">1</span>          <!-- 题号 -->
          <span class="question-title">单选题</span>
        </div>
        <div class="survey-antdMobile-body-question-option">
          <!-- 具体题型组件 -->
        </div>
      </div>
      ...
    </div>
    <div class="survey-antdMobile-footer">    <!-- 提交按钮 -->
  </div>
</div>
```

**小程序对应结构**（`pages/index/index.wxml`）：
```xml
<view class="card question">
  <view class="q-title">
    <text class="q-required">*</text>
    <text class="q-index">1.</text>
    <text class="q-text">单选题</text>
  </view>
  <!-- 具体题型组件 -->
</view>
```

## 三、21 种题型逐个映射

### 3.1 选择题类

| 题型 | H5 组件 | H5 类名 | 小程序实现 | 视觉要点 |
|---|---|---|---|---|
| **Radio** 单选 | antd-mobile `Selector` | `adm-selector` / `adm-selector-item` | `<view class="selector">` + `bindtap="onRadioTap"` | 胶囊按钮，选中：`background:#e6f4ff; border-color:#1890ff; color:#1890ff` |
| **Checkbox** 多选 | antd-mobile `Selector multiple` | `adm-selector` + `checkbtn-group` | `<view class="selector">` + `bindtap="onCheckboxTap"` | 同 Radio，选中项右上角加 `✓` 角标 |
| **Select** 下拉 | 原生 `<select>` | `native-select` | `<picker mode="selector">` | 灰底、右侧 `▼` 箭头 |

### 3.2 填空题类

| 题型 | H5 组件 | H5 类名 | 小程序实现 |
|---|---|---|---|
| **FillBlank / Input** 单行 | antd `Input` | `ant-input` / `ant-input-affix-wrapper` | `<input class="input">` |
| **Textarea** 多行 | antd `Input.TextArea` | `ant-input` (textarea) | `<textarea class="textarea">` |
| **MultipleBlank** 多项填空 | 多个 Input + label | `question-item` × N | `<view class="multi-field">` × N |
| **HorzBlank** 横向填空 | HTML 内容 + inline Input | `pe-view` + `ant-input` | `<view class="horz-field">` |

### 3.3 评分题类

| 题型 | H5 组件 | H5 类名 | 小程序实现 | 视觉要点 |
|---|---|---|---|---|
| **Score** 评分 | antd `Rate` | `ant-rate` / `ant-rate-star` / `anticon-star` | `<view class="rate">` + 5 颗 `★` | 未选：`#d9d9d9`，选中：`#fadb14`（antd 默认黄），带 `text-shadow` |
| **Nps** 推荐度 | 自定义 | `nps-item` × 11 | `<view class="nps">` + `.nps-row` + `.nps-item` × 11 | 一排 0-10 按钮，下方两端标签「不可能 / 极有可能」，选中：蓝底白字 |

### 3.4 矩阵题类

| 题型 | H5 组件 | 小程序实现 |
|---|---|---|
| **MatrixRadio** | Table + Radio | `<view class="matrix">` + `scroll-view scroll-x` + `radio` |
| **MatrixCheckbox** | Table + Checkbox | 同上 + `checkbox` |
| **MatrixFillBlank** | Table + Input | `<view class="matrix-fill-row">` + `input` |
| **MatrixAuto** 自增表格 | 动态行 + Input/Select | `<view class="auto-row">` + 「➕ 添加一行」按钮 |

### 3.5 特殊题类

| 题型 | H5 组件 | H5 类名 | 小程序实现 | 备注 |
|---|---|---|---|---|
| **Cascader** 级联 | 多个 `<select>` 或 antd Cascader | `native-select` × N | `<picker>` × N（`cascaderDepth()` 探测层级）| 依赖 `dataSource` 树形字典 |
| **Province/City/County** 省市县 | `native-select` × 3 | 同上 | 同 Cascader（dataSource = 全国省市县字典）| 34 省份列表在 H5 里已完全展开 |
| **Ethnicity** 民族 | `native-select` | 同上 | `<picker mode="selector">`（children = 56 民族）| 已在 Select 分支覆盖 |
| **Date** 日期 | antd `DatePicker` | `ant-picker` | `<picker mode="date">` | |
| **Time** 时间 | antd `TimePicker` | `ant-picker` | `<picker mode="time">` | |
| **Barcode / Scan** 扫码 | 摄像头调用 | — | `<button bindtap="onScanCode">` → `wx.scanCode` | 小程序原生 API，H5 用 getUserMedia |
| **Location** 位置 | 地图选点 | — | `wx.getLocation` + `<map>` 组件 | **待实现（C3）** |
| **Signature** 签名 | Canvas 手写板 | 弹窗「点击签名 / 确认签名 / 重置 / 取消」 | `<canvas>` + `bindtouchstart/move/end` | **待实现（C1）** |
| **User / Dept** 成员部门 | 需要登录后端接口 | — | `<input>` MVP 简化 | 完整实现要 JWT |

## 四、通用视觉规范（H5 → WXSS）

| 元素 | H5 CSS | 小程序 WXSS |
|---|---|---|
| 卡片背景 | `#fff` + `border-radius: 8px` + `box-shadow` | `.card { background:#fff; border-radius:16rpx; padding:32rpx; margin-bottom:24rpx; }` |
| 主题色 | `#1890ff`（antd 默认蓝）| 同 |
| 选中背景 | `#e6f4ff` | 同 |
| 必答星 | `.question-required { color:#ff4d4f }` | `.q-required { color:#f5222d }` |
| 题号 | `.question-seq` 灰色小字 | `.q-index` 同 |
| 输入框 | `.ant-input { border:1px solid #d9d9d9; border-radius:6px; padding:8px 12px }` | `.input { border:1rpx solid #d9d9d9; border-radius:8rpx; padding:18rpx 22rpx }` |
| 错误提示 | antd Form `.ant-form-item-explain-error` 红字 | `.q-error { color:#f5222d; font-size:24rpx }` |
| 提交按钮 | antd `Button type="primary"` | `.big-btn.submit { background:#52c41a; color:#fff }` |

## 五、类名对照速查

| H5 类名（出现次数）| 含义 | 小程序对应类 |
|---|---|---|
| `survey-antdMobile-body-question` (25) | 每题容器 | `.card.question` |
| `survey-antdMobile-body-question-header` (24) | 题头（题号+标题+必答星） | `.q-title` |
| `survey-antdMobile-body-question-option` (5) | 选项区 | 各题型根 view |
| `question-seq` (24) | 题号 | `.q-index` |
| `question-required` (23) | 必答星 `*` | `.q-required` |
| `question-item` (7) | 子题项 | `.multi-field` / `.horz-field` |
| `question-sub-title` (6) | 子题标题 | `.multi-label` / `.horz-label` |
| `adm-selector` (12) | Radio/Checkbox 胶囊容器 | `.selector` |
| `adm-selector-item` (8) | 单个胶囊 | `.selector-item` |
| `adm-space` (20) | antd-mobile 间距容器 | `.selector { display:flex; gap:16rpx }` |
| `ant-rate` (21) | Score 星星容器 | `.rate` |
| `ant-rate-star` (5) | 单颗星 | `.rate-star` |
| `anticon-star` (10) | 星星图标（每颗 2 层：first/second 支持半星）| `★` 字符 |
| `nps-item` (11) | NPS 0-10 按钮 | `.nps-item` |
| `native-select` (18) | 原生下拉（省市县/民族/日期）| `<picker>` |
| `ant-input` (38) | 文本输入 | `.input` / `.textarea` |
| `ant-input-affix-wrapper` (5) | 带前后缀的输入框 | 未实现（可用 `.input-prefix`）|
| `option-box` (6) | 选项外框 | `.selector` |
| `option-item` (5) | 选项 | `.selector-item` |
| `checkbtn-group` (4) | Checkbox 按钮组 | `.selector`（复用）|
| `fixWidth` (4) | 固定宽度容器 | 未特别实现 |
| `pe-view` (49) | SurveyKing 页面元素容器 | 未对应（可忽略）|

## 六、验证方法

1. **DOM 对比**：`bash miniapp-demo/tools/snapshot-huaiyu.sh` 重新抓取 H5 DOM，与小程序 `wx.getSystemInfo` 后的截图逐题对照
2. **视觉对比**：打开 `miniapp-demo/snapshots/huaiyu-VEb4hf.png`（414×4596 长图），旁边开微信开发者工具的模拟器，逐题比对
3. **交互对比**：H5 里 Score 星星点击后颜色变化、NPS 按钮选中效果、Checkbox 胶囊选中效果，小程序应一致

## 七、TODO / 已知差异

- [ ] **C1 Signature**：H5 有独立弹窗+签名画板，小程序需实现 `<canvas>` 手写 + `wx.canvasToTempFilePath` 上传
- [ ] **C3 Location**：H5 用地图组件选点，小程序需 `wx.getLocation` + `<map>` 展示
- [ ] **C2 Scan**：已实现 `wx.scanCode`，但需检查 H5 是否支持"从相册选图识别二维码"
- [ ] **半星评分**：H5 的 `ant-rate-star-first/second` 支持半星（0.5 分），小程序目前只支持整星
- [ ] **输入框前后缀**：H5 `ant-input-prefix` 支持输入框内嵌图标（如手机号前的 📱），小程序未实现
- [ ] **省市县 3 级联动**：H5 是 3 个独立 `native-select` 联动，小程序目前用 Cascader 分支的多 picker，需验证联动是否正确

---

**最后更新**：2026-09-17
**数据基准**：`https://test.huaiyu.cn/s/VEb4hf` 渲染后 DOM（54686 字节）+ 长截图（480KB, 414×4596）
