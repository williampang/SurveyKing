import { request } from '../shared/api.js';
import { showModal, showToast } from '../shared/layout.js';

export function openUserModal({ isEdit, editItem, deptTree, roleList, onSave }) {
  showModal({
    title: isEdit ? '编辑用户' : '新建用户',
    content: `
      <div style="display:flex;flex-direction:column;gap:14px;max-height:65vh;overflow-y:auto;padding-right:4px;">
        <div style="display:flex;gap:16px;">
          <div style="flex:1;">
            <label class="setting-form-label required">用户名 (姓名)</label>
            <input class="input-text" id="form-user-name" placeholder="请输入名称" value="${editItem?.name || ''}" />
          </div>
          <div style="flex:1;">
            <label class="setting-form-label required">登录名</label>
            <input class="input-text" id="form-user-username" placeholder="请输入登录账户名称" value="${editItem?.username || ''}" ${isEdit ? 'disabled' : ''} />
          </div>
        </div>
        <div style="display:flex;gap:16px;">
          <div style="flex:1;">
            <label class="setting-form-label ${isEdit ? '' : 'required'}">输入密码</label>
            <input class="input-text" id="form-user-password" type="password" placeholder="${isEdit ? '留空则不修改密码' : '请输入密码'}" />
          </div>
          <div style="flex:1;">
            <label class="setting-form-label ${isEdit ? '' : 'required'}">确认密码</label>
            <input class="input-text" id="form-user-confirm-password" type="password" placeholder="再次输入密码" />
          </div>
        </div>
        <div style="display:flex;gap:16px;">
          <div style="flex:1;">
            <label class="setting-form-label">性别</label>
            <select class="select-box" id="form-user-gender">
              <option value="1" ${editItem?.gender === 1 ? 'selected' : ''}>男</option>
              <option value="2" ${editItem?.gender === 2 ? 'selected' : ''}>女</option>
            </select>
          </div>
          <div style="flex:1;">
            <label class="setting-form-label required">状态</label>
            <select class="select-box" id="form-user-status">
              <option value="1" ${editItem?.status !== 0 ? 'selected' : ''}>激活</option>
              <option value="0" ${editItem?.status === 0 ? 'selected' : ''}>禁用</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:16px;">
          <div style="flex:1;">
            <label class="setting-form-label">手机</label>
            <input class="input-text" id="form-user-phone" placeholder="请输入手机号" value="${editItem?.phone || ''}" />
          </div>
          <div style="flex:1;">
            <label class="setting-form-label">邮箱</label>
            <input class="input-text" id="form-user-email" placeholder="请输入邮箱" value="${editItem?.email || ''}" />
          </div>
        </div>
        <div>
          <label class="setting-form-label required">组织机构</label>
          <select class="select-box" id="form-user-dept">
            <option value="">请选择组织机构</option>
            ${deptTree.map(d => `<option value="${d.id}" ${editItem?.deptId === d.id ? 'selected' : ''}>${d.name || '部门'}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="setting-form-label">角色列表</label>
          <select class="select-box" id="form-user-role">
            <option value="">请选择角色</option>
            ${roleList.map(r => `<option value="${r.id}" ${editItem?.roles?.some(ur => ur.id === r.id || ur === r.id) ? 'selected' : ''}>${r.name}</option>`).join('')}
          </select>
        </div>
      </div>
    `,
    onOk: async (modal) => {
      const name = modal.querySelector('#form-user-name').value.trim();
      const username = modal.querySelector('#form-user-username').value.trim();
      const password = modal.querySelector('#form-user-password').value;
      const confirmPassword = modal.querySelector('#form-user-confirm-password').value;
      const gender = Number(modal.querySelector('#form-user-gender').value);
      const status = Number(modal.querySelector('#form-user-status').value);
      const phone = modal.querySelector('#form-user-phone').value.trim();
      const email = modal.querySelector('#form-user-email').value.trim();
      const deptId = modal.querySelector('#form-user-dept').value;
      const roleId = modal.querySelector('#form-user-role').value;

      if (!name || !username) {
        showToast('请填写必填项', 'error');
        return false;
      }
      if (!isEdit && !password) {
        showToast('请输入密码', 'error');
        return false;
      }
      if (password && password !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        return false;
      }

      const payload = {
        ...(isEdit ? { id: editItem.id } : {}),
        name,
        username,
        ...(password ? { password } : {}),
        gender,
        status,
        phone,
        email,
        deptId: deptId || undefined,
        roles: roleId ? [roleId] : []
      };

      try {
        await request(isEdit ? '/system/user/update' : '/system/user/create', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(isEdit ? '修改成功' : '创建成功', 'success');
        if (onSave) onSave();
      } catch (err) {
        showToast(err.message, 'error');
        return false;
      }
    }
  });
}

export function openRoleModal({ isEdit, editItem, onSave }) {
  let permissions = [];
  request('/system/permission/list').then(res => {
    permissions = Array.isArray(res) ? res : (res?.data || []);
    const permTreeContainer = document.querySelector('#perm-tree-container');
    if (permTreeContainer) {
      permTreeContainer.innerHTML = permissions.map(p => `
        <label style="display:inline-flex;align-items:center;margin-right:12px;margin-bottom:8px;font-size:13px;cursor:pointer;">
          <input type="checkbox" class="perm-check" value="${p.code}" ${editItem?.authority?.includes(p.code) ? 'checked' : ''} style="margin-right:4px;" />
          <span>${p.name || p.code}</span>
        </label>
      `).join('');
    }
  });

  showModal({
    title: isEdit ? '编辑角色' : '新建角色',
    content: `
      <div style="display:flex;flex-direction:column;gap:14px;max-height:65vh;overflow-y:auto;">
        <div>
          <label class="setting-form-label required">角色名称</label>
          <input class="input-text" id="form-role-name" placeholder="请输入角色名称" value="${editItem?.name || ''}" />
        </div>
        <div>
          <label class="setting-form-label required">角色编码</label>
          <input class="input-text" id="form-role-code" placeholder="请输入角色编码" value="${editItem?.code || ''}" />
        </div>
        <div>
          <label class="setting-form-label">描述</label>
          <input class="input-text" id="form-role-remark" placeholder="请输入角色描述信息" value="${editItem?.remark || ''}" />
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label class="setting-form-label" style="margin:0;">角色授权</label>
            <a id="perm-select-all" style="font-size:12px;cursor:pointer;color:var(--primary);">全选/取消</a>
          </div>
          <div id="perm-tree-container" style="border:1px solid var(--border-color);border-radius:4px;padding:12px;max-height:180px;overflow-y:auto;background:#fafafa;">
            <span style="color:#8c8c8c;font-size:12px;">加载权限列表中...</span>
          </div>
        </div>
      </div>
    `,
    onOk: async (modal) => {
      const name = modal.querySelector('#form-role-name').value.trim();
      const code = modal.querySelector('#form-role-code').value.trim();
      const remark = modal.querySelector('#form-role-remark').value.trim();
      const checkedPerms = Array.from(modal.querySelectorAll('.perm-check:checked')).map(c => c.value);

      if (!name || !code) {
        showToast('请填写必填项', 'error');
        return false;
      }

      const payload = {
        ...(isEdit ? { id: editItem.id } : {}),
        name,
        code,
        remark,
        authority: checkedPerms
      };

      try {
        await request(isEdit ? '/system/role/update' : '/system/role/create', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(isEdit ? '修改成功' : '创建成功', 'success');
        if (onSave) onSave();
      } catch (err) {
        showToast(err.message, 'error');
        return false;
      }
    }
  });

  setTimeout(() => {
    document.querySelector('#perm-select-all')?.addEventListener('click', () => {
      const checks = Array.from(document.querySelectorAll('.perm-check'));
      const allChecked = checks.every(c => c.checked);
      checks.forEach(c => c.checked = !allChecked);
    });
  }, 100);
}

export function openDeptModal({ isEdit, editItem, onSave }) {
  showModal({
    title: isEdit ? '编辑组织机构' : '新建组织机构',
    content: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label class="setting-form-label required">机构名称</label>
          <input class="input-text" id="form-dept-name" placeholder="请输入机构名称" value="${editItem?.name || ''}" />
        </div>
        <div>
          <label class="setting-form-label">机构简称</label>
          <input class="input-text" id="form-dept-short" placeholder="请输入机构简称" value="${editItem?.shortName || ''}" />
        </div>
        <div>
          <label class="setting-form-label">负责人</label>
          <input class="input-text" id="form-dept-leader" placeholder="请输入负责人姓名" value="${editItem?.leader || ''}" />
        </div>
        <div>
          <label class="setting-form-label">排序</label>
          <input class="input-text" id="form-dept-sort" type="number" value="${editItem?.sort ?? 0}" />
        </div>
      </div>
    `,
    onOk: async (modal) => {
      const name = modal.querySelector('#form-dept-name').value.trim();
      const shortName = modal.querySelector('#form-dept-short').value.trim();
      const leader = modal.querySelector('#form-dept-leader').value.trim();
      const sort = Number(modal.querySelector('#form-dept-sort').value) || 0;

      if (!name) {
        showToast('请输入机构名称', 'error');
        return false;
      }
      try {
        await request(isEdit ? '/system/dept/update' : '/system/dept/create', {
          method: 'POST',
          body: JSON.stringify({ ...(isEdit ? { id: editItem.id } : {}), name, shortName, leader, sort })
        });
        showToast(isEdit ? '修改成功' : '创建成功', 'success');
        if (onSave) onSave();
      } catch (err) {
        showToast(err.message, 'error');
        return false;
      }
    }
  });
}

