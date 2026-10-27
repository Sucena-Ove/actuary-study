/*
 * Per-question anonymous Waline integration. The host stays outside #app so
 * normal study-screen redraws cannot discard a comment being written.
 * Waline API: https://waline.js.org/en/reference/client/api.html
 * Props: https://waline.js.org/en/reference/client/props.html
 */
(function () {
  'use strict';

  var active = null;
  var generation = 0;
  var clientPromise = null;
  var drafts = new Map();
  var DRAFT_PREFIX = 'actuary-comment-draft-v1:';
  var EDITOR_KEY = 'ACTUARY_WALINE_COMMENT_BOX_EDITOR';

  function settings() {
    var config = window.ACTUARY_COMMENTS || {};
    if (config.enabled !== true || typeof config.serverURL !== 'string') return null;
    try {
      var url = new URL(config.serverURL);
      var local = url.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
      if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash) return null;
      return {
        serverURL: url.href.replace(/\/+$/, ''),
        turnstileKey: typeof config.turnstileKey === 'string' ? config.turnstileKey : '',
        pageSize: Number.isInteger(config.pageSize) ? Math.min(20, Math.max(1, config.pageSize)) : 10
      };
    } catch (_) { return null; }
  }

  function draftFor(id) {
    if (drafts.has(id)) return drafts.get(id);
    var value = '';
    try { value = window.sessionStorage.getItem(DRAFT_PREFIX + id) || ''; } catch (_) {}
    drafts.set(id, value);
    return value;
  }

  function rememberDraft(state) {
    if (!state || !state.editorReady) return;
    var editor = state.widget.querySelector('textarea.wl-editor');
    if (!editor) return;
    var value = editor.value;
    drafts.set(state.id, value);
    try {
      if (value) window.sessionStorage.setItem(DRAFT_PREFIX + state.id, value);
      else window.sessionStorage.removeItem(DRAFT_PREFIX + state.id);
    } catch (_) {}
  }

  function clearVisitorIdentity() {
    // These keys belong exclusively to our locally namespaced Waline bundle.
    // Do not change another GitHub Pages project's ordinary WALINE_* keys.
    try {
      window.localStorage.removeItem('ACTUARY_WALINE_USER');
      window.localStorage.removeItem('ACTUARY_WALINE_USER_META');
    } catch (_) {}
  }

  function seedEditor(id) {
    try { window.sessionStorage.setItem(EDITOR_KEY, draftFor(id)); } catch (_) {}
  }

  function loadClient() {
    if (!clientPromise) {
      clearVisitorIdentity();
      clientPromise = import('./vendor/waline/waline.js').then(function (client) {
        if (!client || typeof client.init !== 'function') throw new Error('Comment client unavailable');
        return client;
      }).catch(function (error) {
        clientPromise = null;
        throw error;
      });
    }
    return clientPromise;
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function stillCurrent(state, token) {
    return active === state && state.generation === token && generation === token;
  }

  function showFailure(state) {
    state.status.textContent = '评论暂时未能加载，可以稍后重试。';
    state.status.hidden = false;
    state.retry.hidden = false;
    state.loading = false;
  }

  function limitUnsupportedControls(state) {
    // Waline has no public switch for comment likes / hottest sorting. Keep
    // latest and oldest available, but remove the unsupported sort from both
    // layout and the accessibility tree. Its label is fixed in our locale.
    var sorting = state.widget.querySelector('.wl-sort');
    if (sorting) Array.prototype.forEach.call(sorting.children, function (choice) {
      if (choice.textContent.trim() === '按热度') choice.hidden = true;
    });
  }

  function restoreEditor(state) {
    var editor = state.widget.querySelector('textarea.wl-editor');
    if (!editor) return false;
    editor.setAttribute('maxlength', '2000');
    editor.setAttribute('aria-label', '第 ' + state.id + ' 题匿名评论');
    if (!state.editorReady) {
      editor.value = draftFor(state.id);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      state.editorReady = true;
    }
    return true;
  }

  function initialize(state) {
    if (active !== state || state.instance || state.loading || !state.details.open) return;
    var token = state.generation;
    state.loading = true;
    state.status.textContent = '正在加载本题讨论…';
    state.status.hidden = false;
    state.retry.hidden = true;
    var timer = window.setTimeout(function () {
      if (stillCurrent(state, token) && state.loading) {
        // Invalidating this attempt prevents a slow import mounting an old view.
        state.attempt += 1;
        showFailure(state);
      }
    }, 15000);
    var attempt = ++state.attempt;
    loadClient().then(function (client) {
      if (!stillCurrent(state, token) || state.attempt !== attempt) return;
      clearVisitorIdentity();
      seedEditor(state.id);
      state.instance = client.init({
        el: state.widget,
        serverURL: state.config.serverURL,
        path: '/actuary-study/questions/' + state.id + '.html',
        lang: 'zh-CN',
        login: 'disable',
        meta: [],
        requiredMeta: [],
        locale: {
          anonymous: '匿名同学',
          placeholder: '写下你的思路、疑问或勘误…',
          submit: '匿名发布',
          hottest: '按热度'
        },
        wordLimit: [1, 2000],
        pageSize: state.config.pageSize,
        commentSorting: 'latest',
        imageUploader: false,
        search: false,
        emoji: false,
        highlighter: false,
        texRenderer: false,
        noCopyright: false,
        noRss: true,
        reaction: false,
        comment: false,
        pageview: false,
        turnstileKey: state.config.turnstileKey
      });
      state.loading = false;
      state.status.hidden = true;
      limitUnsupportedControls(state);
      restoreEditor(state);
      state.observer = new MutationObserver(function () {
        if (!stillCurrent(state, token)) return;
        limitUnsupportedControls(state);
        restoreEditor(state);
        rememberDraft(state);
      });
      state.observer.observe(state.widget, { childList: true, subtree: true });
      // Waline clears the textarea programmatically after a successful post.
      // Capture that too, so a posted comment cannot reappear as a saved draft.
      state.draftTimer = window.setInterval(function () {
        if (stillCurrent(state, token)) rememberDraft(state);
      }, 700);
    }).catch(function () {
      if (!stillCurrent(state, token) || state.attempt !== attempt) return;
      showFailure(state);
    }).finally(function () { window.clearTimeout(timer); });
  }

  function unmount() {
    var state = active;
    if (!state) return;
    rememberDraft(state);
    active = null;
    generation += 1;
    if (state.observer) state.observer.disconnect();
    if (state.draftTimer) window.clearInterval(state.draftTimer);
    if (state.instance) {
      try { state.instance.destroy(); } catch (_) {}
    }
    state.section.remove();
    state.container.hidden = true;
  }

  function mount(container, question) {
    var config = settings();
    var id = question && Number(question.questionId);
    if (!container || !config || !Number.isSafeInteger(id) || id < 1) {
      unmount();
      if (container) container.hidden = true;
      return;
    }
    if (active && active.id === id && active.config.serverURL === config.serverURL) {
      // Moving the existing section also covers callers that replaced the host.
      if (active.container !== container) {
        active.container.hidden = true;
        container.appendChild(active.section);
        active.container = container;
      }
      container.hidden = false;
      return;
    }
    unmount();
    var section = element('section', 'question-comments');
    var details = element('details', 'question-comments-details');
    var summary = element('summary', 'question-comments-summary');
    summary.appendChild(element('span', 'question-comments-title', '第 ' + id + ' 题 · 匿名讨论'));
    summary.appendChild(element('span', 'question-comments-toggle', '展开查看与留言'));
    details.appendChild(summary);
    var body = element('div', 'question-comments-body');
    var intro = element('p', 'question-comments-intro', '评论会公开展示，无需登录。请勿填写电话、邮箱等个人信息。 ');
    var privacy = element('a', 'question-comments-privacy', '评论与隐私说明');
    privacy.setAttribute('href', '../about.html#comments-privacy');
    intro.appendChild(privacy);
    body.appendChild(intro);
    var status = element('p', 'question-comments-status', '展开后加载本题讨论。');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var retry = element('button', 'question-comments-retry', '重新加载评论');
    retry.type = 'button';
    retry.hidden = true;
    var widget = element('div', 'question-comments-widget');
    body.appendChild(status);
    body.appendChild(retry);
    body.appendChild(widget);
    body.appendChild(element('p', 'question-comments-draft-note', '未发送的文字暂存于当前浏览器标签页。'));
    details.appendChild(body);
    section.appendChild(details);
    container.appendChild(section);
    container.hidden = false;
    var state = {
      id: id, config: config, container: container, section: section,
      details: details, status: status, retry: retry, widget: widget,
      instance: null, loading: false, editorReady: false, observer: null,
      draftTimer: null, attempt: 0, generation: ++generation
    };
    active = state;
    details.addEventListener('toggle', function () {
      if (active !== state) return;
      summary.lastChild.textContent = details.open ? '收起讨论' : '展开查看与留言';
      if (details.open) initialize(state);
      else rememberDraft(state);
    });
    widget.addEventListener('input', function () { rememberDraft(state); });
    retry.addEventListener('click', function () { initialize(state); });
  }

  window.addEventListener('pagehide', function () { rememberDraft(active); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') rememberDraft(active);
  });
  window.ActuaryComments = Object.freeze({ mount: mount, unmount: unmount });
})();
