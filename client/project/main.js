import { request } from '../shared/api.js';
import { initLayout, showModal, showToast } from '../shared/layout.js';

let viewMode = 'grid'; // 'grid' | 'table'
let projectList = [];
let folderList = [];
let searchText = '';
let activeDropdownProjectId = null;

// Ant Design SVGs matching user screenshot
const icons = {
  edit: `<svg viewBox="64 64 896 896" focusable="false"><path d="M257.7 752c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9a9.96 9.96 0 000-14.1L694.9 114.9a9.96 9.96 0 00-14.1 0L257 538.7c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2a33.5 33.5 0 009.4 29.8c6.6 6.4 14.9 10 23.6 10zm161.7-65l-123 21.6 21.6-123 371-371 101.4 101.3-371 371.1zM880 836H144c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h736c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8z"></path></svg>`,
  table: `<svg viewBox="64 64 896 896" focusable="false"><path d="M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zm-40 208H676V232h212v136zm0 224H676V456h212v136zM348 232h260v136H348V232zm0 224h260v136H348V456zM136 232h144v136H136V232zm0 224h144v136H136V456zm0 336v-136h144v136H136zm212 0v-136h260v136H348zm528 0H676v-136h212v136z"></path></svg>`,
  report: `<svg viewBox="64 64 896 896" focusable="false"><path d="M888 792H200V168c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v688c0 4.4 3.6 8 8 8h752c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm-600-80h56c4.4 0 8-3.6 8-8V520c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v184c0 4.4 3.6 8 8 8zm152 0h56c4.4 0 8-3.6 8-8V384c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v320c0 4.4 3.6 8 8 8zm152 0h56c4.4 0 8-3.6 8-8V464c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v240c0 4.4 3.6 8 8 8zm152 0h56c4.4 0 8-3.6 8-8V280c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v424c0 4.4 3.6 8 8 8z"></path></svg>`,
  setting: `<svg viewBox="64 64 896 896" focusable="false"><path d="M924.8 625.7l-65.5-56c3.1-19 4.7-38.4 4.7-57.7s-1.6-38.8-4.7-57.7l65.5-56a32.03 32.03 0 007.7-35.2l-64.4-111.6c-5.3-9.2-14.7-15.1-25.3-16.1l-84.3-8.2c-28.7-25-62.2-44.5-98.8-57.2l-22.9-81.9c-3.1-11-12.2-19.1-23.5-21.6L482.3 64c-11.4 0-22 6.4-27.3 16.6l-64.4 111.6c-3.1 5.3-4.1 11.6-2.9 17.5l22.9 81.9c-36.6 12.7-70.1 32.2-98.8 57.2l-84.3 8.2c-10.6 1-20 6.9-25.3 16.1l-64.4 111.6a32.03 32.03 0 007.7 35.2l65.5 56c-3.1 19-4.7 38.4-4.7 57.7s1.6 38.8 4.7 57.7l-65.5 56a32.03 32.03 0 00-7.7 35.2l64.4 111.6c5.3 9.2 14.7 15.1 25.3 16.1l84.3 8.2c28.7 25 62.2 44.5 98.8 57.2l22.9 81.9c3.1 11 12.2 19.1 23.5 21.6l128.7 58.7c11.4 0 22-6.4 27.3-16.6l64.4-111.6c3.1-5.3 4.1-11.6 2.9-17.5l-22.9-81.9c36.6-12.7 70.1-32.2 98.8-57.2l84.3-8.2c10.6-1 20-6.9 25.3-16.1l64.4-111.6a32.03 32.03 0 00-7.7-35.2zM512 704c-106 0-192-86-192-192s86-192 192-192 192 86 192 192-86 192-192 192z"></path></svg>`,
  ellipsis: `<svg viewBox="64 64 896 896" focusable="false"><path d="M176 512a112 112 0 10224 0 112 112 0 10-224 0zm336 0a112 112 0 10224 0 112 112 0 10-224 0zm336 0a112 112 0 10224 0 112 112 0 10-224 0z"></path></svg>`
};

async function loadProjects() {
  const container = document.querySelector('#project-content');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:#8c8c8c;">加载中...</div>';

  try {
    const query = new URLSearchParams({
      current: 1,
      pageSize: 50,
      ...(searchText ? { name: searchText } : {})
    });
    const [res, folders] = await Promise.all([
      request(`/project/list?${query.toString()}`),
      request('/project/list?mode=folder&current=1&pageSize=100').catch(() => ({ list: [] }))
    ]);
    projectList = res?.records || res?.list || (Array.isArray(res) ? res : []);
    folderList = folders?.records || folders?.list || (Array.isArray(folders) ? folders : []);
    renderProjects();
  } catch (err) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#ff4d4f;">加载失败：${err.message}</div>`;
  }
}

