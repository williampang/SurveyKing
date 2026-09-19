import { request } from '../shared/api.js';
import { initLayout, showModal, showToast } from '../shared/layout.js';
import * as SettingModule from './setting.js';
import * as Modals from './modals.js';

const pathname = window.location.pathname;
let currentTab = pathname.includes('role') ? 'role'
  : pathname.includes('dept') ? 'dept'
  : pathname.includes('position') ? 'position'
  : pathname.includes('dict') ? 'dict'
  : pathname.includes('setting') ? 'setting'
  : 'user';

let dataList = [];
let deptTree = [];
let roleList = [];
let selectedDeptId = '';
let searchKeyword = '';
let settingSubTab = 'info';

let systemInfo = {};
let aiSetting = {};
let oauthSetting = {};

async function loadInitialData() {
  if (currentTab === 'user' || currentTab === 'dept') {
    await loadDeptTree();
  }
  if (currentTab === 'user') {
    try {
      const res = await request('/system/role/list?current=1&pageSize=100');
      roleList = res?.records || res?.list || (Array.isArray(res) ? res : []);
    } catch (e) {
      // ignore
    }
  }
  if (currentTab === 'setting') {
    await reloadSettings();
  } else {
    await loadTableData();
  }
}

async function loadDeptTree() {
  try {
    const res = await request('/system/dept/list');
    deptTree = res?.records || res?.list || (Array.isArray(res) ? res : []);
    renderDeptTree();
  } catch (err) {
    // ignore
  }
}

function renderDeptTree() {
  const container = document.querySelector('#dept-tree');
  if (!container) return;
  if (deptTree.length === 0) {
    container.innerHTML = '<div style="color:#8c8c8c;font-size:12px;padding:8px 0;">暂无组织架构</div>';
    return;
  }
  container.innerHTML = `
    <div class="ant-tree-node ${!selectedDeptId ? 'selected' : ''}" data-id="">
      <span class="ant-tree-icon">🏢</span>
      <span class="ant-tree-title">全部部门</span>
    </div>
    ${deptTree.map((d) => `
      <div class="ant-tree-node ${selectedDeptId === d.id ? 'selected' : ''}" data-id="${d.id}">
        <span class="ant-tree-icon">📁</span>
        <span class="ant-tree-title">${d.name || '部门'}</span>
      </div>
    `).join('')}
  `;
  container.querySelectorAll('.ant-tree-node').forEach((node) => {
    node.addEventListener('click', () => {
      selectedDeptId = node.dataset.id;
      renderDeptTree();
      loadTableData();
    });
  });
}

