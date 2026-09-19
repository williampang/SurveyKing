import { request } from '../shared/api.js';
import { showToast, showModal } from '../shared/layout.js';

// 题型库（对齐官方分类）
const PALETTE = [
  {
    category: '选择题',
    items: [
      { type: 'Radio', name: '单选题', icon: '🔘' },
      { type: 'Checkbox', name: '多选题', icon: '☑️' },
      { type: 'Select', name: '下拉题', icon: '🔽' },
      { type: 'Cascader', name: '级联题', icon: '🔀' },
      { type: 'Upload', name: '上传文件', icon: '📁' }
    ]
  },
  {
    category: '填空题',
    items: [
      { type: 'Input', name: '单行填空', icon: '✏️' },
      { type: 'Textarea', name: '多行文本', icon: '📝' },
      { type: 'Signature', name: '电子签名', icon: '✍️' }
    ]
  },
  {
    category: '评分与矩阵',
    items: [
      { type: 'Rate', name: '打分题', icon: '⭐' },
      { type: 'Nps', name: 'NPS题', icon: '📊' },
      { type: 'MatrixRadio', name: '矩阵单选', icon: '▦' },
      { type: 'MatrixCheckbox', name: '矩阵多选', icon: '▩' }
    ]
  },
  {
    category: '辅助布局',
    items: [
      { type: 'Section', name: '分页/分段', icon: '📄' },
      { type: 'Remark', name: '文字描述', icon: '💬' }
    ]
  }
];

