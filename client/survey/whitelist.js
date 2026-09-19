import { request } from '../shared/api.js';
import { showToast, showModal } from '../shared/layout.js';

export function openWhitelistModal({ project, onUpdate }) {
  const setting = project.setting || {};
  const answerSetting = setting.answerSetting || {};
  const whitelistType = answerSetting.whitelistType || 4; // 3: 系统, 4: 外部
  let isLimitEnabled = Boolean(answerSetting.whitelistLimit);

  let partnerList = [];
  let selectedIds = new Set();
  let searchName = '';
  let searchStatus = '';
  let currentPage = 1;
  const pageSize = 10;
  let totalCount = 0;

  const modalEl = document.createElement('div');
  modalEl.className = 'modal-overlay';
  modalEl.innerHTML = `
    <div class="modal-dialog" style="width: 860px; max-width: 95vw;">
      <div class="modal-header">
        <h3 class="modal-title" style="font-size: 16px;">白名单设置</h3>
        <button class="modal-close" id="wl-modal-close" type="button">&times;</button>
      </div>

      <div class="modal-body whitelist-modal-content">
        <!-- 1. 白名单答题限制开关 -->
        <div style="display: flex; align-items: center; gap: 12px; padding: 4px 0;">
          <span style="font-size: 14px; color: rgba(0,0,0,0.85);">白名单答题限制</span>
          <button class="ant-switch ${isLimitEnabled ? 'ant-switch-checked' : ''}" id="wl-limit-switch" type="button">
            <span class="ant-switch-handle"></span>
          </button>
        </div>

        <!-- 2. 查询过滤栏 (图2样式) -->
        <div class="whitelist-filter-card">
          <div class="whitelist-filter-fields">
            <div class="whitelist-filter-item">
              <span>名单：</span>
              <input class="input-text" id="wl-search-name" placeholder="请输入" style="width: 180px; height: 32px;" value="${searchName}" />
            </div>
            <div class="whitelist-filter-item">
              <span>状态：</span>
              <select class="select-box" id="wl-search-status" style="width: 140px; height: 32px;">
                <option value="">请选择</option>
                <option value="0">未访问</option>
                <option value="1">已访问</option>
                <option value="2">已答题</option>
              </select>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn" id="wl-reset-btn" type="button">重置</button>
            <button class="btn btn-primary" id="wl-query-btn" type="button">查询</button>
          </div>
        </div>

        <!-- 3. 操作工具栏 -->
        <div class="whitelist-table-toolbar">
          <div class="whitelist-tools-left">
            <button class="btn btn-primary btn-sm" id="wl-add-btn" type="button" style="height: 32px; padding: 4px 15px;">
              ＋ 添加白名单
            </button>
            <button class="btn btn-sm" id="wl-download-btn" type="button" style="height: 32px; padding: 4px 12px;">
              <svg viewBox="64 64 896 896" width="13" height="13" fill="currentColor" style="vertical-align:-1px; margin-right:4px;"><path d="M505.7 661a8 8 0 0012.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"></path></svg>
              下载
            </button>
            <button class="btn btn-sm" id="wl-batch-del-btn" type="button" disabled style="height: 32px; padding: 4px 12px; color: #8c8c8c;">
              批量删除
            </button>
          </div>
          <div class="whitelist-tools-right">
            <span id="wl-refresh-btn" title="刷新">↻</span>
            <span id="wl-density-btn" title="列密度">↕</span>
            <span id="wl-setting-btn" title="列设置">⚙</span>
          </div>
        </div>

        <!-- 4. 数据表格 -->
        <div class="whitelist-table-wrap">
          <table class="data-table" id="wl-data-table">
            <thead>
              <tr>
                <th style="width: 48px; text-align: center;">
                  <input type="checkbox" id="wl-select-all" />
                </th>
                <th style="width: 70px;">序号</th>
                <th>名单</th>
                <th style="width: 140px;">状态</th>
                <th style="width: 100px;">操作</th>
              </tr>
            </thead>
            <tbody id="wl-tbody">
              <tr><td colspan="5" class="empty-cell">加载中...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- 5. 底部分页 -->
        <div class="whitelist-pagination-bar">
          <span id="wl-page-summary">第 1-0 条/总共 0 条</span>
          <div class="whitelist-pagination-pages">
            <button class="whitelist-page-btn" id="wl-prev-page" type="button">&lt;</button>
            <button class="whitelist-page-btn active" id="wl-page-num" type="button">1</button>
            <button class="whitelist-page-btn" id="wl-next-page" type="button">&gt;</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  const close = () => modalEl.remove();
  modalEl.querySelector('#wl-modal-close').addEventListener('click', close);

  // 1. 白名单答题限制开关
  const limitSwitch = modalEl.querySelector('#wl-limit-switch');
  limitSwitch.addEventListener('click', async () => {
    isLimitEnabled = !isLimitEnabled;
    limitSwitch.classList.toggle('ant-switch-checked', isLimitEnabled);
    try {
      if (!setting.answerSetting) setting.answerSetting = {};
      setting.answerSetting.whitelistLimit = isLimitEnabled ? { limitNum: 1 } : null;
      await request('/project/update', {
        method: 'POST',
        body: JSON.stringify({
          id: project.id,
          setting: setting
        })
      });
      showToast('白名单答题限制已更新', 'success');
      if (onUpdate) onUpdate();
    } catch (err) {
      isLimitEnabled = !isLimitEnabled;
      limitSwitch.classList.toggle('ant-switch-checked', isLimitEnabled);
      showToast(err.message, 'error');
    }
  });

  // 2. 加载数据
  async function loadPartners() {
    const tbody = modalEl.querySelector('#wl-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">加载中...</td></tr>';
    selectedIds.clear();
    updateBatchDelBtn();

    try {
      const query = new URLSearchParams({
        projectId: project.id,
        types: whitelistType,
        current: currentPage,
        pageSize: pageSize,
        ...(searchName ? { userName: searchName } : {}),
        ...(searchStatus !== '' ? { status: searchStatus } : {})
      });
      const res = await request(`/project/partner/list?${query.toString()}`);
      totalCount = res?.total ?? res?.data?.total ?? 0;
      partnerList = res?.records || res?.list || res?.data?.list || [];
      renderPartnerTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell" style="color:#ff4d4f;">加载失败：${err.message}</td></tr>`;
    }
  }

  function statusLabel(status) {
    if (status === 2) return '已答题';
    if (status === 1) return '已访问';
    return '未访问';
  }

  function renderPartnerTable() {
    const tbody = modalEl.querySelector('#wl-tbody');
    const selectAll = modalEl.querySelector('#wl-select-all');
    selectAll.checked = false;

    if (partnerList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">暂无白名单数据</td></tr>';
      modalEl.querySelector('#wl-page-summary').textContent = '第 0-0 条/总共 0 条';
      return;
    }

    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalCount);
    modalEl.querySelector('#wl-page-summary').textContent = `第 ${start}-${end} 条/总共 ${totalCount} 条`;

    tbody.innerHTML = partnerList.map((item, idx) => {
      const num = start + idx;
      const isChecked = selectedIds.has(item.id);
      return `
        <tr>
          <td style="text-align: center;">
            <input type="checkbox" class="wl-row-check" data-id="${item.id}" ${isChecked ? 'checked' : ''} />
          </td>
          <td>${num}</td>
          <td>${item.userName || item.user?.name || '—'}</td>
          <td>${statusLabel(item.status)}</td>
          <td>
            <a class="wl-del-btn" data-id="${item.id}" style="color: #1890ff; cursor: pointer;">删除</a>
          </td>
        </tr>
      `;
    }).join('');

    // 单选勾选监听
    tbody.querySelectorAll('.wl-row-check').forEach((chk) => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.id;
        if (chk.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }
        updateBatchDelBtn();
      });
    });

    // 单行删除监听
    tbody.querySelectorAll('.wl-del-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        showModal({
          title: '确定删除当前名单吗？',
          content: '<p>名单删除之后，将无法恢复。</p>',
          okText: '确定',
          onOk: async () => {
            try {
              await request('/project/partner/delete', {
                method: 'POST',
                body: JSON.stringify({
                  projectId: project.id,
                  ids: [id]
                })
              });
              showToast('删除成功', 'success');
              loadPartners();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });
    });
  }

  function updateBatchDelBtn() {
    const btn = modalEl.querySelector('#wl-batch-del-btn');
    if (selectedIds.size > 0) {
      btn.removeAttribute('disabled');
      btn.style.color = '#ff4d4f';
      btn.style.borderColor = '#ff4d4f';
    } else {
      btn.setAttribute('disabled', 'true');
      btn.style.color = '#8c8c8c';
      btn.style.borderColor = '#d9d9d9';
    }
  }

  // 全选/反选
  modalEl.querySelector('#wl-select-all').addEventListener('change', (e) => {
    const checked = e.target.checked;
    modalEl.querySelectorAll('.wl-row-check').forEach((chk) => {
      chk.checked = checked;
      const id = chk.dataset.id;
      if (checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }
    });
    updateBatchDelBtn();
  });

  // 批量删除
  modalEl.querySelector('#wl-batch-del-btn').addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    showModal({
      title: `确定将 ${ids.length} 个名单删除吗？`,
      content: '<p>名单删除之后，将无法恢复。</p>',
      okText: '删除',
      onOk: async () => {
        try {
          await request('/project/partner/delete', {
            method: 'POST',
            body: JSON.stringify({
              projectId: project.id,
              ids
            })
          });
          showToast('批量删除成功', 'success');
          loadPartners();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  // 添加白名单
  modalEl.querySelector('#wl-add-btn').addEventListener('click', () => {
    showModal({
      title: '添加白名单',
      content: `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <textarea class="input-text" id="wl-add-textarea" style="height:150px;padding:8px 12px;font-family:inherit;" placeholder="每行一个名单"></textarea>
        </div>
      `,
      okText: '确定',
      onOk: async (subModal) => {
        const text = subModal.querySelector('#wl-add-textarea').value.trim();
        const names = text.split('\n').map(n => n.trim()).filter(Boolean);
        if (names.length === 0) {
          showToast('请输入至少一个名单', 'warning');
          return false;
        }
        try {
          await request('/project/partner/create', {
            method: 'POST',
            body: JSON.stringify({
              projectId: project.id,
              type: whitelistType,
              userNames: names
            })
          });
          showToast('添加成功', 'success');
          loadPartners();
        } catch (err) {
          showToast(err.message, 'error');
          return false;
        }
      }
    });
  });

  // 下载白名单
  modalEl.querySelector('#wl-download-btn').addEventListener('click', () => {
    if (partnerList.length === 0) {
      showToast('暂无名单可下载', 'warning');
      return;
    }
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + ["序号,名单,状态"].concat(
        partnerList.map((p, i) => `${i + 1},"${p.userName || ''}",${statusLabel(p.status)}`)
      ).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${project.name || '问卷'}_白名单.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('已下载白名单列表', 'success');
  });

  // 过滤查询与重置
  modalEl.querySelector('#wl-query-btn').addEventListener('click', () => {
    searchName = modalEl.querySelector('#wl-search-name').value.trim();
    searchStatus = modalEl.querySelector('#wl-search-status').value;
    currentPage = 1;
    loadPartners();
  });

  modalEl.querySelector('#wl-reset-btn').addEventListener('click', () => {
    modalEl.querySelector('#wl-search-name').value = '';
    modalEl.querySelector('#wl-search-status').value = '';
    searchName = '';
    searchStatus = '';
    currentPage = 1;
    loadPartners();
  });

  modalEl.querySelector('#wl-refresh-btn').addEventListener('click', loadPartners);

  loadPartners();
}
