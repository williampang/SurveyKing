import { request } from '../shared/api.js';
import { initLayout, showModal, showToast } from '../shared/layout.js';

export const pathname = window.location.pathname;
export let currentTab = pathname.includes('role') ? 'role'
  : pathname.includes('dept') ? 'dept'
  : pathname.includes('position') ? 'position'
  : pathname.includes('dict') ? 'dict'
  : pathname.includes('setting') ? 'setting'
  : 'user';

export let dataList = [];
export let deptTree = [];
export let roleList = [];
export let selectedDeptId = '';
export let searchKeyword = '';
export let settingSubTab = 'info';

export let systemInfo = {};
export let aiSetting = {};
export let oauthSetting = {};
