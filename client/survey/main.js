import { request } from '../shared/api.js';
import { showToast } from '../shared/layout.js';
import * as SettingModule from './setting.js';
import * as DataModule from './data.js';
import * as ReportModule from './report.js';
import * as EditorModule from './editor.js';

// Parse project ID and tab from pathname: /survey/:id/:tab
const pathParts = window.location.pathname.split('/').filter(Boolean);
const projectId = pathParts[1] || '';
const rawTab = pathParts[2] || 'edit';
const currentTab = ['edit', 'setting', 'data', 'report'].includes(rawTab) ? rawTab : 'edit';

let currentProject = null;

// Tab SVGs matching screenshot
const navIcons = {
  edit: `<svg viewBox="64 64 896 896" focusable="false"><path d="M257.7 752c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9a9.96 9.96 0 000-14.1L694.9 114.9a9.96 9.96 0 00-14.1 0L257 538.7c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2a33.5 33.5 0 009.4 29.8c6.6 6.4 14.9 10 23.6 10zm161.7-65l-123 21.6 21.6-123 371-371 101.4 101.3-371 371.1zM880 836H144c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h736c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8z"></path></svg>`,
  setting: `<svg viewBox="64 64 896 896" focusable="false"><path d="M924.8 625.7l-65.5-56c3.1-19 4.7-38.4 4.7-57.7s-1.6-38.8-4.7-57.7l65.5-56a32.03 32.03 0 007.7-35.2l-64.4-111.6c-5.3-9.2-14.7-15.1-25.3-16.1l-84.3-8.2c-28.7-25-62.2-44.5-98.8-57.2l-22.9-81.9c-3.1-11-12.2-19.1-23.5-21.6L482.3 64c-11.4 0-22 6.4-27.3 16.6l-64.4 111.6c-3.1 5.3-4.1 11.6-2.9 17.5l22.9 81.9c-36.6 12.7-70.1 32.2-98.8 57.2l-84.3 8.2c-10.6 1-20 6.9-25.3 16.1l-64.4 111.6a32.03 32.03 0 007.7 35.2l65.5 56c-3.1 19-4.7 38.4-4.7 57.7s1.6 38.8 4.7 57.7l-65.5 56a32.03 32.03 0 00-7.7 35.2l64.4 111.6c5.3 9.2 14.7 15.1 25.3 16.1l84.3 8.2c28.7 25 62.2 44.5 98.8 57.2l22.9 81.9c3.1 11 12.2 19.1 23.5 21.6l128.7 58.7c11.4 0 22-6.4 27.3-16.6l64.4-111.6c3.1-5.3 4.1-11.6 2.9-17.5l-22.9-81.9c36.6-12.7 70.1-32.2 98.8-57.2l84.3-8.2c10.6-1 20-6.9 25.3-16.1l64.4-111.6a32.03 32.03 0 00-7.7-35.2zM512 704c-106 0-192-86-192-192s86-192 192-192 192 86 192 192-86 192-192 192z"></path></svg>`,
  table: `<svg viewBox="64 64 896 896" focusable="false"><path d="M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zm-40 208H676V232h212v136zm0 224H676V456h212v136zM348 232h260v136H348V232zm0 224h260v136H348V456zM136 232h144v136H136V232zm0 224h144v136H136V456zm0 336v-136h144v136H136zm212 0v-136h260v136H348zm528 0H676v-136h212v136z"></path></svg>`,
  report: `<svg viewBox="64 64 896 896" focusable="false"><path d="M888 792H200V168c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v688c0 4.4 3.6 8 8 8h752c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm-600-80h56c4.4 0 8-3.6 8-8V520c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v184c0 4.4 3.6 8 8 8zm152 0h56c4.4 0 8-3.6 8-8V384c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v320c0 4.4 3.6 8 8 8zm152 0h56c4.4 0 8-3.6 8-8V464c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v240c0 4.4 3.6 8 8 8zm152 0h56c4.4 0 8-3.6 8-8V280c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v424c0 4.4 3.6 8 8 8z"></path></svg>`,
  home: `<svg viewBox="64 64 896 896" focusable="false"><path d="M946.5 505L534.6 93.4a31.93 31.93 0 00-45.2 0L77.5 505c-12 12-18.8 28.3-18.8 45.3 0 35.3 28.7 64 64 64h43.4V908c0 17.7 14.3 32 32 32H360c17.7 0 32-14.3 32-32V656h240v252c0 17.7 14.3 32 32 32h161.9c17.7 0 32-14.3 32-32V614.3h43.4c17 0 33.3-6.7 45.3-18.8 24.9-25 24.9-65.5-.1-90.5z"></path></svg>`
};

async function loadProjectDetail() {
  try {
    const res = await request(`/project?id=${projectId}`);
    currentProject = res?.data || res;
    document.title = `${currentProject?.name || '项目'} - 卷王问卷考试系统`;
    renderSurveyWorkspace();
  } catch (err) {
    document.querySelector('#app').innerHTML = `
      <div style="text-align:center;padding:80px 20px;">
        <h3 style="color:#ff4d4f;">项目加载失败：${err.message}</h3>
        <a class="btn btn-primary" href="/project" style="margin-top:16px;">返回我的项目</a>
      </div>
    `;
  }
}

function renderSurveyWorkspace() {
  const app = document.querySelector('#app');
  if (!app) return;

  app.innerHTML = `
    <!-- Top Survey Sub-navigation -->
    <header class="survey-header-bar">
      <div class="survey-nav-tabs">
        <a class="survey-tab-btn ${currentTab === 'edit' ? 'active' : ''}" href="/survey/${projectId}/edit?mode=${currentProject.mode || 'survey'}">
          ${navIcons.edit}
          <span>编辑</span>
        </a>
        <a class="survey-tab-btn ${currentTab === 'setting' ? 'active' : ''}" href="/survey/${projectId}/setting?mode=${currentProject.mode || 'survey'}">
          ${navIcons.setting}
          <span>设置</span>
        </a>
        <a class="survey-tab-btn ${currentTab === 'data' ? 'active' : ''}" href="/survey/${projectId}/data?mode=${currentProject.mode || 'survey'}">
          ${navIcons.table}
          <span>数据</span>
        </a>
        <a class="survey-tab-btn ${currentTab === 'report' ? 'active' : ''}" href="/survey/${projectId}/report?mode=${currentProject.mode || 'survey'}">
          ${navIcons.report}
          <span>报表</span>
        </a>
      </div>

      <div>
        <a class="btn btn-sm" href="/project">
          ${navIcons.home}
          <span>项目</span>
        </a>
      </div>
    </header>

    <div id="survey-content"></div>
  `;

  const container = document.querySelector('#survey-content');
  if (currentTab === 'edit') {
    EditorModule.renderEditor(container, currentProject, loadProjectDetail);
  } else if (currentTab === 'setting') {
    SettingModule.renderSetting(container, currentProject, loadProjectDetail);
  } else if (currentTab === 'data') {
    DataModule.renderData(container, currentProject);
  } else if (currentTab === 'report') {
    ReportModule.renderReport(container, currentProject);
  }
}

loadProjectDetail();
