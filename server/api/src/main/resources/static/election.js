/* 选举（实时投票统计）页逻辑：运行于后台 /survey/:id/election 的 iframe 内。
 * 上下文由父页面通过 srcdoc 注入 window.ELECTION_CTX = { id, mode, v }。
 * 数据契约与后台报表一致：GET /api/project?id= 与 GET /api/report/<id>。
 */
(function () {
  'use strict';

  var ctx = window.ELECTION_CTX || {};
  var projectId = ctx.id || '';
  var REFRESH_MS = 10000;

  // 候选人题的三个统计选项（与问卷选项标题一致）
  var OPTION_YES = '赞成';
  var OPTION_NO = '不赞成';
  var OPTION_ABSTAIN = '弃权';

  var autoRefresh = true;
  var timer = null;
  var loading = false;
  var project = null;
  var lastUpdated = null;

  var root = document.getElementById('election-root');
  root.style.maxWidth = '1024px';
  root.style.margin = '0 auto';
  root.parentNode.style.height = 'fit-content';
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function api(path) {
    return fetch('/api' + path, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).then(function (response) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('登录已失效，请在后台重新登录后刷新');
      }
      if (!response.ok) throw new Error('请求失败（' + response.status + '）');
      var contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) throw new Error('后台返回了非 JSON 响应');
      return response.json();
    }).then(function (payload) {
      if (payload && typeof payload === 'object' && payload.code !== undefined && payload.code !== 200) {
        throw new Error(payload.message || payload.msg || '请求失败');
      }
      return payload && payload.data !== undefined ? payload.data : payload;
    });
  }

  function formatTime(date) {
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(date.getFullYear()) + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }

  function renderError(message) {
    root.innerHTML =
      '<div class="elec-error">选举数据获取失败：' + escapeHtml(message) +
      '<br /><button class="elec-btn" id="elec-retry" type="button">重试</button></div>';
    var retry = document.getElementById('elec-retry');
    if (retry) retry.addEventListener('click', loadAll);
  }

  function renderShell() {
    root.innerHTML =
      '<div class="elec-header">' +
      '  <div>' +
      '    <h2 class="elec-header-title">选举 · ' + escapeHtml(project && project.name ? project.name : '投票统计') + '</h2>' +
      '    <div class="elec-header-meta">' +
      '      <span class="elec-live-dot' + (autoRefresh ? '' : ' off') + '" id="elec-live-dot"></span>' +
      '      <span id="elec-summary">加载统计数据中...</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="elec-controls">' +
      '    <label><input type="checkbox" id="elec-auto" ' + (autoRefresh ? 'checked' : '') + ' />自动刷新（10 秒）</label>' +
      '    <button class="elec-btn" id="elec-refresh" type="button">↻ 立即刷新</button>' +
      '    <button class="elec-btn" id="elec-print" type="button">打印结果</button>' +
      '  </div>' +
      '</div>' +
      '<div id="elec-cards"><div class="elec-loading">加载统计数据中...</div></div>';

    document.getElementById('elec-auto').addEventListener('change', function (event) {
      autoRefresh = event.target.checked;
      var dot = document.getElementById('elec-live-dot');
      if (dot) dot.className = 'elec-live-dot' + (autoRefresh ? '' : ' off');
      syncTimer();
    });
    document.getElementById('elec-refresh').addEventListener('click', function () { loadStats(true); });
    // 打印：在 iframe 内调用 window.print() 仅打印本文档；
    // 打印样式见 election.css 的 @media print（隐藏 .elec-header，只打印其下方内容）
    document.getElementById('elec-print').addEventListener('click', function () {
      window.print();
    });
  }

  // 从答卷列表聚合统计：选择题按选项计数，FillBlank 按填写文本计人名
  // （answer 结构：questionId -> {childId: true | "文本"}；仅统计 tempSave !== 0 的已完成答卷）
  function computeStats(list) {
    var fillBlankIds = {};
    ((project && project.survey && project.survey.children) || []).forEach(function (question) {
      if (question.type === 'FillBlank') fillBlankIds[question.id] = true;
    });

    var choice = {};
    var blanks = {};
    var ballots = 0;

    (list || []).forEach(function (item) {
      if (!item || item.tempSave === 0) return;
      ballots++;
      var answer = item.answer || {};
      Object.keys(answer).forEach(function (questionId) {
        var value = answer[questionId];
        if (!value || typeof value !== 'object') return;
        Object.keys(value).forEach(function (childId) {
          var cell = value[childId];
          if (cell === true) {
            choice[questionId] = choice[questionId] || {};
            choice[questionId][childId] = (choice[questionId][childId] || 0) + 1;
          } else if (fillBlankIds[questionId] && typeof cell === 'string' && cell.trim()) {
            var name = cell.trim();
            blanks[name] = (blanks[name] || 0) + 1;
          }
        });
      });
    });

    return { choice: choice, blanks: blanks, ballots: ballots };
  }

  function renderStats(computed) {
    var total = computed.ballots;
    var choice = computed.choice;
    var blanks = computed.blanks;
    lastUpdated = new Date();

    var summary = document.getElementById('elec-summary');
    if (summary) {
      summary.textContent = '共 ' + total + ' 票 · 更新于 ' + formatTime(lastUpdated) +
        (autoRefresh ? ' · 实时刷新中' : ' · 自动刷新已暂停');
    }

    var cards = document.getElementById('elec-cards');
    var questions = (project && project.survey && project.survey.children) || [];
    if (!questions.length) {
      cards.innerHTML = '<div class="elec-note">该问卷暂无题目。</div>';
      return;
    }

    // 选举结果统计表：选择题每題一行，按赞成/不赞成/弃权三选项取数；
    // FillBlank 每个填写文本即一个另选人姓名，记 1 个赞成票，按姓名汇总成行；
    // 占比列为按总票数堆叠的条形
    var rows = [];
    questions.forEach(function (question) {
      if (question.type !== 'Radio' && question.type !== 'Checkbox') return;
      var counts = choice[question.id] || {};
      var pick = function (title) {
        var options = question.children || [];
        for (var i = 0; i < options.length; i++) {
          if (options[i].title === title) return counts[options[i].id] || 0;
        }
        return null;
      };
      var yes = pick(OPTION_YES);
      var no = pick(OPTION_NO);
      var abstain = pick(OPTION_ABSTAIN);
      if (yes === null && no === null && abstain === null) return;
      rows.push({ name: question.title, yes: yes, no: no, abstain: abstain });
    });
    Object.keys(blanks).forEach(function (name) {
      rows.push({ name: name, yes: blanks[name], no: null, abstain: null });
    });
    // 排序：赞成倒序 → 弃权倒序 → 不赞成倒序
    rows.sort(function (a, b) {
      return (b.yes || 0) - (a.yes || 0) ||
        (b.abstain || 0) - (a.abstain || 0) ||
        (b.no || 0) - (a.no || 0);
    });

    if (!rows.length) {
      cards.innerHTML = '<div class="elec-note">暂无可统计的候选人题目（赞成/不赞成/弃权或另选人）。</div>';
      return;
    }

    var denom = total > 0 ? total : 0;
    var widthOf = function (count) {
      return denom > 0 ? ((count || 0) / denom) * 100 : 0;
    };
    var cellOf = function (value) {
      return value === null ? '' : String(value);
    };

    cards.innerHTML =
      '<div class="elec-table-title">' + escapeHtml(project && project.name ? project.name : '选举项目') + '<br>（投票统计结果）</div>' +
      '<p>共 ' + total + ' 票 · 更新于 ' + formatTime(lastUpdated) + '</p>' +
      '<table class="elec-table" style="width: 100%; border-collapse: collapse; table-layout: fixed; text-align: center;">' +
      '<thead><tr><th class="col-name">姓名</th><th>' + OPTION_YES + '</th><th>' + OPTION_NO + '</th><th>' + OPTION_ABSTAIN + '</th><th class="col-ratio">占比</th></tr></thead>' +
      '<tbody>' +
      rows.map(function (row) {
        return '<tr>' +
          '<td class="elec-name-center" title="' + escapeHtml(row.name) + '">' + escapeHtml(row.name || '未命名候选人') + '</td>' +
          '<td class="elec-num-center">' + cellOf(row.yes) + '</td>' +
          '<td class="elec-num-center">' + cellOf(row.no) + '</td>' +
          '<td class="elec-num-center">' + cellOf(row.abstain) + '</td>' +
          '<td class="elec-ratio"><div class="elec-stack">' +
          '<i class="elec-seg-yes" style="width:' + widthOf(row.yes) + '%;"></i>' +
          '<i class="elec-seg-no" style="width:' + widthOf(row.no) + '%;"></i>' +
          '<i class="elec-seg-abstain" style="width:' + widthOf(row.abstain) + '%;"></i>' +
          '</div></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  function loadStats(manual) {
    if (loading) return;
    loading = true;
    var button = document.getElementById('elec-refresh');
    if (button) button.disabled = true;
    api('/answer/list?current=1&pageSize=1000&projectId=' + encodeURIComponent(projectId) + '&total=0').then(function (payload) {
      renderStats(computeStats((payload && payload.list) || []));
    }).catch(function (error) {
      if (manual) renderError(error.message);
      var summary = document.getElementById('elec-summary');
      if (summary && !manual) summary.textContent = '刷新失败：' + error.message;
    }).then(function () {
      loading = false;
      var refresh = document.getElementById('elec-refresh');
      if (refresh) refresh.disabled = false;
    });
  }

  function syncTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (autoRefresh) {
      timer = setInterval(function () { loadStats(false); }, REFRESH_MS);
    }
  }

  function loadAll() {
    if (!projectId) {
      renderError('缺少问卷 id（ELECTION_CTX.id）');
      return;
    }
    api('/project?id=' + encodeURIComponent(projectId)).then(function (data) {
      project = data;
      document.title = '选举 - ' + (project && project.name ? project.name : projectId);
      renderShell();
      loadStats(true);
      syncTimer();
    }).catch(function (error) {
      renderError(error.message);
    });
  }

  loadAll();
})();