async function loadTableData() {
  const tbody = document.querySelector('#data-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">加载中...</td></tr>';

  try {
    const query = new URLSearchParams({
      current: 1,
      pageSize: 50,
      ...(searchKeyword ? { name: searchKeyword } : {}),
      ...(currentTab === 'user' && selectedDeptId ? { deptId: selectedDeptId } : {})
    });
    const res = await request(`/system/${currentTab}/list?${query.toString()}`);
    dataList = res?.records || res?.list || (Array.isArray(res) ? res : []);
    renderTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-cell" style="color:#ff4d4f;">加载失败：${err.message}</td></tr>`;
  }
}

function renderTable() {
  const thead = document.querySelector('#data-thead');
  const tbody = document.querySelector('#data-tbody');
  if (!thead || !tbody) return;

  if (currentTab === 'user') {
    thead.innerHTML = `
      <tr>
        <th style="width:40px;"><input type="checkbox" id="select-all" /></th>
        <th>组织机构</th>
        <th>姓名</th>
        <th>角色</th>
        <th>手机</th>
        <th>状态</th>
        <th>创建时间</th>
        <th>操作</th>
      </tr>
    `;
    if (dataList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无用户数据</td></tr>';
      return;
    }
    tbody.innerHTML = dataList.map((u) => {
      const isNormal = u.status === 1 || u.status === undefined;
      return `
        <tr>
          <td><input type="checkbox" class="row-checkbox" data-id="${u.id}" /></td>
          <td>${u.deptName || '卷王问卷'}</td>
          <td><strong>${u.name || u.username || '—'}</strong></td>
          <td>${u.roles?.map(r => r.name || r).join('、') || '超级管理员'}</td>
          <td>${u.phone || '—'}</td>
          <td><span class="tag ${isNormal ? 'tag-green' : 'tag-orange'}">${isNormal ? '激活' : '禁用'}</span></td>
          <td>${u.createAt ? new Date(u.createAt).toLocaleString() : '—'}</td>
          <td>
            <a class="edit-btn" data-id="${u.id}" style="margin-right:12px;">编辑</a>
            <a class="del-btn" data-id="${u.id}" style="color:#ff4d4f;cursor:pointer;">删除</a>
          </td>
        </tr>
      `;
    }).join('');
  } else if (currentTab === 'role') {
    thead.innerHTML = `
      <tr>
        <th>角色名称</th>
        <th>编码</th>
        <th>描述</th>
        <th>状态</th>
        <th>创建时间</th>
        <th>操作</th>
      </tr>
    `;
    if (dataList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无角色数据</td></tr>';
      return;
    }
    tbody.innerHTML = dataList.map((r) => {
      const isChecked = r.status !== 0;
      return `
        <tr>
          <td><strong>${r.name || '—'}</strong></td>
          <td><span class="tag tag-blue">${r.code || '—'}</span></td>
          <td>${r.remark || '系统内置角色'}</td>
          <td>
            <button class="ant-switch ${isChecked ? 'ant-switch-checked' : ''} role-status-switch" data-id="${r.id}" type="button">
              <span class="ant-switch-handle"></span>
            </button>
          </td>
          <td>${r.createAt ? new Date(r.createAt).toLocaleString() : '—'}</td>
          <td>
            <a class="edit-btn" data-id="${r.id}" style="margin-right:12px;">编辑</a>
            <a class="del-btn" data-id="${r.id}" style="color:#ff4d4f;cursor:pointer;">删除</a>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.role-status-switch').forEach((sw) => {
      sw.addEventListener('click', async () => {
        const id = sw.dataset.id;
        const willCheck = !sw.classList.contains('ant-switch-checked');
        sw.classList.toggle('ant-switch-checked', willCheck);
        try {
          await request('/system/role/update', {
            method: 'POST',
            body: JSON.stringify({ id, status: willCheck ? 1 : 0 }),
          });
          showToast('状态更新成功', 'success');
        } catch (err) {
          sw.classList.toggle('ant-switch-checked', !willCheck);
          showToast(err.message, 'error');
        }
      });
    });
  } else if (currentTab === 'dept') {
    thead.innerHTML = `
      <tr>
        <th>机构名称</th>
        <th>机构简称</th>
        <th>负责人</th>
        <th>操作</th>
      </tr>
    `;
    if (dataList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">暂无组织机构数据</td></tr>';
      return;
    }
    tbody.innerHTML = dataList.map((d) => `
      <tr>
        <td><strong>${d.name || '—'}</strong></td>
        <td>${d.shortName || 'surveyking'}</td>
        <td>${d.leader || 'Admin'}</td>
        <td>
          <a class="edit-btn" data-id="${d.id}" style="margin-right:12px;">编辑</a>
          <a class="del-btn" data-id="${d.id}" style="color:#ff4d4f;cursor:pointer;">删除</a>
        </td>
      </tr>
    `).join('');
  } else if (currentTab === 'position') {
    thead.innerHTML = `
      <tr>
        <th>名称</th>
        <th>编码</th>
        <th>数据权限</th>
        <th>操作</th>
      </tr>
    `;
    if (dataList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">暂无岗位数据</td></tr>';
      return;
    }
    tbody.innerHTML = dataList.map((p) => `
      <tr>
        <td><strong>${p.name || '—'}</strong></td>
        <td><span class="tag tag-blue">${p.code || '—'}</span></td>
        <td>${p.dataPermissionType ? `类型 ${p.dataPermissionType}` : '全部数据权限'}</td>
        <td>
          <a class="edit-btn" data-id="${p.id}" style="margin-right:12px;">编辑</a>
          <a class="del-btn" data-id="${p.id}" style="color:#ff4d4f;cursor:pointer;">删除</a>
        </td>
      </tr>
    `).join('');
  } else if (currentTab === 'dict') {
    thead.innerHTML = `
      <tr>
        <th>字典名称</th>
        <th>字典编码</th>
        <th>字典类型</th>
        <th>描述</th>
        <th>创建时间</th>
        <th>操作</th>
      </tr>
    `;
    if (dataList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无字典数据</td></tr>';
      return;
    }
    tbody.innerHTML = dataList.map((dict) => `
      <tr>
        <td><strong>${dict.name || '—'}</strong></td>
        <td><span class="tag tag-blue">${dict.code || '—'}</span></td>
        <td>${dict.type || '系统字典'}</td>
        <td>${dict.remark || '—'}</td>
        <td>${dict.createAt ? new Date(dict.createAt).toLocaleDateString() : '—'}</td>
        <td>
          <a class="edit-btn" data-id="${dict.id}" style="margin-right:12px;">编辑</a>
          <a class="del-btn" data-id="${dict.id}" style="color:#ff4d4f;cursor:pointer;">删除</a>
        </td>
      </tr>
    `).join('');
  }

  // Delete handlers
  tbody.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      showModal({
        title: '确认删除',
        content: '<p>确定要删除该项记录吗？该操作不可逆。</p>',
        okText: '删除',
        onOk: async () => {
          try {
            await request(`/system/${currentTab}/delete`, {
              method: 'POST',
              body: JSON.stringify({ id }),
            });
            showToast('删除成功', 'success');
            if (currentTab === 'dept') loadDeptTree();
            loadTableData();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  });

  // Edit handlers
  tbody.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = dataList.find(d => d.id === id);
      triggerModal(true, item);
    });
  });
}

function triggerModal(isEdit, editItem = null) {
  if (currentTab === 'user') {
    Modals.openUserModal({ isEdit, editItem, deptTree, roleList, onSave: loadTableData });
  } else if (currentTab === 'role') {
    Modals.openRoleModal({ isEdit, editItem, onSave: loadTableData });
  } else if (currentTab === 'dept') {
    Modals.openDeptModal({
      isEdit,
      editItem,
      onSave: () => {
        loadDeptTree();
        loadTableData();
      }
    });
  } else if (currentTab === 'position') {
    Modals.openPositionModal({ isEdit, editItem, onSave: loadTableData });
  } else if (currentTab === 'dict') {
    Modals.openDictModal({ isEdit, editItem, onSave: loadTableData });
  }
}

async function reloadSettings() {
  const data = await SettingModule.loadSystemSettings();
  systemInfo = data.sys;
  aiSetting = data.ai;
  oauthSetting = data.oauth;
  renderSettingSubPanel();
}

function renderSettingSubPanel() {
  const panel = document.querySelector('#setting-content-panel');
  if (!panel) return;
  if (settingSubTab === 'info') {
    SettingModule.renderInfoTab(panel, systemInfo, reloadSettings);
  } else if (settingSubTab === 'ai') {
    SettingModule.renderAiTab(panel, aiSetting, systemInfo, reloadSettings);
  } else if (settingSubTab === 'oauth') {
    SettingModule.renderOAuthTab(panel, oauthSetting, reloadSettings);
  } else if (settingSubTab === 'backup') {
    SettingModule.renderBackupTab(panel);
  }
}

async function init() {
  const tabTitles = {
    user: '用户管理',
    role: '角色管理',
    dept: '组织机构',
    position: '岗位设置',
    dict: '字典管理',
    setting: '系统设置',
  };

  await initLayout({
    activeKey: `system:${currentTab}`,
    breadcrumb: [
      { text: '系统管理', href: '/system/user' },
      { text: tabTitles[currentTab] || '系统管理' }
    ]
  });

  const pageContent = document.querySelector('#page-content');

  if (currentTab === 'setting') {
    pageContent.innerHTML = `
      <div class="setting-layout">
        <ul class="setting-menu">
          <li class="setting-menu-item ${settingSubTab === 'info' ? 'active' : ''}" data-sub="info">系统信息</li>
          <li class="setting-menu-item ${settingSubTab === 'ai' ? 'active' : ''}" data-sub="ai">AI设置</li>
          <li class="setting-menu-item ${settingSubTab === 'oauth' ? 'active' : ''}" data-sub="oauth">第三方登录配置</li>
          <li class="setting-menu-item ${settingSubTab === 'backup' ? 'active' : ''}" data-sub="backup">数据备份</li>
        </ul>
        <div class="setting-panel" id="setting-content-panel">
          <div style="text-align:center;padding:40px;color:#8c8c8c;">加载中...</div>
        </div>
      </div>
    `;

    document.querySelectorAll('.setting-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelector('.setting-menu-item.active')?.classList.remove('active');
        item.classList.add('active');
        settingSubTab = item.dataset.sub;
        renderSettingSubPanel();
      });
    });
  } else {
    pageContent.innerHTML = `
      <div class="query-card">
        <div class="query-form-row">
          <div class="query-item">
            <span class="query-label">${currentTab === 'user' ? '姓名 :' : currentTab === 'role' ? '角色名称 :' : currentTab === 'dept' ? '机构名称 :' : currentTab === 'position' ? '名称 :' : '字典名称 :'}</span>
            <input class="input-text" id="query-keyword-input" placeholder="请输入" style="width:200px;" value="${searchKeyword}" />
          </div>
          <div class="query-actions">
            <button class="btn" id="query-reset-btn" type="button">重 置</button>
            <button class="btn btn-primary" id="query-search-btn" type="button">查 询</button>
          </div>
        </div>
      </div>

      <div class="system-layout" style="display:flex;gap:16px;">
        ${(currentTab === 'user' || currentTab === 'dept') ? `
          <div class="dept-tree-panel" style="width:240px;background:#fff;border:1px solid var(--border-color);border-radius:4px;padding:16px;flex-shrink:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-weight:600;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border-color);">
              <span>组织机构</span>
              <button class="btn btn-sm" id="refresh-dept-btn" type="button" title="刷新机构">↻</button>
            </div>
            <div id="dept-tree" class="ant-tree"></div>
          </div>
        ` : ''}

        <div style="flex:1;background:#fff;border:1px solid var(--border-color);border-radius:4px;display:flex;flex-direction:column;">
          <div style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color);">
            <h3 style="margin:0;font-size:16px;">${currentTab === 'user' ? '系统用户列表' : currentTab === 'role' ? '系统角色列表' : currentTab === 'dept' ? '机构管理' : currentTab === 'position' ? '岗位列表' : '字典列表'}</h3>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-primary" id="create-btn" type="button">＋ 新建</button>
              ${currentTab === 'user' ? `<button class="btn" id="import-btn" type="button">⇪ 批量导入</button>` : ''}
              <button class="btn" id="refresh-btn" type="button">↻ 刷新</button>
            </div>
          </div>

          <div class="data-table-wrap" style="border:none;">
            <table class="data-table">
              <thead id="data-thead"></thead>
              <tbody id="data-tbody">
                <tr><td colspan="8" class="empty-cell">加载中...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.querySelector('#query-search-btn')?.addEventListener('click', () => {
      searchKeyword = document.querySelector('#query-keyword-input')?.value.trim() || '';
      loadTableData();
    });

    document.querySelector('#query-keyword-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchKeyword = e.target.value.trim();
        loadTableData();
      }
    });

    document.querySelector('#query-reset-btn')?.addEventListener('click', () => {
      searchKeyword = '';
      const input = document.querySelector('#query-keyword-input');
      if (input) input.value = '';
      loadTableData();
    });

    document.querySelector('#create-btn')?.addEventListener('click', () => triggerModal(false, null));
    document.querySelector('#refresh-btn')?.addEventListener('click', loadTableData);
    document.querySelector('#refresh-dept-btn')?.addEventListener('click', loadDeptTree);
    document.querySelector('#import-btn')?.addEventListener('click', () => showToast('已打开批量导入窗口', 'info'));
  }

  loadInitialData();
}

init();
