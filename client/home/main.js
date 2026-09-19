import { API_BASE, request } from '../shared/api.js';

const $ = (selector) => document.querySelector(selector);
let currentType = 'exam';

document.querySelectorAll('a[href^="/"]').forEach((link) => {
  link.href = `${window.location.origin}${link.getAttribute('href')}`;
});

async function getJson(path) {
  return request(path);
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
}

function statusText(status) {
  return ['未访问', '已访问', '已完成'][status] || '—';
}

function renderTasks(result) {
  const rows = Array.isArray(result) ? result : (result?.records || result?.list || []);
  $('#task-body').innerHTML = rows.length ? rows.map((task) => `<tr><td>${task.name || '未命名'}</td><td>${formatDate(task.examStartTime || task.startTime)}</td><td>${statusText(task.status)}</td><td><a class="row-link" href="${window.location.origin}/survey/${task.projectId || task.id}">查看</a></td></tr>`).join('') : '<tr><td colspan="4" class="empty">暂无数据</td></tr>';
}

async function loadTasks() {
  $('#task-body').innerHTML = '<tr><td colspan="4" class="empty">加载中...</td></tr>';
  const paths = {
    exam: '/listUserTask?type=exam&current=1&pageSize=20',
    survey: '/listUserTask?type=survey&current=1&pageSize=20',
    answer: '/listHistoryTask?type=survey&current=1&pageSize=20',
    history: '/listHistoryTask?type=exam&current=1&pageSize=20',
  };
  try {
    renderTasks(await getJson(paths[currentType]));
  } catch (error) {
    $('#task-body').innerHTML = `<tr><td colspan="4" class="empty error-state">${error.message}</td></tr>`;
  }
}

async function loadOverview() {
  try {
    const system = await getJson('/system');
    $('#brand-name').textContent = system.name || $('#brand-name').textContent; $('#mobile-brand-name').textContent = system.name || $('#mobile-brand-name').textContent;
    $('#system-description').textContent = system.description || $('#system-description').textContent;
    const [user, overview] = await Promise.all([getJson('/currentUser'), getJson('/userOverview')]);
    const name = user.name || user.username || 'Admin';
    $('#welcome-name').textContent = name; $('#account-name').textContent = name;
    $('#survey-count').textContent = overview.surveyCount ?? 0; $('#exam-count').textContent = overview.examCount ?? 0;
  } catch (error) {
    $('#system-description').textContent = error.message;
  }
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { document.querySelector('.tab.active').classList.remove('active'); tab.classList.add('active'); currentType = tab.dataset.type; loadTasks(); }));
$('#refresh-button').addEventListener('click', loadTasks);
$('#logout-button').addEventListener('click', async () => {
  const button = $('#logout-button');
  button.disabled = true;
  try {
    await request('/public/logout', { method: 'POST' });
    window.location.assign(`${window.location.origin}/user/login`);
  } catch (error) {
    button.disabled = false;
    window.alert(error.message || '退出失败');
  }
});
loadOverview(); loadTasks();