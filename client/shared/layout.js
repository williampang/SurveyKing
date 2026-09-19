import { API_BASE, request } from './api.js';

export function showToast(msg, type = 'info') {
  const existing = document.querySelector('.toast-notice');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast-notice toast-${type}`;
  const icon = type === 'success' ? '✔' : type === 'error' ? '✖' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2500);
}

export function showModal({ title, content, onOk, okText = '确定', cancelText = '取消' }) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" type="button">&times;</button>
      </div>
      <div class="modal-body">${content}</div>
      <div class="modal-footer">
        <button class="btn btn-cancel" type="button">${cancelText}</button>
        <button class="btn btn-primary btn-ok" type="button">${okText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('.btn-cancel').addEventListener('click', close);
  modal.querySelector('.btn-ok').addEventListener('click', async () => {
    if (onOk) {
      const res = await onOk(modal);
      if (res !== false) close();
    } else {
      close();
    }
  });
  return modal;
}

export async function initLayout(options = {}) {
  const { activeKey = '', breadcrumb = [] } = options;
  const layoutContainer = document.querySelector('#app');
  if (!layoutContainer) return;

  // Render shell
  const breadcrumbHtml = [
    '<a href="/home">首页</a>',
    ...breadcrumb.map((b, i) => {
      const isLast = i === breadcrumb.length - 1;
      return `<span class="separator">/</span>${isLast ? `<span class="current">${b.text}</span>` : `<a href="${b.href || '#'}">${b.text}</a>`}`;
    })
  ].join(' ');

  const isRepoActive = activeKey.startsWith('repo');
  const isSystemActive = activeKey.startsWith('system');

  layoutContainer.innerHTML = `
    <div class="app-layout">
      <aside class="app-sidebar">
        <a class="sidebar-logo" href="/home">
          <img src="/logo.svg" alt="logo" />
          <span id="layout-brand-name">卷王问卷考试系统</span>
        </a>
        <ul class="sidebar-menu">
          <li>
            <a class="menu-link ${activeKey === 'home' ? 'active' : ''}" href="/home">
              <span class="menu-icon">⌂</span>
              <span>首页</span>
            </a>
          </li>
          <li>
            <a class="menu-link ${activeKey === 'project' ? 'active' : ''}" href="/project">
              <span class="menu-icon">▣</span>
              <span>我的项目</span>
            </a>
          </li>
          <li>
            <a class="menu-link ${activeKey === 'exercise' ? 'active' : ''}" href="/exercise">
              <span class="menu-icon">✎</span>
              <span>我的练习</span>
            </a>
          </li>
          <li class="menu-item-group ${isRepoActive ? 'expanded' : ''}">
            <a class="menu-link ${isRepoActive ? 'active' : ''}" href="/repo/index" data-submenu="repo">
              <span class="menu-icon">▤</span>
              <span>题库中心</span>
              <span class="menu-arrow">▼</span>
            </a>
            <ul class="submenu-list">
              <li><a class="submenu-link ${activeKey === 'repo:index' ? 'active' : ''}" href="/repo/index">我的题库</a></li>
              <li><a class="submenu-link ${activeKey === 'repo:template' ? 'active' : ''}" href="/repo/template">问题管理</a></li>
              <li><a class="submenu-link ${activeKey === 'repo:book' ? 'active' : ''}" href="/repo/book">我的笔记</a></li>
            </ul>
          </li>
          <li>
            <a class="menu-link ${activeKey === 'template' ? 'active' : ''}" href="/template">
              <span class="menu-icon">▧</span>
              <span>模板广场</span>
            </a>
          </li>
          <li class="menu-item-group ${isSystemActive ? 'expanded' : ''}">
            <a class="menu-link ${isSystemActive ? 'active' : ''}" href="/system/user" data-submenu="system">
              <span class="menu-icon">⚙</span>
              <span>系统管理</span>
              <span class="menu-arrow">▼</span>
            </a>
            <ul class="submenu-list">
              <li><a class="submenu-link ${activeKey === 'system:user' ? 'active' : ''}" href="/system/user">用户管理</a></li>
              <li><a class="submenu-link ${activeKey === 'system:role' ? 'active' : ''}" href="/system/role">角色管理</a></li>
              <li><a class="submenu-link ${activeKey === 'system:dept' ? 'active' : ''}" href="/system/dept">组织机构</a></li>
              <li><a class="submenu-link ${activeKey === 'system:position' ? 'active' : ''}" href="/system/position">岗位设置</a></li>
              <li><a class="submenu-link ${activeKey === 'system:dict' ? 'active' : ''}" href="/system/dict">字典管理</a></li>
              <li><a class="submenu-link ${activeKey === 'system:setting' ? 'active' : ''}" href="/system/setting">系统设置</a></li>
            </ul>
          </li>
        </ul>
      </aside>

      <div class="app-main">
        <header class="app-header">
          <div class="header-left"></div>
          <div class="header-right">
            <button class="header-btn" title="帮助" type="button">?</button>
            <button class="header-btn" title="语言" type="button">文</button>
            <div class="user-profile">
              <span class="user-avatar" id="header-avatar">A</span>
              <span class="user-name" id="header-username">Admin</span>
            </div>
            <a class="logout-link" id="header-logout">退出</a>
          </div>
        </header>

        <div class="page-container">
          <div class="page-breadcrumb">
            ${breadcrumbHtml}
          </div>
          <div id="page-content"></div>
        </div>
      </div>
    </div>
  `;

  // Submenu toggle listeners
  document.querySelectorAll('[data-submenu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // Toggle expansion
      const group = btn.closest('.menu-item-group');
      if (group) {
        group.classList.toggle('expanded');
      }
    });
  });

  // Logout listener
  const logoutBtn = document.querySelector('#header-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await request('/public/logout', { method: 'POST' });
      } catch (err) {
        // ignore error
      }
      window.location.assign('/user/login');
    });
  }

  // Load system & user info
  try {
    const [system, user] = await Promise.all([
      request('/system'),
      request('/currentUser'),
    ]);
    if (system?.name) {
      document.querySelector('#layout-brand-name').textContent = system.name;
    }
    const name = user?.name || user?.username || 'Admin';
    document.querySelector('#header-username').textContent = name;
    document.querySelector('#header-avatar').textContent = name.slice(0, 1).toUpperCase();
  } catch (err) {
    // If not logged in, redirect to login
    if (err.message && err.message.includes('401')) {
      window.location.assign('/user/login');
    }
  }
}
