const fs = require('fs');

const css = `/* Survey Workspace Global Layout */
.survey-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid var(--border-color);
  padding: 0 24px;
  height: 54px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.survey-nav-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.survey-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: var(--radius-base);
  font-size: 14px;
  color: var(--text-secondary);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  background: none;
  text-decoration: none;
}

.survey-tab-btn:hover {
  color: var(--primary);
  background: #f5f5f5;
}

.survey-tab-btn.active {
  color: var(--primary);
  background: var(--primary-bg);
  border-color: #91d5ff;
  font-weight: 500;
}

.survey-tab-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

/* ====================================================
   Setting View Styles (对齐官方 Ant Design 样式)
   ==================================================== */
.setting-wrapper {
  background-color: #f0f2f5;
  padding: 24px;
  min-height: calc(100vh - 54px);
}

.setting-grid-row {
  display: flex;
  flex-wrap: wrap;
  margin: -12px;
}

.setting-col {
  padding: 12px;
  flex: 0 0 25%;
  max-width: 25%;
  box-sizing: border-box;
}

@media (max-width: 1200px) {
  .setting-col {
    flex: 0 0 33.333%;
    max-width: 33.333%;
  }
}

@media (max-width: 768px) {
  .setting-col {
    flex: 0 0 100%;
    max-width: 100%;
  }
}

.ant-card.answer-setting {
  background: #fff;
  border-radius: 2px;
  border: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.85);
}

.ant-card.answer-setting .ant-card-head {
  padding: 0 24px;
  min-height: 56px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ant-card.answer-setting .ant-card-head-title {
  font-size: 16px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.85);
  padding: 16px 0;
}

.ant-card.answer-setting .ant-card-extra {
  margin-left: auto;
  padding: 16px 0;
}

.ant-card.answer-setting .ant-card-body {
  padding: 24px;
  flex: 1;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item-switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 32px;
  gap: 12px;
}

.setting-item-switch > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(0, 0, 0, 0.85);
  font-size: 14px;
}

.setting-prompt {
  color: #8c8c8c;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  font-size: 14px;
}

.setting-prompt svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

/* Ant Design Switch 绝对尺寸与标准对齐 */
.ant-switch {
  margin: 0;
  padding: 0;
  color: rgba(0, 0, 0, 0.85);
  font-size: 14px;
  line-height: 22px;
  list-style: none;
  position: relative;
  display: inline-block;
  box-sizing: border-box;
  min-width: 44px;
  width: 44px;
  height: 22px;
  vertical-align: middle;
  background-color: rgba(0, 0, 0, 0.25);
  border: 0;
  border-radius: 100px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  flex-shrink: 0;
}

.ant-switch:focus {
  outline: 0;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.ant-switch.ant-switch-checked {
  background-color: #1890ff;
}

.ant-switch-handle {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  transition: all 0.2s ease-in-out;
}

.ant-switch-handle::before {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: #fff;
  border-radius: 9px;
  box-shadow: 0 2px 4px 0 rgba(0, 35, 11, 0.2);
  transition: all 0.2s ease-in-out;
  content: '';
}

.ant-switch.ant-switch-checked .ant-switch-handle {
  left: calc(100% - 20px);
}

/* Link input in Share Card */
.open-target-box {
  display: flex;
  align-items: center;
  width: 100%;
}

.open-target-box input {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  font-size: 13px;
}

.open-target-box button {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  white-space: nowrap;
}

/* Administrator list */
.admin-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.admin-avatar-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #1890ff;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

/* ====================================================
   Data Table View Styles
   ==================================================== */
.data-container {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 54px);
  background: #fff;
  box-sizing: border-box;
}

.data-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.data-tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.data-table-scroll {
  flex: 1;
  overflow: auto;
  margin-top: 12px;
  border: 1px solid var(--border-color);
}

/* ====================================================
   Report View Styles
   ==================================================== */
.report-container {
  max-width: 1000px;
  margin: 24px auto;
  padding: 0 16px;
}

.report-header {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-base);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.report-question-card {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-base);
  margin-bottom: 20px;
  padding: 20px 24px;
}

.report-question-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
}

.chart-bar-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.chart-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.chart-bar-label {
  width: 120px;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-bar-track {
  flex: 1;
  background: #f0f0f0;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.chart-bar-fill {
  background: var(--primary);
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.chart-bar-value {
  width: 70px;
  font-size: 12px;
  color: var(--text-muted);
}

/* ====================================================
   Editor View Styles
   ==================================================== */
.editor-layout {
  display: flex;
  height: calc(100vh - 54px);
  overflow: hidden;
}

.editor-sidebar {
  width: 280px;
  background: #fff;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
}

.question-palette-category {
  padding: 12px 16px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.question-palette-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 8px 16px 16px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  background: #fafafa;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.palette-item:hover {
  background: #e6f7ff;
  border-color: #91d5ff;
  color: var(--primary);
}

.editor-canvas-wrap {
  flex: 1;
  background: #f0f2f5;
  overflow-y: auto;
  padding: 24px 32px 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.editor-canvas {
  width: min(800px, 100%);
  background: #fff;
  min-height: 600px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  padding: 40px 48px;
}

.survey-title-editable {
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  outline: none;
  border-bottom: 2px dashed transparent;
  padding: 4px 8px;
  margin-bottom: 8px;
}

.survey-title-editable:focus {
  border-bottom-color: var(--primary);
  background: #fafafa;
}

.survey-desc-editable {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
  outline: none;
  border-bottom: 2px dashed transparent;
  padding: 4px 8px;
  margin-bottom: 32px;
}

.survey-desc-editable:focus {
  border-bottom-color: var(--primary);
  background: #fafafa;
}

.question-block {
  padding: 16px 20px;
  border: 1px solid transparent;
  border-radius: 4px;
  margin-bottom: 16px;
  position: relative;
  transition: all 0.2s;
}

.question-block:hover {
  background: #fafafa;
  border-color: #e8e8e8;
}

.question-block.active {
  border-color: var(--primary);
  background: #f0f7ff;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 12px;
}

.question-options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.question-block-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: none;
  gap: 8px;
}

.question-block:hover .question-block-actions,
.question-block.active .question-block-actions {
  display: flex;
}
`;

fs.writeFileSync('client/survey/survey.css', css);
console.log('Successfully written client/survey/survey.css');
