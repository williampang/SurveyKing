import { request } from '../shared/api.js';
import { initLayout, showModal, showToast } from '../shared/layout.js';

let exerciseList = [];

async function loadExercises() {
  const tbody = document.querySelector('#exercise-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">加载中...</td></tr>';

  try {
    const res = await request('/exercise/list?current=1&pageSize=50');
    exerciseList = res?.records || res?.list || (Array.isArray(res) ? res : []);
    renderExercises();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell" style="color:#ff4d4f;">加载失败：${err.message}</td></tr>`;
  }
}

function renderExercises() {
  const tbody = document.querySelector('#exercise-tbody');
  if (!tbody) return;

  if (exerciseList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无练习记录</td></tr>';
    return;
  }

  tbody.innerHTML = exerciseList.map((item) => {
    return `
      <tr>
        <td><strong>${item.name || item.title || '题库练习'}</strong></td>
        <td>${item.totalQuestions ?? item.questionCount ?? '—'}</td>
        <td><span class="tag tag-green">${item.score !== undefined ? `${item.score}分` : '已完成'}</span></td>
        <td>${item.createAt ? new Date(item.createAt).toLocaleString() : '—'}</td>
        <td>${item.duration ? `${Math.round(item.duration / 60)} 分钟` : '—'}</td>
        <td>
          <a href="/s/${item.projectId || item.id}/exam-result/${item.answerId || item.id}" style="margin-right:12px;">查看答卷</a>
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
        content: '<p>确定要删除该条练习记录吗？</p>',
        okText: '删除',
        onOk: async () => {
          try {
            await request('/exercise/delete', {
              method: 'POST',
              body: JSON.stringify({ ids: [id] }),
            });
            showToast('删除成功', 'success');
            loadExercises();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  });
}

async function init() {
  await initLayout({
    activeKey: 'exercise',
    breadcrumb: [{ text: '我的练习' }]
  });

  const pageContent = document.querySelector('#page-content');
  pageContent.innerHTML = `
    <div class="exercise-table-card">
      <div class="toolbar">
        <h3 style="margin:0;font-size:16px;">练习记录</h3>
        <button class="btn btn-default" id="refresh-btn" type="button">↻ 刷新</button>
      </div>
      <div class="data-table-wrap" style="border:none;">
        <table class="data-table">
          <thead>
            <tr>
              <th>题库 / 试卷名称</th>
              <th>题目数量</th>
              <th>成绩</th>
              <th>练习时间</th>
              <th>用时</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="exercise-tbody">
            <tr><td colspan="6" class="empty-cell">加载中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelector('#refresh-btn')?.addEventListener('click', loadExercises);
  loadExercises();
}

init();