function renderProjects() {
  const container = document.querySelector('#project-content');
  if (!container) return;

  if (projectList.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:60px 20px;color:#8c8c8c;">
        <div style="font-size:36px;margin-bottom:12px;">📁</div>
        <p>当前还没有创建问卷</p>
        <button class="btn btn-primary" id="empty-create-btn" type="button">立即创建</button>
      </div>
    `;
    container.querySelector('#empty-create-btn')?.addEventListener('click', handleCreate);
    return;
  }

  if (viewMode === 'grid') {
    container.innerHTML = `
      <div class="project-grid">
        ${projectList.map((p) => {
          const isSurvey = p.mode === 'survey' || !p.mode;
          const status = p.setting?.status ?? p.status ?? 1;
          const isCollecting = status === 1;
          const statusText = isCollecting ? '收集中' : '已停止';
          const statusTag = isCollecting ? 'tag-green' : 'tag-orange';
          const isOpenDropdown = activeDropdownProjectId === p.id;

          return `
            <div class="project-card" data-id="${p.id}">
              <div class="card-header" onclick="window.location.assign('/survey/${p.id}/edit?mode=${p.mode || 'survey'}')">
                <div class="card-title-group">
                  <h4 class="card-title" title="${p.name || '未命名'}">${p.name || '未命名'}</h4>
                  <div class="card-meta">
                    <span class="tag ${statusTag}">${statusText}</span>
                    <span class="tag tag-blue">${isSurvey ? '问卷' : '考试'}</span>
                  </div>
                </div>
              </div>
              <div class="card-body" onclick="window.location.assign('/survey/${p.id}/data?mode=${p.mode || 'survey'}')">
                <div class="stat-item">
                  <span class="stat-label">收集数据</span>
                  <span class="stat-value">${p.total ?? 0}</span>
                </div>
                <div class="stat-item" style="text-align:right;">
                  <span class="stat-label">创建时间</span>
                  <span style="font-size:12px;color:#8c8c8c;">${p.createAt ? new Date(p.createAt).toLocaleDateString() : '—'}</span>
                </div>
              </div>

              <!-- 5 Round Action Buttons matching Screenshot -->
              <div class="card-actions-bar">
                <a class="action-circle-btn" href="/survey/${p.id}/edit?mode=${p.mode || 'survey'}" title="编辑" onclick="event.stopPropagation();">
                  ${icons.edit}
                </a>
                <a class="action-circle-btn" href="/survey/${p.id}/data?mode=${p.mode || 'survey'}" title="数据" onclick="event.stopPropagation();">
                  ${icons.table}
                </a>
                <a class="action-circle-btn" href="/survey/${p.id}/report?mode=${p.mode || 'survey'}" title="报表" onclick="event.stopPropagation();">
                  ${icons.report}
                </a>
                <a class="action-circle-btn" href="/survey/${p.id}/setting?mode=${p.mode || 'survey'}" title="设置" onclick="event.stopPropagation();">
                  ${icons.setting}
                </a>
                <button class="action-circle-btn more-dropdown-btn" data-id="${p.id}" title="更多" type="button" onclick="event.stopPropagation();">
                  ${icons.ellipsis}
                </button>

                <!-- Dropdown Menu exactly matching Screenshot -->
                ${isOpenDropdown ? `
                  <ul class="project-dropdown" onclick="event.stopPropagation();">
                    <li class="project-dropdown-item" data-action="preview" data-id="${p.id}">预览</li>
                    <li class="project-dropdown-item" data-action="rename" data-id="${p.id}">重命名</li>
                    <li class="project-dropdown-item" data-action="${isCollecting ? 'stop' : 'publish'}" data-id="${p.id}">
                      ${isCollecting ? '停止' : '发布'}
                    </li>
                    <li class="project-dropdown-item" data-action="move" data-id="${p.id}">
                      <span>移动</span>
                      <span style="color:#bfbfbf;font-size:11px;">&gt;</span>
                    </li>
                    <li class="project-dropdown-item" data-action="download" data-id="${p.id}">下载模板</li>
                    <li class="project-dropdown-item" data-action="copy" data-id="${p.id}">复制</li>
                    <li class="project-dropdown-item danger" data-action="delete" data-id="${p.id}" style="color:#ff4d4f;">删除</li>
                  </ul>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>项目名称</th>
              <th>类型</th>
              <th>状态</th>
              <th>收集答卷</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${projectList.map((p) => {
              const isSurvey = p.mode === 'survey' || !p.mode;
              const status = p.setting?.status ?? p.status ?? 1;
              const isCollecting = status === 1;
              const statusTag = isCollecting ? 'tag-green' : 'tag-orange';
              return `
                <tr>
                  <td><strong>${p.name || '未命名'}</strong></td>
                  <td><span class="tag tag-blue">${isSurvey ? '问卷' : '考试'}</span></td>
                  <td><span class="tag ${statusTag}">${isCollecting ? '收集中' : '已停止'}</span></td>
                  <td>${p.total ?? 0}</td>
                  <td>${p.createAt ? new Date(p.createAt).toLocaleString() : '—'}</td>
                  <td>
                    <a href="/survey/${p.id}/edit?mode=${p.mode || 'survey'}" style="margin-right:8px;">编辑</a>
                    <a href="/survey/${p.id}/data?mode=${p.mode || 'survey'}" style="margin-right:8px;">数据</a>
                    <a href="/survey/${p.id}/report?mode=${p.mode || 'survey'}" style="margin-right:8px;">报表</a>
                    <a href="/survey/${p.id}/setting?mode=${p.mode || 'survey'}" style="margin-right:8px;">设置</a>
                    <a class="table-del-btn" data-id="${p.id}" style="color:#ff4d4f;cursor:pointer;">删除</a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Bind dropdown toggle
  container.querySelectorAll('.more-dropdown-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      activeDropdownProjectId = activeDropdownProjectId === id ? null : id;
      renderProjects();
    });
  });

  // Bind dropdown item clicks
  container.querySelectorAll('.project-dropdown-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      const id = item.dataset.id;
      const project = projectList.find(p => p.id === id);
      activeDropdownProjectId = null;
      renderProjects();
      handleAction(action, project);
    });
  });

  // Table delete
  container.querySelectorAll('.table-del-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = projectList.find(x => x.id === btn.dataset.id);
      handleAction('delete', p);
    });
  });
}

// Global click closes dropdown
document.addEventListener('click', () => {
  if (activeDropdownProjectId) {
    activeDropdownProjectId = null;
    renderProjects();
  }
});

function handleAction(action, project) {
  if (!project) return;

  if (action === 'preview') {
    window.open(`/s/${project.id}`);
  } else if (action === 'rename') {
    showModal({
      title: '问卷重命名',
      content: `
        <div style="margin-bottom:12px;background:#e6f7ff;border:1px solid #91d5ff;padding:8px 12px;border-radius:4px;font-size:13px;color:#1890ff;">
          问卷重命名成功，系统内各处将显示重命名标题。此操作不影响公开问卷名称。
        </div>
        <div>
          <label style="display:block;margin-bottom:6px;font-weight:500;">问卷名称 <span style="color:red">*</span></label>
          <input class="input-text" id="rename-input" value="${project.name || ''}" placeholder="请输入问卷名称" />
        </div>
      `,
      okText: '确认',
      onOk: async (modal) => {
        const newName = modal.querySelector('#rename-input').value.trim();
        if (!newName) {
          showToast('请输入问卷名称', 'error');
          return false;
        }
        try {
          await request('/project/update', {
            method: 'POST',
            body: JSON.stringify({ id: project.id, name: newName })
          });
          showToast('重命名成功', 'success');
          loadProjects();
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });
  } else if (action === 'stop' || action === 'publish') {
    const isStop = action === 'stop';
    showModal({
      title: isStop ? '确定停止当前问卷？' : '确定发布当前问卷？',
      content: `<p>${isStop ? '停止之后问卷将不能继续收集数据。' : '只有发布的问卷才能收集数据。'}</p>`,
      okText: isStop ? '停止' : '发布',
      onOk: async () => {
        try {
          await request('/project/update', {
            method: 'POST',
            body: JSON.stringify({
              id: project.id,
              settingKey: 'status',
              settingValue: isStop ? 0 : 1
            })
          });
          showToast(isStop ? '已停止收集' : '已发布问卷', 'success');
          loadProjects();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  } else if (action === 'move') {
    showModal({
      title: '移动到文件夹',
      content: `
        <div>
          <label style="display:block;margin-bottom:6px;font-weight:500;">选择目标文件夹</label>
          <select class="select-box" id="target-folder">
            <option value="0">根目录</option>
            ${folderList.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
          </select>
        </div>
      `,
      okText: '移动',
      onOk: async (modal) => {
        const parentId = modal.querySelector('#target-folder').value;
        try {
          await request('/project/update', {
            method: 'POST',
            body: JSON.stringify({ id: project.id, parentId })
          });
          showToast('移动成功', 'success');
          loadProjects();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  } else if (action === 'download') {
    const blob = new Blob([JSON.stringify(project.survey || { title: project.name }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || '问卷模板'}.sk.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已开始下载问卷模板', 'success');
  } else if (action === 'copy') {
    showModal({
      title: '复制问卷',
      content: `
        <div>
          <label style="display:block;margin-bottom:6px;font-weight:500;">新问卷名称</label>
          <input class="input-text" id="copy-name" value="${project.name} (副本)" />
        </div>
      `,
      okText: '立即复制',
      onOk: async (modal) => {
        const name = modal.querySelector('#copy-name').value.trim();
        try {
          await request('/project/create', {
            method: 'POST',
            body: JSON.stringify({
              name: name || `${project.name} (副本)`,
              mode: project.mode || 'survey',
              survey: project.survey
            })
          });
          showToast('复制成功', 'success');
          loadProjects();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  } else if (action === 'delete') {
    showModal({
      title: '确定删除当前问卷？',
      content: '<p>删除之后可以在回收站里面找回。</p>',
      okText: '删除',
      onOk: async () => {
        try {
          await request('/project/delete', {
            method: 'POST',
            body: JSON.stringify({ id: project.id })
          });
          showToast('已移至回收站', 'success');
          loadProjects();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  }
}

function handleCreate() {
  showModal({
    title: '创建新项目',
    content: `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;margin-bottom:6px;font-weight:500;">项目名称 <span style="color:red">*</span></label>
          <input class="input-text" id="new-project-name" placeholder="请输入问卷或考试标题" />
        </div>
        <div>
          <label style="display:block;margin-bottom:6px;font-weight:500;">项目类型</label>
          <select class="select-box" id="new-project-mode">
            <option value="survey">调查问卷</option>
            <option value="exam">在线考试</option>
          </select>
        </div>
      </div>
    `,
    onOk: async (modal) => {
      const name = modal.querySelector('#new-project-name').value.trim();
      const mode = modal.querySelector('#new-project-mode').value;
      if (!name) {
        showToast('请输入项目名称', 'error');
        return false;
      }
      try {
        const res = await request('/project/create', {
          method: 'POST',
          body: JSON.stringify({ name, mode }),
        });
        showToast('创建成功', 'success');
        const newId = res?.id || res?.data?.id;
        if (newId) {
          window.location.assign(`/survey/${newId}/edit?mode=${mode}`);
        } else {
          loadProjects();
        }
      } catch (err) {
        showToast(err.message, 'error');
        return false;
      }
    }
  });
}

async function init() {
  await initLayout({
    activeKey: 'project',
    breadcrumb: [{ text: '我的项目' }]
  });

  const pageContent = document.querySelector('#page-content');
  pageContent.innerHTML = `
    <div class="project-toolbar">
      <div class="view-mode-toggle">
        <button class="view-mode-btn ${viewMode === 'grid' ? 'active' : ''}" id="mode-grid-btn" title="卡片视图" type="button">⊞ 卡片</button>
        <button class="view-mode-btn ${viewMode === 'table' ? 'active' : ''}" id="mode-table-btn" title="列表视图" type="button">☰ 列表</button>
      </div>

      <div style="display:flex;align-items:center;gap:12px;">
        <div class="search-box">
          <input class="input-text" id="search-input" placeholder="搜索项目名称..." value="${searchText}" />
          <button class="search-btn" id="search-btn" type="button">🔍</button>
        </div>
        <button class="btn btn-primary" id="create-project-btn" type="button">＋ 新建</button>
      </div>
    </div>

    <div id="project-content"></div>
  `;

  document.querySelector('#mode-grid-btn').addEventListener('click', () => {
    viewMode = 'grid';
    document.querySelector('#mode-grid-btn').classList.add('active');
    document.querySelector('#mode-table-btn').classList.remove('active');
    renderProjects();
  });

  document.querySelector('#mode-table-btn').addEventListener('click', () => {
    viewMode = 'table';
    document.querySelector('#mode-table-btn').classList.add('active');
    document.querySelector('#mode-grid-btn').classList.remove('active');
    renderProjects();
  });

  document.querySelector('#create-project-btn').addEventListener('click', handleCreate);

  const searchInput = document.querySelector('#search-input');
  const doSearch = () => {
    searchText = searchInput.value.trim();
    loadProjects();
  };
  document.querySelector('#search-btn').addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  loadProjects();
}

init();
