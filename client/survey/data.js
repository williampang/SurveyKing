import { request } from '../shared/api.js';
import { showToast } from '../shared/layout.js';

let answers = [];

export async function renderData(container, project) {
  container.innerHTML = `
    <div class="data-container">
      <div class="data-toolbar">
        <div class="data-tool-group">
          <button class="btn btn-sm" id="refresh-data-btn" type="button">↻ 刷新数据</button>
          <button class="btn btn-sm btn-primary" id="add-data-btn" type="button">＋ 添加数据</button>
        </div>
        <div class="data-tool-group">
          <button class="btn btn-sm" id="export-excel-btn" type="button">⇪ 导出数据</button>
          <button class="btn btn-sm" id="export-csv-btn" type="button">下载 CSV</button>
        </div>
      </div>

      <div class="data-table-scroll">
        <table class="data-table">
          <thead id="answer-thead">
            <tr>
              <th style="width:50px;">序号</th>
              <th>提交人</th>
              <th>提交时间</th>
              <th>答题时长</th>
              <th>答题详情 (JSON)</th>
            </tr>
          </thead>
          <tbody id="answer-tbody">
            <tr><td colspan="5" class="empty-cell">加载答卷数据中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  async function loadAnswerList() {
    const tbody = container.querySelector('#answer-tbody');
    try {
      const res = await request(`/answer/list?projectId=${project.id}&current=1&pageSize=50`);
      answers = res?.records || res?.list || (Array.isArray(res) ? res : []);
      if (answers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">暂无提交数据</td></tr>';
        return;
      }
      tbody.innerHTML = answers.map((ans, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${ans.createBy || '匿名访客'}</td>
          <td>${ans.createAt ? new Date(ans.createAt).toLocaleString() : '—'}</td>
          <td>${ans.metaInfo?.answerTime ? `${ans.metaInfo.answerTime} 秒` : '—'}</td>
          <td style="font-family:monospace;font-size:12px;max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${JSON.stringify(ans.answer || {})}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell" style="color:#ff4d4f;">加载失败：${err.message}</td></tr>`;
    }
  }

  container.querySelector('#refresh-data-btn')?.addEventListener('click', loadAnswerList);
  container.querySelector('#add-data-btn')?.addEventListener('click', () => {
    window.open(`/s/${project.id}`, '_blank');
  });

  container.querySelector('#export-csv-btn')?.addEventListener('click', () => {
    if (answers.length === 0) {
      showToast('暂无数据可导出', 'warning');
      return;
    }
    const csvContent = "data:text/csv;charset=utf-8,"
      + ["序号,提交人,提交时间,时长(秒),答卷详情"].concat(
        answers.map((a, i) => `${i+1},"${a.createBy || '匿名'}","${a.createAt || ''}",${a.metaInfo?.answerTime || 0},"${JSON.stringify(a.answer || {}).replace(/"/g, '""')}"`)
      ).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${project.name || '问卷'}_数据.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('已导出 CSV 文件', 'success');
  });

  loadAnswerList();
}
