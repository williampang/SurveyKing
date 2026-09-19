import { request } from '../shared/api.js';
import { showToast } from '../shared/layout.js';
import { openWhitelistModal } from './whitelist.js';

const questionCircleIcon = `
  <span class="setting-prompt" title="提示说明">
    <svg viewBox="64 64 896 896" focusable="false" width="14" height="14" fill="currentColor">
      <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 708c-22.1 0-40-17.9-40-40s17.9-40 40-40 40 17.9 40 40-17.9 40-40 40zm62.9-219.5a48.3 48.3 0 00-30.9 44.8V620c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8v-21.5c0-23.1 6.7-45.9 19.9-64.9 12.9-18.6 30.9-32.8 52.1-40.9 34-13.1 56-41.6 56-72.7 0-44.1-43.1-80-96-80s-96 35.9-96 80v7.6c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V420c0-39.3 17.2-76 48.4-103.3 31.4-26.3 71-40.7 113-40.7s81.6 14.5 111.6 40.7c30.2 25.3 47.4 62 47.4 101.3 0 57.8-38.1 109.8-97.1 132.5z"></path>
    </svg>
  </span>
`;

export function renderSetting(container, project, onReload) {
  const setting = project.setting || {};
  const answerSetting = setting.answerSetting || {};
  const isCollecting = (setting.status ?? project.status ?? 1) === 1;
  const whitelistType = Number(answerSetting.whitelistType) || 0;

  container.innerHTML = `
    <div class="setting-wrapper">
      <div class="setting-grid-row">
        <!-- 1. 问卷显示 -->
        <div class="setting-col">
          <div class="ant-card answer-setting">
            <div class="ant-card-head">
              <div class="ant-card-head-title">问卷显示</div>
              <div class="ant-card-extra">
                <button class="btn btn-sm ${isCollecting ? 'btn-primary' : ''}" id="toggle-status-btn" type="button">
                  ${isCollecting ? '▶ 正在回收' : '⏸ 已停止'}
                </button>
              </div>
            </div>
            <div class="ant-card-body">
              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>开启自动暂存 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.answerSaved ? 'ant-switch-checked' : ''}" data-key="answerSaved" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>显示题目序号 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.showIndex !== false ? 'ant-switch-checked' : ''}" data-key="showIndex" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>显示进度条 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.showProgress !== false ? 'ant-switch-checked' : ''}" data-key="showProgress" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>设置问卷默认答案 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.defaultAnswer ? 'ant-switch-checked' : ''}" data-key="defaultAnswer" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>一页一题 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.onePageOneQuestion ? 'ant-switch-checked' : ''}" data-key="onePageOneQuestion" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>显示答题卡</span>
                  <button class="ant-switch ${setting.showAnswerCard ? 'ant-switch-checked' : ''}" data-key="showAnswerCard" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>允许复制题目 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.allowCopy !== false ? 'ant-switch-checked' : ''}" data-key="allowCopy" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>问题校验 ${questionCircleIcon}</span>
                  <select class="select-box" style="width:130px;height:28px;padding:2px 8px;" id="validate-select">
                    <option value="blur" selected>离开时校验</option>
                    <option value="submit">提交时校验</option>
                  </select>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>默认语言 ${questionCircleIcon}</span>
                  <select class="select-box" style="width:140px;height:28px;padding:2px 8px;" id="lang-select">
                    <option value="browser" selected>跟随浏览器语言</option>
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 回收设置 -->
        <div class="setting-col">
          <div class="ant-card answer-setting">
            <div class="ant-card-head">
              <div class="ant-card-head-title">回收设置</div>
            </div>
            <div class="ant-card-body">
              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>需要登录 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.loginRequired ? 'ant-switch-checked' : ''}" data-key="loginRequired" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>只能微信填写 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.wechatOnly ? 'ant-switch-checked' : ''}" data-key="wechatOnly" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>凭密码填写 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.password ? 'ant-switch-checked' : ''}" data-key="password" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>每台电脑或手机答题限制 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.maxAnswersPerDevice ? 'ant-switch-checked' : ''}" data-key="maxAnswersPerDevice" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>每个IP答题次数限制 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.maxAnswersPerIp ? 'ant-switch-checked' : ''}" data-key="maxAnswersPerIp" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>每个登录账号答题限制 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.maxAnswersPerUser ? 'ant-switch-checked' : ''}" data-key="maxAnswersPerUser" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>设置问卷结束时间</span>
                  <button class="ant-switch ${setting.endTime ? 'ant-switch-checked' : ''}" data-key="endTime" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>设置问卷回收上限</span>
                  <button class="ant-switch ${setting.maxAnswers ? 'ant-switch-checked' : ''}" data-key="maxAnswers" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>答题白名单设置 ${questionCircleIcon}</span>
                  <div style="display: flex; align-items: center;">
                    ${(whitelistType === 3 || whitelistType === 4) ? `
                      <a id="open-whitelist-btn" style="color: #1890ff; margin-right: 8px; cursor: pointer; font-size: 13px;">设置</a>
                    ` : ''}
                    <div class="ant-radio-button-group" id="whitelist-type-group">
                      <button class="ant-radio-btn ${!whitelistType ? 'active' : ''}" data-type="0" type="button">关闭</button>
                      <button class="ant-radio-btn ${whitelistType === 3 ? 'active' : ''}" data-type="3" type="button">系统</button>
                      <button class="ant-radio-btn ${whitelistType === 4 ? 'active' : ''}" data-type="4" type="button">外部</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. 投放与分享 -->
        <div class="setting-col">
          <div class="ant-card answer-setting">
            <div class="ant-card-head">
              <div class="ant-card-head-title">投放与分享</div>
            </div>
            <div class="ant-card-body">
              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>答题完成后跳转自定义页面 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.customPage ? 'ant-switch-checked' : ''}" data-key="customPage" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>答题完成后跳转自定义链接 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.redirectUrl ? 'ant-switch-checked' : ''}" data-key="redirectUrl" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div style="font-size:14px;margin-bottom:8px;">问卷链接</div>
                <div class="open-target-box">
                  <input class="input-text" id="public-link-input" readonly value="${window.location.origin}/s/${project.id}" />
                  <button class="btn btn-primary" id="open-link-btn" type="button">打 开</button>
                </div>
                <div style="margin-top:8px;">
                  <button class="btn btn-sm" id="download-qr-btn" type="button">下载二维码</button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>允许修改答案 ${questionCircleIcon}</span>
                  <button class="ant-switch ${setting.allowUpdateAnswer ? 'ant-switch-checked' : ''}" data-key="allowUpdateAnswer" type="button">
                    <span class="ant-switch-handle"></span>
                  </button>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-item-switch">
                  <span>公开查询设置</span>
                  <button class="btn btn-sm" type="button" onclick="window.showToast?.('公开查询功能已开启', 'info')">点击设置</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. 协作管理员列表 -->
        <div class="setting-col">
          <div class="ant-card answer-setting">
            <div class="ant-card-head">
              <div class="ant-card-head-title">协作管理员列表</div>
              <div class="ant-card-extra">
                <a style="font-size:13px;cursor:pointer;" onclick="window.showToast?.('已打开协作管理员设置', 'info')">设置协作管理员</a>
              </div>
            </div>
            <div class="ant-card-body" style="padding:16px 24px;">
              <div class="admin-list-item">
                <div class="admin-avatar-wrap">
                  <span class="admin-avatar">A</span>
                  <div>
                    <h4 style="margin:0;font-size:14px;">Admin</h4>
                  </div>
                </div>
                <span style="font-size:13px;color:var(--text-muted);">创建者</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind Open Link
  container.querySelector('#open-link-btn')?.addEventListener('click', () => {
    window.open(`/s/${project.id}`, '_blank');
  });

  container.querySelector('#download-qr-btn')?.addEventListener('click', () => {
    showToast('已生成问卷二维码', 'success');
  });

  // Bind Status Toggle
  container.querySelector('#toggle-status-btn')?.addEventListener('click', async () => {
    const nextStatus = isCollecting ? 0 : 1;
    try {
      await request('/project/update', {
        method: 'POST',
        body: JSON.stringify({
          id: project.id,
          settingKey: 'status',
          settingValue: nextStatus
        })
      });
      showToast(nextStatus === 1 ? '已恢复回收' : '已停止回收', 'success');
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Bind Switches
  container.querySelectorAll('.ant-switch').forEach((sw) => {
    sw.addEventListener('click', async () => {
      const key = sw.dataset.key;
      const willCheck = !sw.classList.contains('ant-switch-checked');
      sw.classList.toggle('ant-switch-checked', willCheck);
      try {
        await request('/project/update', {
          method: 'POST',
          body: JSON.stringify({
            id: project.id,
            settingKey: key,
            settingValue: willCheck
          })
        });
        showToast('设置已保存', 'success');
      } catch (err) {
        sw.classList.toggle('ant-switch-checked', !willCheck);
        showToast(err.message, 'error');
      }
    });
  });

  // Bind Whitelist Modal
  container.querySelector('#open-whitelist-btn')?.addEventListener('click', () => {
    openWhitelistModal({ project, onUpdate: onReload });
  });

  // Bind Whitelist Type Group
  container.querySelectorAll('#whitelist-type-group .ant-radio-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const typeVal = Number(btn.dataset.type);
      try {
        await request('/project/update', {
          method: 'POST',
          body: JSON.stringify({
            id: project.id,
            settingKey: 'answerSetting.whitelistType',
            settingValue: typeVal === 0 ? null : typeVal
          })
        });
        showToast('白名单设置已更新', 'success');
        if (onReload) onReload();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
