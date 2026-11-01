/* Shared anonymous question votes; separate from Waline comment likes. */
(function () {
  'use strict';
  var VOTER_KEY = 'actuary-question-voter-v1';
  var UPDATE_KEY = 'actuary-question-vote-update-v1';
  var voterMemory = '', active = null, ranking = null;
  var cache = new Map(), pending = new Map();
  var cooldownUntil = 0, cooldownTimer = null;

  function serverURL() {
    var config = window.ACTUARY_COMMENTS || {};
    if (config.enabled !== true || !config.serverURL) return '';
    try {
      var url = new URL(config.serverURL);
      var local = url.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
      if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash) return '';
      return url.href.replace(/\/+$/, '');
    } catch (_) { return ''; }
  }

  function voterId() {
    try {
      var stored = window.localStorage.getItem(VOTER_KEY);
      if (/^[a-f0-9]{64}$/.test(stored || '')) return (voterMemory = stored);
    } catch (_) {}
    if (voterMemory) return voterMemory;
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') return '';
    var bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    voterMemory = Array.from(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
    try { window.localStorage.setItem(VOTER_KEY, voterMemory); } catch (_) {}
    return voterMemory;
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function endpointRequest(path, options, controller) {
    var base = serverURL();
    if (!base) return Promise.reject(new Error('UNAVAILABLE'));
    var timer = window.setTimeout(function () { controller.abort(); }, 15000);
    return fetch(base + path, Object.assign({
      method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal
    }, options)).then(async function (response) {
      var payload;
      try { payload = await response.json(); } catch (_) { throw new Error('INVALID_RESPONSE'); }
      if (!response.ok || !payload || payload.errno !== 0) {
        var error = new Error('REQUEST_FAILED');
        error.status = response.status;
        throw error;
      }
      return payload.data;
    }).finally(function () { window.clearTimeout(timer); });
  }

  function validCount(value) { return Number.isSafeInteger(value) && value >= 0; }
  function validateVote(data, id) {
    if (!data || data.questionId !== id || !validCount(data.likes) || !validCount(data.dislikes) || ![1, -1, 0].includes(data.myVote)) throw new Error('INVALID_RESPONSE');
    return { questionId: id, likes: data.likes, dislikes: data.dislikes, myVote: data.myVote };
  }

  function paintVotes(state) {
    if (active !== state) return;
    var data = state.data;
    var busy = pending.has(state.id);
    var cooling = Date.now() < cooldownUntil;
    state.up.textContent = '有价值 · ' + (data ? data.likes : '—');
    state.down.textContent = '无价值 · ' + (data ? data.dislikes : '—');
    state.up.setAttribute('aria-pressed', String(!!data && data.myVote === 1));
    state.down.setAttribute('aria-pressed', String(!!data && data.myVote === -1));
    state.up.disabled = state.down.disabled = !state.canVote || !data || pending.size > 0 || cooling || state.needsRefresh || !voterId();
    state.section.setAttribute('aria-busy', String(state.loading || busy));
    state.status.textContent = busy ? '正在保存评价…' : state.error || (state.loading ? '正在更新票数…' : data ? '所有访客共享票数' : '正在加载票数…');
    state.status.classList.toggle('vote-error', !!state.error);
    state.retry.hidden = !state.error;
    state.help.textContent = state.canVote ? (data && data.myVote !== 0 ? '已记录你的评价。再次点击同一选项可撤销，也可以改选。' : '匿名评价，两个选项只能选一个；可随时改选或撤销。') : '先核对答案、阅读题解，再评价这道题。';
  }

  function refreshVotes(state) {
    if (active !== state || pending.has(state.id)) return;
    if (state.controller) state.controller.abort();
    var sequence = ++state.sequence;
    var voter = voterId();
    var controller = new AbortController();
    state.controller = controller;
    state.loading = true;
    state.error = '';
    paintVotes(state);
    endpointRequest('/api/question-vote?questionId=' + state.id, { headers: voter ? { 'x-study-voter': voter } : {} }, controller)
      .then(function (data) {
        data = validateVote(data, state.id);
        if (active !== state || sequence !== state.sequence || voter !== voterId()) return;
        state.data = data;
        state.needsRefresh = false;
        cache.set(state.id, { data: data, voter: voter, at: Date.now() });
      }).catch(function (error) {
        if (active !== state || sequence !== state.sequence) return;
        state.error = error.status === 429 ? '刷新太快，请稍后重试。' : '票数暂时未能加载，请重试。';
      }).finally(function () {
        if (active === state && sequence === state.sequence) { state.loading = false; paintVotes(state); }
      });
  }

  function broadcast(id) {
    try { window.localStorage.setItem(UPDATE_KEY, JSON.stringify({ questionId: id, at: Date.now(), nonce: Math.random() })); } catch (_) {}
  }

  function submitVote(state, choice) {
    if (active !== state || !state.canVote || !state.data || state.needsRefresh || pending.size > 0 || Date.now() < cooldownUntil) return;
    var voter = voterId();
    if (!voter) return;
    var value = state.data.myVote === choice ? 0 : choice;
    var id = state.id;
    if (state.controller) state.controller.abort();
    state.sequence += 1;
    state.loading = false;
    state.error = '';
    pending.set(id, true);
    paintVotes(state);
    // PUT sets the desired value. Never update totals optimistically or retry a
    // write automatically after an uncertain network result.
    endpointRequest('/api/question-vote', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-study-voter': voter },
      body: JSON.stringify({ questionId: id, vote: value })
    }, new AbortController()).then(function (data) {
      data = validateVote(data, id);
      if (voter !== voterId()) return;
      cache.set(id, { data: data, voter: voter, at: Date.now() });
      if (active && active.id === id) {
        if (active.controller) active.controller.abort();
        active.sequence += 1;
        active.data = data;
        active.needsRefresh = false;
        active.error = '';
        active.loading = false;
      }
      broadcast(id);
    }).catch(function (error) {
      cache.delete(id);
      if (active && active.id === id) {
        active.error = error.status === 429 ? '操作太快，请稍后刷新票数再试。' : '暂未确认评价结果，请刷新票数后再试。';
        active.needsRefresh = true;
      }
    }).finally(function () {
      pending.delete(id);
      cooldownUntil = Date.now() + 1100;
      if (cooldownTimer) window.clearTimeout(cooldownTimer);
      cooldownTimer = window.setTimeout(function () { if (active) paintVotes(active); }, 1120);
      if (active) {
        paintVotes(active);
        // Another tab may have replaced the voter while this PUT was in flight.
        // The old response cannot restore that identity; reconcile the new one.
        if ((!active.data || active.needsRefresh) && !active.error) refreshVotes(active);
      }
    });
  }

  function unmount() {
    if (!active) return;
    if (active.controller) active.controller.abort();
    active.sequence += 1;
    active.section.remove();
    active.container.hidden = true;
    active = null;
  }

  function mount(container, options) {
    var id = options && Number(options.questionId);
    if (!container || !serverURL() || !Number.isSafeInteger(id) || id < 1) { unmount(); if (container) container.hidden = true; return; }
    if (active && active.id === id) {
      if (active.container !== container) { active.container.hidden = true; container.appendChild(active.section); active.container = container; }
      active.canVote = !!options.canVote;
      container.hidden = false;
      paintVotes(active);
      return;
    }
    unmount();
    var section = node('section', 'question-vote-panel');
    var title = node('h2', 'question-vote-title', '这道题对你有价值吗？');
    var group = node('div', 'question-vote-buttons');
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', '第 ' + id + ' 题的价值评价');
    var up = node('button', 'question-vote-button vote-positive', '有价值 · —');
    var down = node('button', 'question-vote-button vote-negative', '无价值 · —');
    up.type = down.type = 'button'; group.appendChild(up); group.appendChild(down);
    var status = node('p', 'question-vote-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    var help = node('p', 'question-vote-help');
    var retry = node('button', 'question-vote-retry', '刷新票数'); retry.type = 'button'; retry.hidden = true;
    section.appendChild(title); section.appendChild(group); section.appendChild(status); section.appendChild(help); section.appendChild(retry);
    container.appendChild(section); container.hidden = false;
    var cached = cache.get(id), voter = voterId();
    var state = { id: id, container: container, section: section, up: up, down: down, status: status, help: help, retry: retry,
      data: cached && cached.voter === voter ? cached.data : null, canVote: !!options.canVote, controller: null,
      sequence: 0, loading: false, error: '', needsRefresh: false };
    active = state;
    up.addEventListener('click', function () { submitVote(state, 1); });
    down.addEventListener('click', function () { submitVote(state, -1); });
    retry.addEventListener('click', function () { refreshVotes(state); });
    paintVotes(state);
    if (!cached || cached.voter !== voter || Date.now() - cached.at > 30000) refreshVotes(state);
  }

  function rankProof(options) {
    try { var proof = options.getProof(); return /^[a-f0-9]{64}$/.test(proof || '') ? proof : ''; } catch (_) { return ''; }
  }

  function unmountRankings() {
    if (!ranking) return;
    if (ranking.controller) ranking.controller.abort();
    ranking.sequence += 1;
    ranking.section.remove();
    ranking.container.hidden = true;
    ranking = null;
  }

  function loadRanking(state) {
    if (ranking !== state) return;
    var proof = rankProof(state.options);
    if (!proof || proof !== state.proof) { unmountRankings(); return; }
    if (state.controller) state.controller.abort();
    var controller = new AbortController(), sequence = ++state.sequence;
    state.controller = controller;
    state.status.textContent = '正在读取大家的评价…';
    state.retry.hidden = true;
    state.section.setAttribute('aria-busy', 'true');
    endpointRequest('/api/question-rank?sort=' + state.sort + '&limit=20', { headers: { 'x-study-access': proof } }, controller)
      .then(function (data) {
        if (ranking !== state || sequence !== state.sequence) return;
        if (proof !== rankProof(state.options)) { unmountRankings(); return; }
        if (!data || data.sort !== state.sort || !Array.isArray(data.items) || data.items.length > 20) throw new Error('INVALID_RESPONSE');
        var ids = new Set();
        var items = data.items.map(function (row) {
          if (!row || !Number.isSafeInteger(row.questionId) || row.questionId < 1 || !validCount(row.likes) || !validCount(row.dislikes) || ids.has(row.questionId)) throw new Error('INVALID_RESPONSE');
          ids.add(row.questionId);
          return row;
        }).filter(function (row) { return row[state.sort] > 0 && state.options.lookupQuestion(row.questionId); });
        items.sort(function (a, b) { return b[state.sort] - a[state.sort] || a.questionId - b.questionId; });
        state.list.replaceChildren();
        items.forEach(function (row, index) {
          var q = state.options.lookupQuestion(row.questionId);
          var item = node('li', 'question-ranking-item');
          var button = node('button', 'question-ranking-link'); button.type = 'button';
          button.appendChild(node('span', 'question-ranking-position', String(index + 1)));
          var text = node('span', 'question-ranking-description');
          text.appendChild(node('strong', '', '#' + row.questionId + ' · ' + q.topic));
          text.appendChild(node('small', '', q.module + ' · 有价值 ' + row.likes + ' · 无价值 ' + row.dislikes));
          button.appendChild(text); button.appendChild(node('span', 'question-ranking-open', '练这一题 →'));
          button.addEventListener('click', function () {
            if (ranking === state && rankProof(state.options) === state.proof) state.options.onOpen(row.questionId);
          });
          item.appendChild(button); state.list.appendChild(item);
        });
        state.status.textContent = items.length ? '按' + (state.sort === 'likes' ? '有价值' : '无价值') + '票数排序 · 同票数按题号排序' : '这类评价还没有收到投票。';
      }).catch(function (error) {
        if (ranking !== state || sequence !== state.sequence) return;
        if (proof !== rankProof(state.options)) { unmountRankings(); return; }
        if (error.status === 403) state.list.replaceChildren();
        state.status.textContent = error.status === 403 ? '榜单访问未通过验证，请重新验证密钥后再试。' : state.list.children.length ? '未能刷新榜单，以下为上次结果。请稍后重试。' : '榜单暂时未能加载，请稍后重试。';
        state.retry.hidden = false;
      }).finally(function () {
        if (ranking === state && sequence === state.sequence) state.section.setAttribute('aria-busy', 'false');
      });
  }

  function mountRankings(container, options) {
    var proof = options && rankProof(options);
    var sort = options && options.sort === 'dislikes' ? 'dislikes' : 'likes';
    if (!container || !proof || !serverURL()) { unmountRankings(); if (container) container.hidden = true; return; }
    if (ranking && ranking.sort === sort && ranking.proof === proof) {
      if (ranking.container !== container) { ranking.container.hidden = true; container.appendChild(ranking.section); ranking.container = container; }
      ranking.options = options; container.hidden = false; return;
    }
    unmountRankings();
    var section = node('section', 'question-ranking-results');
    var status = node('p', 'question-ranking-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    var list = node('ol', 'question-ranking-list');
    var retry = node('button', 'question-ranking-retry', '重新加载榜单'); retry.type = 'button'; retry.hidden = true;
    section.appendChild(status); section.appendChild(list); section.appendChild(retry);
    container.appendChild(section); container.hidden = false;
    var state = { container: container, section: section, status: status, list: list, retry: retry, options: options, sort: sort, proof: proof, controller: null, sequence: 0 };
    ranking = state;
    retry.addEventListener('click', function () { loadRanking(state); });
    loadRanking(state);
  }

  window.addEventListener('storage', function (event) {
    if (event.key === VOTER_KEY || event.key === null) {
      voterMemory = ''; cache.clear();
      if (active) { active.data = null; active.needsRefresh = true; paintVotes(active); refreshVotes(active); }
    } else if (event.key === UPDATE_KEY) {
      try {
        var update = JSON.parse(event.newValue || '{}');
        cache.delete(update.questionId);
        if (active && active.id === update.questionId) refreshVotes(active);
        if (ranking) loadRanking(ranking);
      } catch (_) {}
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { if (active) refreshVotes(active); if (ranking) loadRanking(ranking); }
  });
  window.ActuaryVotes = Object.freeze({ mount: mount, unmount: unmount, mountRankings: mountRankings, unmountRankings: unmountRankings });
})();
