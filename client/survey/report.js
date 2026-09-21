import { request } from '../shared/api.js';

export async function renderReport(container, project) {
  container.innerHTML = `
    <div class="report-container">
      <div class="report-header">
        <div>
          <h3 style="margin:0;font-size:18px;">${project.name || '问卷统计'}</h3>
          <span style="font-size:13px;color:var(--text-muted);" id="report-total-label">加载统计数据中...</span>
        </div>
        <button class="btn btn-sm" id="refresh-report-btn" type="button">↻ 刷新报表</button>
      </div>

      <div id="report-cards-list"></div>
    </div>
  `;

  async function loadReportData() {
    const totalLabel = container.querySelector('#report-total-label');
    const cardsList = container.querySelector('#report-cards-list');

    try {
      const rep = await request(`/report/${project.id}`);
      const total = rep?.total ?? 0;
      totalLabel.textContent = `共 ${total} 条数据`;

      const questions = project.survey?.children || [];
      const stats = rep?.statistics || {};
      // 后端 statistics 为扁平结构：题目 id 与选项 id 同级作 key，值为 {total,...}
      const optCountOf = (optId) => stats[optId]?.total ?? 0;

      if (questions.length === 0) {
        cardsList.innerHTML = '<div class="card" style="text-align:center;color:#8c8c8c;">问卷中暂无题目</div>';
        return;
      }

      cardsList.innerHTML = questions.map((q, idx) => {
        const qStat = stats[q.id];
        const qTotal = qStat?.total ?? 0;
        const options = q.children || [];

        return `
          <div class="report-question-card">
            <h4 class="report-question-title">${idx + 1}. [${q.type}] ${q.title || '未命名题目'}</h4>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
              <span>类型：${q.type}</span> | <span>必填：${q.required ? '是' : '否'}</span> | <span>有效数据：${qTotal} 条</span>
            </div>

            ${options.length > 0 ? `
              <div class="chart-bar-container">
                ${options.map((opt) => {
                  const optCount = optCountOf(opt.id);
                  const pct = qTotal > 0 ? Math.round((optCount / qTotal) * 100) : 0;
                  return `
                    <div class="chart-bar-row">
                      <span class="chart-bar-label" title="${opt.title}">${opt.title}</span>
                      <div class="chart-bar-track">
                        <div class="chart-bar-fill" style="width:${pct}%;"></div>
                      </div>
                      <span class="chart-bar-value">${optCount} 票 (${pct}%)</span>
                    </div>
                  `;
                }).join('')}
              </div>

              <table class="data-table" style="margin-top:16px;">
                <thead>
                  <tr>
                    <th>选项</th>
                    <th style="width:120px;">数据量</th>
                    <th style="width:120px;">占比</th>
                  </tr>
                </thead>
                <tbody>
                  ${options.map((opt) => {
                    const optCount = optCountOf(opt.id);
                    const pct = qTotal > 0 ? Math.round((optCount / qTotal) * 100) : 0;
                    return `
                      <tr>
                        <td>${opt.title}</td>
                        <td>${optCount}</td>
                        <td>${pct}%</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            ` : `
              <div style="color:var(--text-muted);font-size:13px;padding:12px;background:#fafafa;border-radius:4px;">
                文本/开放型题目，已收录 ${qTotal} 条作答记录。
              </div>
            `}
          </div>
        `;
      }).join('');
    } catch (err) {
      cardsList.innerHTML = `<div class="card" style="color:#ff4d4f;text-align:center;">统计数据获取失败：${err.message}</div>`;
    }
  }

  container.querySelector('#refresh-report-btn')?.addEventListener('click', loadReportData);
  loadReportData();
}
