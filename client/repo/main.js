import { request } from '../shared/api.js';
import { initLayout, showModal, showToast } from '../shared/layout.js';

let currentTab = window.location.pathname.includes('template') ? 'template' : window.location.pathname.includes('book') ? 'book' : 'index';
let repoList = [];

async function loadRepos() {
  const tbody = document.querySelector('#repo-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">加载中...</td></tr>';

  try {
    const res = await request('/repo/list?current=1&pageSize=50');
    repoList = res?.records || res?.list || (Array.isArray(res) ? res : []);
    renderRepos();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell" style="color:#ff4d4f;">加载失败：${err.message}</td></tr>`;
  }
}

function renderRepos() {
  const tbody = document.querySelector('#repo-tbody');
  if (!tbody) return;

  if (repoList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无题库数据</td></tr>';
    return;
  }

  tbody.innerHTML = repoList.map((item) => {
    return `
      <tr>
        <td><strong>${item.name || '未命名题库'}</strong></td>
        <td><span class="tag tag-blue">${item.mode === 'exam' ? '考试题库' : '练习题库'}</span></td>
        <td>${item.totalQuestions ?? item.questionNum ?? 0} 道</td>
        <td>${item.createAt ? new Date(item.createAt).toLocaleDateString() : '—'}</td>
        <td><span class="tag tag-green">正常</span></td>
        <td>
          <a href="/repo/${item.id}/questions/edit" style="margin-right:12px;">管理试题</a>
          <a class="del-btn" data-id="${item.id}" style="color:#ff4d4f;cursor:pointer;">删除</a>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      showModal({
        title: '确认删除',
        content: '<p>确定要删除该题库吗？该操作不可逆。</p>',
        okText: '删除',
        onOk: async () => {
          try {
            await request('/repo/delete', {
              method: 'POST',
              body: JSON.stringify({ id }),
            });
            showToast('删除成功', 'success');
            loadRepos();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  });
}

function handleCreateRepo() {
  showModal({
    title: '新建题库',
    content: `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;margin-bottom:6px;font-weight:500;">题库名称 <span style="color:red">*</span></label>
          <input class="input-text" id="new-repo-name" placeholder="请输入题库名称" />
        </div>
        <div>
          <label style="display:block;margin-bottom:6px;font-weight:500;">题库类型</label>
          <select class="select-box" id="new-repo-mode">
            <option value="exam">考试题库</option>
            <option value="practice">练习题库</option>
          </select>
        </div>
        <div>
          <label style="display:block;margin-bottom:6px;font-weight:500;">备注说明</label>
          <input class="input-text" id="new-repo-desc" placeholder="请输入描述信息（可选）" />
        </div>
      </div>
    `,
    onOk: async (modal) => {
      const name = modal.querySelector('#new-repo-name').value.trim();
      const mode = modal.querySelector('#new-repo-mode').value;
      const description = modal.querySelector('#new-repo-desc').value.trim();
      if (!name) {
        showToast('请输入题库名称', 'error');
        return false;
      }
      try {
        await request('/repo/create', {
          method: 'POST',
          body: JSON.stringify({ name, mode, description }),
        });
        showToast('创建成功', 'success');
        loadRepos();
      } catch (err) {
        showToast(err.message, 'error');
        return false;
      }
    }
  });
}

async function init() {
  await initLayout({
    activeKey: `repo:${currentTab}`,
    breadcrumb: [
      { text: '题库中心', href: '/repo/index' },
      { text: currentTab === 'template' ? '问题管理' : currentTab === 'book' ? '我的笔记' : '我的题库' }
    ]
  });

  const pageContent = document.querySelector('#page-content');
  pageContent.innerHTML = `
    <div class="repo-tabs">
      <a class="repo-tab ${currentTab === 'index' ? 'active' : ''}" href="/repo/index">我的题库</a>
      <a class="repo-tab ${currentTab === 'template' ? 'active' : ''}" href="/repo/template">问题管理</a>
      <a class="repo-tab ${currentTab === 'book' ? 'active' : ''}" href="/repo/book">我的笔记</a>
    </div>
    <div class="repo-toolbar">
      <div>
        <input class="input-text" id="repo-search" placeholder="输入名称搜索..." style="width:240px;" />
      </div>
      <div>
        <button class="btn btn-primary" id="create-repo-btn" type="button">＋ 新建题库</button>
      </div>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>题库名称</th>
            <th>类型</th>
            <th>题目数量</th>
            <th>创建时间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="repo-tbody">
          <tr><td colspan="6" class="empty-cell">加载中...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.querySelector('#create-repo-btn')?.addEventListener('click', handleCreateRepo);
  loadRepos();
}

init();
