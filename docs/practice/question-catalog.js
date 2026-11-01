/* Full question catalog. Access proofs live only in memory and request headers. */
(function () {
  'use strict';
  var active = null, tokenSeen = false, lastToken;
  var filters = { module: '', tag: '', sort: 'questionId', direction: 'asc', pageSize: 30, page: 1 };

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
  function proofOf(options) {
    try {
      var value = options && typeof options.getProof === 'function' ? options.getProof() : '';
      return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : '';
    } catch (_) { return ''; }
  }
  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(className, text, action) {
    var element = node('button', className, text);
    element.type = 'button'; element.addEventListener('click', action);
    return element;
  }
  function normalizedQuestions(input) {
    var seen = new Set();
    return (Array.isArray(input) ? input : []).filter(function (q) {
      if (!q || !Number.isSafeInteger(q.id) || q.id < 1 || seen.has(q.id)) return false;
      seen.add(q.id); return true;
    }).map(function (q) {
      return { id: q.id, module: String(q.module || ''), topic: String(q.topic || '题目'),
        stem: String(q.stem || '').replace(/\s+/g, ' ').trim(),
        tags: Array.isArray(q.tags) ? Array.from(new Set(q.tags.filter(function (tag) { return typeof tag === 'string' && tag; }))) : [] };
    });
  }
  function allowed(state) {
    if (active !== state) return false;
    if (!state.proof || proofOf(state.options) !== state.proof || serverURL() !== state.base) { unmount(); return false; }
    return true;
  }
  function applyInitial(options) {
    if (tokenSeen && options.filterToken === lastToken) return;
    tokenSeen = true; lastToken = options.filterToken;
    var input = options.initialFilters || {}, changed = false;
    ['module', 'tag'].forEach(function (name) {
      if (Object.prototype.hasOwnProperty.call(input, name)) { filters[name] = typeof input[name] === 'string' ? input[name] : ''; changed = true; }
    });
    if (['questionId', 'likes', 'dislikes'].includes(input.sort)) { filters.sort = input.sort; changed = true; }
    if (['asc', 'desc'].includes(input.direction)) { filters.direction = input.direction; changed = true; }
    if (changed) filters.page = 1;
  }
  function populate(select, choices, selected) {
    select.replaceChildren();
    choices.forEach(function (choice) {
      var option = node('option', '', choice[1]); option.value = choice[0]; select.appendChild(option);
    });
    select.value = String(selected);
  }
  function synchronizeFilters(state) {
    var modules = Array.from(new Set(state.questions.map(function (q) { return q.module; }).filter(Boolean)));
    if (filters.module && !modules.includes(filters.module)) filters.module = '';
    var tags = Array.from(new Set(state.questions.filter(function (q) { return !filters.module || q.module === filters.module; })
      .reduce(function (all, q) { return all.concat(q.tags); }, []))).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
    if (filters.tag && !tags.includes(filters.tag)) filters.tag = '';
    populate(state.module, [['', '全部模块']].concat(modules.map(function (value) { return [value, value]; })), filters.module);
    populate(state.tag, [['', '全部专题']].concat(tags.map(function (value) { return [value, value]; })), filters.tag);
    state.sort.value = filters.sort; state.direction.value = filters.direction; state.pageSize.value = String(filters.pageSize);
  }
  function orderedQuestions(state) {
    if (!state.counts) return [];
    return state.questions.filter(function (q) {
      return (!filters.module || q.module === filters.module) && (!filters.tag || q.tags.includes(filters.tag));
    }).sort(function (a, b) {
      var difference = filters.sort === 'questionId' ? a.id - b.id : state.counts.get(a.id)[filters.sort] - state.counts.get(b.id)[filters.sort];
      return difference ? (filters.direction === 'asc' ? difference : -difference) : a.id - b.id;
    });
  }
  function paint(state) {
    if (!allowed(state)) return;
    synchronizeFilters(state);
    var rows = orderedQuestions(state), pages = Math.max(1, Math.ceil(rows.length / filters.pageSize));
    // Keep a returning page while fetching; only a verified result can clamp it.
    if (state.counts) filters.page = Math.min(Math.max(1, filters.page), pages);
    state.section.setAttribute('aria-busy', String(state.loading));
    state.status.textContent = state.loading ? '正在加载题目目录与票数…' : state.error || '票数已更新。';
    state.status.classList.toggle('catalog-error', !!state.error);
    state.refresh.disabled = state.loading;
    state.refresh.textContent = state.error ? '重试加载' : '刷新票数';
    state.practice.disabled = !state.counts || !rows.length;
    state.practice.textContent = rows.length ? '按当前顺序练习 ' + rows.length + ' 题' : '按当前顺序练习';
    state.summary.textContent = state.counts ? '共 ' + rows.length + ' 题 · 第 ' + filters.page + ' / ' + pages + ' 页' : '';
    state.previous.disabled = !state.counts || filters.page <= 1;
    state.next.disabled = !state.counts || filters.page >= pages;
    state.pagination.hidden = !state.counts || !rows.length;
    state.empty.hidden = !state.counts || rows.length > 0;
    state.list.replaceChildren();
    rows.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize).forEach(function (q) {
      var item = node('li', 'question-catalog-item'); item.setAttribute('data-question-id', String(q.id));
      var title = node('h3', 'question-catalog-title', '#' + q.id + ' · ' + q.topic);
      item.appendChild(title);
      item.appendChild(node('p', 'question-catalog-meta', q.module + (q.tags.length ? ' · ' + q.tags.join(' / ') : '')));
      var footer = node('div', 'question-catalog-footer'), counts = state.counts.get(q.id);
      var badges = node('div', 'question-catalog-counts');
      badges.appendChild(node('span', 'catalog-likes', '有价值 ' + counts.likes));
      badges.appendChild(node('span', 'catalog-dislikes', '无价值 ' + counts.dislikes));
      footer.appendChild(badges);
      var open = button('question-catalog-open', '练这一题', function () {
        if (allowed(state) && state.counts && typeof state.options.onOpen === 'function') state.options.onOpen(q.id);
      });
      open.setAttribute('aria-label', '练习第 ' + q.id + ' 题：' + q.topic);
      footer.appendChild(open); item.appendChild(footer); state.list.appendChild(item);
    });
  }
  function validateCounts(data, state) {
    if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total !== data.items.length) throw new Error('INVALID_RESPONSE');
    var result = new Map();
    data.items.forEach(function (item) {
      if (!item || !Number.isSafeInteger(item.questionId) || item.questionId < 1 || result.has(item.questionId) ||
        !Number.isSafeInteger(item.likes) || item.likes < 0 || !Number.isSafeInteger(item.dislikes) || item.dislikes < 0) throw new Error('INVALID_RESPONSE');
      result.set(item.questionId, { likes: item.likes, dislikes: item.dislikes });
    });
    // Missing rows are an incomplete response, not evidence of zero votes.
    if (state.questions.some(function (q) { return !result.has(q.id); })) throw new Error('INVALID_RESPONSE');
    return result;
  }
  function refresh(state) {
    if (!allowed(state)) return;
    if (state.controller) state.controller.abort();
    var sequence = ++state.sequence, controller = new AbortController();
    state.controller = controller; state.loading = true; state.error = ''; state.counts = null;
    paint(state);
    var timer = window.setTimeout(function () { controller.abort(); }, 15000);
    fetch(state.base + '/api/question-catalog', {
      method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { 'x-study-access': state.proof }, signal: controller.signal
    }).then(async function (response) {
      var payload;
      try { payload = await response.json(); } catch (_) { payload = null; }
      if (!response.ok || !payload || payload.errno !== 0) { var error = new Error('REQUEST_FAILED'); error.status = response.status; throw error; }
      if (!allowed(state) || sequence !== state.sequence) return;
      state.counts = validateCounts(payload.data, state);
    }).catch(function (error) {
      if (!allowed(state) || sequence !== state.sequence) return;
      state.counts = null;
      state.error = error.status === 403 ? '解锁权限未通过验证，请返回首页重新解锁。' : error.status === 429 ? '刷新太快，请稍后重试。' : '目录暂时未能完整加载，请重试。';
    }).finally(function () {
      window.clearTimeout(timer);
      if (allowed(state) && sequence === state.sequence) { state.loading = false; paint(state); }
    });
  }
  function control(state, name, title, choices) {
    var label = node('label', 'question-catalog-field');
    label.appendChild(node('span', '', title));
    var select = node('select', 'question-catalog-' + name); select.setAttribute('aria-label', title);
    if (choices) populate(select, choices, filters[name]);
    select.addEventListener('change', function () {
      if (!allowed(state)) return;
      filters[name] = name === 'pageSize' ? (Number(select.value) === 50 ? 50 : 30) : select.value;
      filters.page = 1; paint(state);
    });
    label.appendChild(select); state[name] = select; state.controls.appendChild(label);
  }
  function changePage(state, step) {
    if (!allowed(state) || !state.counts) return;
    var pages = Math.max(1, Math.ceil(orderedQuestions(state).length / filters.pageSize));
    var nextPage = filters.page + step;
    if (nextPage < 1 || nextPage > pages) return;
    filters.page = nextPage; paint(state);
    if (typeof state.summary.scrollIntoView === 'function') state.summary.scrollIntoView({ block: 'start' });
  }
  function create(state) {
    state.section = node('section', 'question-catalog'); state.section.setAttribute('aria-label', '完整题目目录');
    state.section.appendChild(node('p', 'question-catalog-help', '包含零票题目；票数相同时按题号升序。'));
    state.controls = node('div', 'question-catalog-controls'); state.section.appendChild(state.controls);
    control(state, 'module', '模块'); control(state, 'tag', '专题');
    control(state, 'sort', '排序依据', [['questionId', '题号'], ['likes', '好评（有价值）'], ['dislikes', '差评（无价值）']]);
    control(state, 'direction', '排序方向', [['asc', '升序'], ['desc', '降序']]);
    control(state, 'pageSize', '每页题数', [['30', '30 题'], ['50', '50 题']]);
    var actions = node('div', 'question-catalog-actions');
    state.practice = button('question-catalog-practice', '按当前顺序练习', function () {
      if (!allowed(state) || !state.counts) return;
      var ids = orderedQuestions(state).map(function (q) { return q.id; });
      if (ids.length && typeof state.options.onPractice === 'function') state.options.onPractice(ids);
    });
    state.refresh = button('question-catalog-refresh', '刷新票数', function () { refresh(state); });
    actions.appendChild(state.practice); actions.appendChild(state.refresh); state.section.appendChild(actions);
    state.status = node('p', 'question-catalog-status'); state.status.setAttribute('role', 'status'); state.section.appendChild(state.status);
    state.summary = node('p', 'question-catalog-summary'); state.summary.setAttribute('aria-live', 'polite'); state.section.appendChild(state.summary);
    state.list = node('ol', 'question-catalog-list'); state.section.appendChild(state.list);
    state.empty = node('p', 'question-catalog-empty', '没有符合当前模块和专题的题目，可以调整筛选条件。'); state.section.appendChild(state.empty);
    state.pagination = node('div', 'question-catalog-pagination'); state.pagination.setAttribute('role', 'navigation'); state.pagination.setAttribute('aria-label', '题目目录分页');
    state.previous = button('question-catalog-previous', '上一页', function () { changePage(state, -1); });
    state.next = button('question-catalog-next', '下一页', function () { changePage(state, 1); });
    state.pagination.appendChild(state.previous); state.pagination.appendChild(state.next); state.section.appendChild(state.pagination);
    state.container.appendChild(state.section); state.container.hidden = false;
  }
  function unmount() {
    if (!active) return;
    if (active.controller) active.controller.abort();
    active.sequence++; active.counts = null; active.section.remove(); active.container.hidden = true; active = null;
  }
  function mount(container, options) {
    options = options || {};
    var proof = proofOf(options), base = serverURL();
    if (!container || !proof || !base || !Array.isArray(options.questions)) { unmount(); if (container) container.hidden = true; return; }
    applyInitial(options);
    if (active && active.proof === proof && active.base === base && active.questionsReference === options.questions) {
      if (active.container !== container) { active.container.hidden = true; container.appendChild(active.section); active.container = container; }
      active.options = options; container.hidden = false; paint(active); return;
    }
    unmount();
    active = { container: container, options: options, proof: proof, base: base, questionsReference: options.questions,
      questions: normalizedQuestions(options.questions), sequence: 0, controller: null, counts: null, loading: true, error: '' };
    create(active); refresh(active);
  }
  window.ActuaryCatalog = Object.freeze({ mount: mount, unmount: unmount });
})();