export function renderEditor(container, project, onReload) {
  let survey = project.survey || {
    id: project.id,
    title: project.name || '问卷标题',
    description: '感谢您抽出时间参与调研！',
    children: []
  };

  if (!survey.children) survey.children = [];

  container.innerHTML = `
    <div class="editor-layout">
      <!-- Left Question Palette -->
      <aside class="editor-sidebar">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border-color);font-weight:600;font-size:14px;">
          题型选择
        </div>
        ${PALETTE.map((cat) => `
          <div class="question-palette-category">${cat.category}</div>
          <div class="question-palette-grid">
            ${cat.items.map((it) => `
              <div class="palette-item" data-type="${it.type}" title="点击添加到问卷">
                <span>${it.icon}</span>
                <span>${it.name}</span>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </aside>

      <!-- Center Canvas -->
      <main class="editor-canvas-wrap">
        <div style="width:min(800px, 100%);display:flex;justify-content:flex-end;margin-bottom:12px;gap:10px;">
          <button class="btn btn-sm" id="editor-preview-btn" type="button">👁 预览问卷</button>
          <button class="btn btn-sm btn-primary" id="editor-save-btn" type="button">💾 保存问卷</button>
        </div>

        <div class="editor-canvas">
          <div class="survey-title-editable" id="canvas-title" contenteditable="true" spellcheck="false">${survey.title || '问卷标题'}</div>
          <div class="survey-desc-editable" id="canvas-desc" contenteditable="true" spellcheck="false">${survey.description || '请在此输入问卷说明...'}</div>

          <div id="questions-list"></div>
        </div>
      </main>
    </div>
  `;

  function renderQuestions() {
    const list = container.querySelector('#questions-list');
    if (survey.children.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:80px 20px;color:#8c8c8c;border:2px dashed #e8e8e8;border-radius:6px;">
          <div style="font-size:32px;margin-bottom:8px;">👈</div>
          <div>从左侧题型库点击添加题目</div>
        </div>
      `;
      return;
    }

    list.innerHTML = survey.children.map((q, idx) => {
      return `
        <div class="question-block" data-idx="${idx}">
          <div class="question-block-actions">
            <button class="btn btn-sm" data-action="up" data-idx="${idx}" type="button" title="上移">▲</button>
            <button class="btn btn-sm" data-action="down" data-idx="${idx}" type="button" title="下移">▼</button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-idx="${idx}" type="button" title="删除">🗑</button>
          </div>

          <div class="question-header">
            <span style="color:var(--primary);font-weight:bold;">${idx + 1}.</span>
            <span style="color:#ff4d4f;">${q.required ? '*' : ''}</span>
            <input class="input-text question-title-input" data-idx="${idx}" value="${q.title || ''}" placeholder="请输入题目标题" style="font-weight:500;" />
          </div>

          <div class="question-body">
            ${renderQuestionBody(q, idx)}
          </div>
        </div>
      `;
    }).join('');

    // Bind item actions
    list.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const idx = Number(btn.dataset.idx);
        if (action === 'delete') {
          survey.children.splice(idx, 1);
          renderQuestions();
        } else if (action === 'up' && idx > 0) {
          const temp = survey.children[idx - 1];
          survey.children[idx - 1] = survey.children[idx];
          survey.children[idx] = temp;
          renderQuestions();
        } else if (action === 'down' && idx < survey.children.length - 1) {
          const temp = survey.children[idx + 1];
          survey.children[idx + 1] = survey.children[idx];
          survey.children[idx] = temp;
          renderQuestions();
        }
      });
    });

    // Bind title edits
    list.querySelectorAll('.question-title-input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const idx = Number(inp.dataset.idx);
        survey.children[idx].title = e.target.value;
      });
    });

    // Bind option actions
    list.querySelectorAll('.add-option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qIdx = Number(btn.dataset.qidx);
        const q = survey.children[qIdx];
        if (!q.children) q.children = [];
        const optNum = q.children.length + 1;
        q.children.push({
          id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: `选项${optNum}`
        });
        renderQuestions();
      });
    });

    list.querySelectorAll('.opt-input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const qIdx = Number(inp.dataset.qidx);
        const optIdx = Number(inp.dataset.optidx);
        survey.children[qIdx].children[optIdx].title = e.target.value;
      });
    });

    list.querySelectorAll('.del-opt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qIdx = Number(btn.dataset.qidx);
        const optIdx = Number(btn.dataset.optidx);
        survey.children[qIdx].children.splice(optIdx, 1);
        renderQuestions();
      });
    });
  }

  function renderQuestionBody(q, qIdx) {
    if (['Radio', 'Checkbox', 'Select'].includes(q.type)) {
      const options = q.children || [];
      return `
        <div class="question-options-list">
          ${options.map((opt, oIdx) => `
            <div class="question-option-item">
              <span>${q.type === 'Radio' ? '⚪' : q.type === 'Checkbox' ? '⬜' : '▾'}</span>
              <input class="input-text opt-input" data-qidx="${qIdx}" data-optidx="${oIdx}" value="${opt.title || ''}" placeholder="选项内容" style="height:28px;" />
              <button class="btn btn-sm del-opt-btn" data-qidx="${qIdx}" data-optidx="${oIdx}" type="button" style="color:#ff4d4f;">✕</button>
            </div>
          `).join('')}
          <div style="margin-top:4px;">
            <button class="btn btn-sm add-option-btn" data-qidx="${qIdx}" type="button">＋ 添加选项</button>
          </div>
        </div>
      `;
    } else if (q.type === 'Input') {
      return `<input class="input-text" disabled placeholder="单行填空预览..." style="background:#fafafa;" />`;
    } else if (q.type === 'Textarea') {
      return `<textarea class="input-text" disabled placeholder="多行填空文本预览..." style="background:#fafafa;height:60px;"></textarea>`;
    } else if (q.type === 'Rate') {
      return `<div style="font-size:20px;color:#faad14;">⭐⭐⭐⭐⭐</div>`;
    } else if (q.type === 'Nps') {
      return `
        <div style="display:flex;gap:4px;overflow-x:auto;">
          ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `<span style="padding:4px 8px;border:1px solid #d9d9d9;border-radius:2px;font-size:12px;">${n}</span>`).join('')}
        </div>
      `;
    } else {
      return `<div style="color:var(--text-muted);font-size:12px;padding:8px;background:#fafafa;">[${q.type}] 题目展示区域</div>`;
    }
  }

  // Click palette to add question
  container.querySelectorAll('.palette-item').forEach((item) => {
    item.addEventListener('click', () => {
      const type = item.dataset.type;
      const qNum = survey.children.length + 1;
      const newQuestion = {
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        title: `${type === 'Radio' ? '单选题' : type === 'Checkbox' ? '多选题' : type === 'Input' ? '单行文本' : type === 'Rate' ? '打分题' : type === 'Nps' ? 'NPS题' : '新题目'} ${qNum}`,
        required: true,
        children: ['Radio', 'Checkbox', 'Select'].includes(type) ? [
          { id: `opt_1_${Date.now()}`, title: '选项1' },
          { id: `opt_2_${Date.now()}`, title: '选项2' }
        ] : []
      };
      survey.children.push(newQuestion);
      renderQuestions();
      showToast('已添加题目', 'info');
    });
  });

  // Save survey
  container.querySelector('#editor-save-btn')?.addEventListener('click', async () => {
    survey.title = container.querySelector('#canvas-title')?.innerText?.trim() || survey.title;
    survey.description = container.querySelector('#canvas-desc')?.innerText?.trim() || survey.description;

    try {
      await request('/project/update', {
        method: 'POST',
        body: JSON.stringify({
          id: project.id,
          name: survey.title,
          survey: survey
        })
      });
      showToast('问卷保存成功', 'success');
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Preview survey
  container.querySelector('#editor-preview-btn')?.addEventListener('click', () => {
    window.open(`/s/${project.id}`, '_blank');
  });

  renderQuestions();
}
