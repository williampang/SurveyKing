import { request } from '../shared/api.js';
import { showToast } from '../shared/layout.js';

export async function loadSystemSettings() {
  try {
    const [sys, ai, oauth] = await Promise.all([
      request('/system'),
      request('/system/aiSetting'),
      request('/system/oauthSetting')
    ]);
    return { sys: sys || {}, ai: ai || {}, oauth: oauth || {} };
  } catch (err) {
    showToast(err.message, 'error');
    return { sys: {}, ai: {}, oauth: {} };
  }
}

export function renderInfoTab(container, systemInfo, onReload) {
  container.innerHTML = `
    <div class="setting-panel-title">系统信息</div>
    <div style="display:flex;gap:40px;">
      <div style="flex:1;">
        <div class="setting-form-item">
          <label class="setting-form-label required">系统名称 (版本号v${systemInfo.version || '1.13.0'})</label>
          <input class="input-text" id="sys-name" value="${systemInfo.name || ''}" placeholder="请输入系统名称" />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">描述信息</label>
          <input class="input-text" id="sys-desc" value="${systemInfo.description || ''}" placeholder="请输入描述信息" />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">版权信息</label>
          <input class="input-text" id="sys-copyright" value="${systemInfo.setting?.copyright || ''}" placeholder="请输入版权说明" />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">备案号</label>
          <input class="input-text" id="sys-record" value="${systemInfo.setting?.recordNum || ''}" placeholder="请输入工信部ICP备案号" />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">高德地图 Key</label>
          <input class="input-text" id="sys-amap-key" value="${systemInfo.setting?.amapKey || ''}" placeholder="请输入高德地图Key" />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label">高德地图安全密钥</label>
          <input class="input-text" id="sys-amap-secret" value="${systemInfo.setting?.amapSecret || ''}" placeholder="请输入高德地图安全密钥" />
        </div>
        <div class="setting-form-item">
          <label class="setting-form-label required">单个文件上传上限 (MB)</label>
          <input class="input-text" id="sys-max-upload" type="number" value="${systemInfo.setting?.maxUploadSizeMb ?? 200}" style="width:140px;" />
          <div class="setting-form-help">默认 200 MB，保存后立即生效。题目设置了更小的上限时，以题目设置为准。</div>
        </div>
        <div class="setting-form-item" style="display:flex;align-items:center;gap:12px;">
          <label class="setting-form-label" style="margin:0;">开启注册</label>
          <button class="ant-switch ${systemInfo.registerInfo?.registerEnabled ? 'ant-switch-checked' : ''}" id="sys-register-switch" type="button">
            <span class="ant-switch-handle"></span>
          </button>
        </div>
        <div class="setting-form-item" style="display:flex;align-items:center;gap:12px;">
          <label class="setting-form-label" style="margin:0;">开启验证码</label>
          <button class="ant-switch ${systemInfo.setting?.captchaEnabled ? 'ant-switch-checked' : ''}" id="sys-captcha-switch" type="button">
            <span class="ant-switch-handle"></span>
          </button>
        </div>
        <div style="margin-top:28px;display:flex;gap:12px;">
          <button class="btn btn-primary" id="save-sys-info-btn" type="button">提 交</button>
          <button class="btn" id="reset-sys-info-btn" type="button">重 置</button>
        </div>
      </div>
      <div style="width:160px;text-align:center;">
        <img src="/logo.svg" alt="logo" style="width:80px;height:80px;margin-bottom:12px;" />
        <div>
          <button class="btn btn-sm" type="button" onclick="window.showToast?.('上传功能可用', 'info')">更换图标</button>
        </div>
      </div>
    </div>
  `;

  ['sys-register-switch', 'sys-captcha-switch'].forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('ant-switch-checked');
    });
  });

  container.querySelector('#save-sys-info-btn')?.addEventListener('click', async () => {
    const name = container.querySelector('#sys-name').value.trim();
    const description = container.querySelector('#sys-desc').value.trim();
    const copyright = container.querySelector('#sys-copyright').value.trim();
    const recordNum = container.querySelector('#sys-record').value.trim();
    const amapKey = container.querySelector('#sys-amap-key').value.trim();
    const amapSecret = container.querySelector('#sys-amap-secret').value.trim();
    const maxUploadSizeMb = Number(container.querySelector('#sys-max-upload').value) || 200;
    const registerEnabled = container.querySelector('#sys-register-switch').classList.contains('ant-switch-checked');
    const captchaEnabled = container.querySelector('#sys-captcha-switch').classList.contains('ant-switch-checked');

    try {
      await request('/system/update', {
        method: 'POST',
        body: JSON.stringify({
          ...systemInfo,
          name,
          description,
          registerInfo: { ...(systemInfo.registerInfo || {}), registerEnabled },
          setting: {
            ...(systemInfo.setting || {}),
            copyright,
            recordNum,
            amapKey,
            amapSecret,
            maxUploadSizeMb,
            captchaEnabled
          }
        })
      });
      showToast('系统设置更新成功', 'success');
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  container.querySelector('#reset-sys-info-btn')?.addEventListener('click', () => {
    if (onReload) onReload();
  });
}

export function renderAiTab(container, aiSetting, systemInfo, onReload) {
  const isAiEnabled = aiSetting.enabled !== false;
  container.innerHTML = `
    <div class="setting-panel-title">AI设置</div>
    <div class="setting-form-item" style="display:flex;align-items:center;gap:12px;">
      <label class="setting-form-label" style="margin:0;">启用AI功能</label>
      <button class="ant-switch ${isAiEnabled ? 'ant-switch-checked' : ''}" id="ai-enable-switch" type="button">
        <span class="ant-switch-handle"></span>
      </button>
      <span class="setting-form-help">开启后，用户可以通过 OpenAI-compatible 模型智能创建问卷</span>
    </div>
    <div class="setting-form-item">
      <label class="setting-form-label required">API Base URL</label>
      <input class="input-text" id="ai-base-url" value="${aiSetting.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'}" placeholder="请输入 OpenAI-compatible API 地址" />
      <div class="setting-form-help">请输入 OpenAI-compatible API 地址，通常以 /v1 结尾</div>
    </div>
    <div class="setting-form-item">
      <label class="setting-form-label">API Key</label>
      <input class="input-text" id="ai-api-key" type="password" placeholder="请输入模型服务的 API Key (留空保留当前配置)" />
      <div class="setting-form-help">密钥不会回显；留空将保留当前已配置的密钥</div>
    </div>
    <div class="setting-form-item">
      <label class="setting-form-label required">模型列表</label>
      <input class="input-text" id="ai-models" value="${(aiSetting.models || ['qwen3.8-max']).join(',')}" placeholder="例如: qwen3.8-max, gpt-4o" />
      <div class="setting-form-help">填写服务实际支持的模型 ID，多个以英文逗号分割</div>
    </div>
    <div class="setting-form-item">
      <label class="setting-form-label required">默认模型</label>
      <input class="input-text" id="ai-default-model" value="${aiSetting.defaultModel || 'qwen3.8-max'}" placeholder="请输入默认使用的模型ID" />
      <div class="setting-form-help">用户未主动选择模型时使用此模型</div>
    </div>
    <div class="setting-form-item">
      <label class="setting-form-label">系统提示词（选填）</label>
      <textarea class="input-text" id="ai-prompt" style="height:90px;padding:8px 11px;" placeholder="系统已内置用于生成问卷内容的默认提示词；留空时自动使用，如需自定义请在此输入">${aiSetting.prompt || ''}</textarea>
    </div>
    <div style="margin-top:28px;display:flex;gap:12px;">
      <button class="btn btn-primary" id="save-ai-setting-btn" type="button">提 交</button>
      <button class="btn" id="reset-ai-setting-btn" type="button">重 置</button>
    </div>
  `;

  container.querySelector('#ai-enable-switch')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('ant-switch-checked');
  });

  container.querySelector('#save-ai-setting-btn')?.addEventListener('click', async () => {
    const enabled = container.querySelector('#ai-enable-switch').classList.contains('ant-switch-checked');
    const baseUrl = container.querySelector('#ai-base-url').value.trim();
    const apiKey = container.querySelector('#ai-api-key').value.trim();
    const models = container.querySelector('#ai-models').value.split(',').map(m => m.trim()).filter(Boolean);
    const defaultModel = container.querySelector('#ai-default-model').value.trim();
    const prompt = container.querySelector('#ai-prompt').value.trim();

    try {
      await request('/system/update', {
        method: 'POST',
        body: JSON.stringify({
          ...systemInfo,
          aiSetting: {
            enabled,
            baseUrl,
            ...(apiKey ? { apiKey } : {}),
            models,
            defaultModel,
            prompt
          }
        })
      });
      showToast('AI设置更新成功', 'success');
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  container.querySelector('#reset-ai-setting-btn')?.addEventListener('click', () => {
    if (onReload) onReload();
  });
}

export function renderOAuthTab(container, oauthSetting, onReload) {
  container.innerHTML = `
    <div class="setting-panel-title">第三方登录配置</div>
    <div class="toast-notice" style="position:static;transform:none;margin-bottom:20px;background:#fffbe6;border:1px solid #ffe58f;color:#fa8c16;">
      <span>ℹ</span>
      <span>应用密钥保存在服务器数据库中，不会返回浏览器或显示在公共接口。</span>
    </div>
    <div class="setting-form-item">
      <label class="setting-form-label">系统外部访问地址</label>
      <input class="input-text" id="oauth-redirect-url" value="${oauthSetting.redirectUrl || ''}" placeholder="https://survey.example.com" />
      <div class="setting-form-help">支持 HTTP 和 HTTPS，例如 http://192.168.1.3:8000。不要包含路径或末尾斜杠。</div>
    </div>
    <div class="setting-form-item" style="border:1px solid var(--border-color);border-radius:4px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>Google 登录</strong>
        <button class="ant-switch ${oauthSetting.google?.enabled ? 'ant-switch-checked' : ''}" id="oauth-google-switch" type="button">
          <span class="ant-switch-handle"></span>
        </button>
      </div>
    </div>
    <div class="setting-form-item" style="border:1px solid var(--border-color);border-radius:4px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>微信网站扫码登录</strong>
        <button class="ant-switch ${oauthSetting.wechatWeb?.enabled ? 'ant-switch-checked' : ''}" id="oauth-wechat-web-switch" type="button">
          <span class="ant-switch-handle"></span>
        </button>
      </div>
    </div>
    <div class="setting-form-item" style="border:1px solid var(--border-color);border-radius:4px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>微信公众号内登录</strong>
        <button class="ant-switch ${oauthSetting.wechatOfficial?.enabled ? 'ant-switch-checked' : ''}" id="oauth-wechat-official-switch" type="button">
          <span class="ant-switch-handle"></span>
        </button>
      </div>
    </div>
    <div style="margin-top:28px;display:flex;gap:12px;">
      <button class="btn btn-primary" id="save-oauth-btn" type="button">提 交</button>
      <button class="btn" id="reset-oauth-btn" type="button">重 置</button>
    </div>
  `;

  ['oauth-google-switch', 'oauth-wechat-web-switch', 'oauth-wechat-official-switch'].forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('ant-switch-checked');
    });
  });

  container.querySelector('#save-oauth-btn')?.addEventListener('click', async () => {
    const redirectUrl = container.querySelector('#oauth-redirect-url').value.trim();
    const google = { enabled: container.querySelector('#oauth-google-switch').classList.contains('ant-switch-checked') };
    const wechatWeb = { enabled: container.querySelector('#oauth-wechat-web-switch').classList.contains('ant-switch-checked') };
    const wechatOfficial = { enabled: container.querySelector('#oauth-wechat-official-switch').classList.contains('ant-switch-checked') };

    try {
      await request('/system/oauthSetting', {
        method: 'POST',
        body: JSON.stringify({ redirectUrl, google, wechatWeb, wechatOfficial })
      });
      showToast('第三方登录配置更新成功', 'success');
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  container.querySelector('#reset-oauth-btn')?.addEventListener('click', () => {
    if (onReload) onReload();
  });
}

export function renderBackupTab(container) {
  container.innerHTML = `
    <div class="setting-panel-title">数据备份</div>
    <div class="toast-notice" style="position:static;transform:none;margin-bottom:20px;background:#e6f7ff;border:1px solid #91d5ff;color:#1890ff;">
      <span>ℹ</span>
      <div>
        <div>备份包含数据库和上传附件，支持相同系统版本的 H2 与 MySQL 双向迁移。</div>
        <div>导入会覆盖当前数据和附件。请先导出现有备份，并在暂停答题、上传等写入操作后进行迁移。</div>
      </div>
    </div>
    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <button class="btn btn-primary" id="backup-export-btn" type="button">☁ 导出备份</button>
      <label class="btn" style="cursor:pointer;">
        ☁ 导入备份
        <input type="file" id="backup-import-file" style="display:none;" />
      </label>
    </div>
    <p style="color:var(--text-muted);font-size:13px;">当前系统：卷王问卷考试系统。建议在导入前先执行一次导出备份。</p>
  `;

  container.querySelector('#backup-export-btn')?.addEventListener('click', () => {
    window.open('/api/system/backup/export', '_blank');
    showToast('备份文件下载已触发', 'success');
  });

  container.querySelector('#backup-import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast(`准备恢复备份文件: ${file.name}`, 'info');
  });
}