export function openPositionModal({ isEdit, editItem, onSave }) {
  showModal({
    title: isEdit ? '编辑岗位' : '新建岗位',
    content: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label class="setting-form-label required">岗位名称</label>
          <input class="input-text" id="form-pos-name" placeholder="请输入岗位名称" value="${editItem?.name || ''}" />
        </div>
        <div>
          <label class="setting-form-label required">岗位编码</label>
          <input class="input-text" id="form-pos-code" placeholder="请输入岗位编码" value="${editItem?.code || ''}" />
        </div>
        <div>
          <label class="setting-form-label">数据权限</label>
          <select class="select-box" id="form-pos-perm">
            <option value="1" ${editItem?.dataPermissionType === 1 ? 'selected' : ''}>全部数据权限</option>
            <option value="2" ${editItem?.dataPermissionType === 2 ? 'selected' : ''}>本部门及以下数据权限</option>
            <option value="3" ${editItem?.dataPermissionType === 3 ? 'selected' : ''}>本部门数据权限</option>
            <option value="4" ${editItem?.dataPermissionType === 4 ? 'selected' : ''}>仅本人数据权限</option>
          </select>
        </div>
      </div>
    `,
    onOk: async (modal) => {
      const name = modal.querySelector('#form-pos-name').value.trim();
      const code = modal.querySelector('#form-pos-code').value.trim();
      const dataPermissionType = Number(modal.querySelector('#form-pos-perm').value);

      if (!name || !code) {
        showToast('请填写必填项', 'error');
        return false;
      }
      try {
        await request(isEdit ? '/system/position/update' : '/system/position/create', {
          method: 'POST',
          body: JSON.stringify({ ...(isEdit ? { id: editItem.id } : {}), name, code, dataPermissionType })
        });
        showToast(isEdit ? '修改成功' : '创建成功', 'success');
        if (onSave) onSave();
      } catch (err) {
        showToast(err.message, 'error');
        return false;
      }
    }
  });
}

export function openDictModal({ isEdit, editItem, onSave }) {
  showModal({
    title: isEdit ? '编辑字典' : '新建字典',
    content: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label class="setting-form-label required">字典名称</label>
          <input class="input-text" id="form-dict-name" placeholder="请输入字典名称" value="${editItem?.name || ''}" />
        </div>
        <div>
          <label class="setting-form-label required">字典编码</label>
          <input class="input-text" id="form-dict-code" placeholder="请输入字典编码" value="${editItem?.code || ''}" />
        </div>
        <div>
          <label class="setting-form-label">字典类型</label>
          <input class="input-text" id="form-dict-type" placeholder="请输入字典类型" value="${editItem?.type || '系统字典'}" />
        </div>
        <div>
          <label class="setting-form-label">描述</label>
          <input class="input-text" id="form-dict-remark" placeholder="请输入描述" value="${editItem?.remark || ''}" />
        </div>
      </div>
    `,
    onOk: async (modal) => {
      const name = modal.querySelector('#form-dict-name').value.trim();
      const code = modal.querySelector('#form-dict-code').value.trim();
      const type = modal.querySelector('#form-dict-type').value.trim();
      const remark = modal.querySelector('#form-dict-remark').value.trim();

      if (!name || !code) {
        showToast('请填写必填项', 'error');
        return false;
      }
      try {
        await request(isEdit ? '/system/dict/update' : '/system/dict/create', {
          method: 'POST',
          body: JSON.stringify({ ...(isEdit ? { id: editItem.id } : {}), name, code, type, remark })
        });
        showToast(isEdit ? '修改成功' : '创建成功', 'success');
        if (onSave) onSave();
      } catch (err) {
        showToast(err.message, 'error');
        return false;
      }
    }
  });
}
