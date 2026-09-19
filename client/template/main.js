import { request } from '../shared/api.js';
import { initLayout, showModal, showToast } from '../shared/layout.js';

let templateList = [];
let categories = ['全部'];
let tags = ['全部'];
let selectedCategory = '全部';
let selectedTag = '全部';
let searchKeyword = '';

async function loadFilters() {
  try {
    const [catRes, tagRes] = await Promise.all([
      request('/template/listCategory?mode=survey'),
      request('/template/listTag?mode=survey'),
    ]);
    if (Array.isArray(catRes)) {
      categories = ['全部', ...catRes];
    }
    if (Array.isArray(tagRes)) {
      tags = ['全部', ...tagRes];
    }
    renderFilters();
  } catch (err) {
    // ignore
  }
}

function renderFilters() {
  const catContainer = document.querySelector('#category-tags');
  const tagContainer = document.querySelector('#tag-tags');
  if (catContainer) {
    catContainer.innerHTML = categories.map((cat) => `
      <span class="filter-tag ${selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">${cat}</span>
    `).join('');
    catContainer.querySelectorAll('.filter-tag').forEach((el) => {
      el.addEventListener('click', () => {
        selectedCategory = el.dataset.cat;
        renderFilters();
        loadTemplates();
      });
    });
  }

  if (tagContainer) {
    tagContainer.innerHTML = tags.map((tag) => `
      <span class="filter-tag ${selectedTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</span>
    `).join('');
    tagContainer.querySelectorAll('.filter-tag').forEach((el) => {
      el.addEventListener('click', () => {
        selectedTag = el.dataset.tag;
        renderFilters();
        loadTemplates();
      });
    });
  }
}

async function loadTemplates() {
  const container = document.querySelector('#template-grid');
  if (!container) return;
  container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#8c8c8c;">加载中...</div>';

  try {
    const query = new URLSearchParams({
      current: 1,
      pageSize: 50,
      ...(selectedCategory !== '全部' ? { category: selectedCategory } : {}),
      ...(selectedTag !== '全部' ? { tag: selectedTag } : {}),
      ...(searchKeyword ? { name: searchKeyword } : {})
    });
    const res = await request(`/template/list?${query.toString()}`);
    templateList = res?.records || res?.list || (Array.isArray(res) ? res : []);
    renderTemplates();
  } catch (err) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ff4d4f;">加载失败：${err.message}</div>`;
  }
}

function renderTemplates() {
  const container = document.querySelector('#template-grid');
  if (!container) return;

  if (templateList.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#8c8c8c;background:#fff;border-radius:4px;border:1px solid var(--border-color);">
        <div style="font-size:36px;margin-bottom:12px;">📑</div>
        <p>暂无符合条件的模板</p>
      </div>
    `;
    return;
  }

  container.innerHTML = templateList.map((tpl) => `
    <div class="template-card">
      <div>
        <h4 class="template-title">${tpl.name || '模板'}</h4>
        <p class="template-desc">${tpl.description || '暂无描述'}</p>
      </div>
      <div class="template-footer">
        <span class="tag tag-blue">${tpl.category || '通用'}</span>
        <button class="btn btn-primary btn-sm use-template-btn" data-id="${tpl.id}" type="button">应用模板</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.use-template-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      showModal({
        title: '应用模板创建项目',
        content: `
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:500;">新项目名称 <span style="color:red">*</span></label>
            <input class="input-text" id="tpl-project-name" placeholder="请输入问卷或考试名称" />
          </div>
        `,
        okText: '立即创建',
        onOk: async (modal) => {
          const name = modal.querySelector('#tpl-project-name').value.trim();
          if (!name) {
            showToast('请输入项目名称', 'error');
            return false;
          }
          try {
            await request('/project/create', {
              method: 'POST',
              body: JSON.stringify({ name, templateId: id }),
            });
            showToast('创建成功', 'success');
            setTimeout(() => {
              window.location.assign('/project');
            }, 500);
          } catch (err) {
            showToast(err.message, 'error');
            return false;
          }
        }
      });
    });
  });
}

async function init() {
  await initLayout({
    activeKey: 'template',
    breadcrumb: [{ text: '模板广场' }]
  });

  const pageContent = document.querySelector('#page-content');
  pageContent.innerHTML = `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="margin:0;font-size:18px;">模板广场</h3>
      <div style="display:flex;gap:10px;">
        <input class="input-text" id="tpl-search-input" placeholder="输入模板名字检索..." style="width:240px;" />
        <button class="btn btn-primary" id="tpl-search-btn" type="button">搜模板</button>
      </div>
    </div>

    <div class="template-filter-card">
      <div class="filter-row">
        <span class="filter-label">分类：</span>
        <div class="filter-tags" id="category-tags"></div>
      </div>
      <div class="filter-row" style="margin-top:10px;">
        <span class="filter-label">标签：</span>
        <div class="filter-tags" id="tag-tags"></div>
      </div>
    </div>

    <div class="template-grid" id="template-grid"></div>
  `;

  document.querySelector('#tpl-search-btn')?.addEventListener('click', () => {
    searchKeyword = document.querySelector('#tpl-search-input')?.value.trim() || '';
    loadTemplates();
  });

  document.querySelector('#tpl-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchKeyword = e.target.value.trim();
      loadTemplates();
    }
  });

  loadFilters();
  loadTemplates();
}

init();
