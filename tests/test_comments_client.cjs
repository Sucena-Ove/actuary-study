'use strict';

// Stateful integration checks for the lazy comment wrapper, using a fake DOM
// and a local fake Waline module. No real comments or credentials are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const production = fs.readFileSync(path.join(__dirname, '../source-data/comments.js'), 'utf8');
const importExpression = "import('./vendor/waline/waline.js')";
assert.equal(production.split(importExpression).length, 2, 'only the local Waline module is imported');
const source = production.replace(importExpression, 'window.__loadWaline()');

class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
    this.className = ''; this.value = ''; this.hidden = false; this.open = false;
    this.listeners = new Map(); this.attributes = {};
  }
  appendChild(child) {
    if (child.parentNode) child.remove();
    child.parentNode = this; this.children.push(child); return child;
  }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
    return true;
  }
  get lastChild() { return this.children.at(-1); }
  querySelector(selector) {
    const [tag, cls] = selector.split('.');
    const matches = child => (!tag || child.tagName === tag.toUpperCase()) && (!cls || child.className.split(' ').includes(cls));
    for (const child of this.children) {
      if (matches(child)) return child;
      const nested = child.querySelector(selector); if (nested) return nested;
    }
    return null;
  }
}
function store(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
function harness(options = {}) {
  const intervals = new Map(), timeouts = new Map(), instances = [], imports = [];
  let timerId = 0;
  const local = store({ WALINE_USER: 'unrelated-project', WALINE_USER_META: 'unrelated-meta', ACTUARY_WALINE_USER: 'stale-user' });
  const session = options.session || store();
  const window = new Node('window');
  Object.assign(window, {
    ACTUARY_COMMENTS: { enabled: true, serverURL: 'https://comments.example.test/', pageSize: 10 },
    localStorage: local, sessionStorage: session,
    setTimeout: fn => { const id = ++timerId; timeouts.set(id, fn); return id; },
    clearTimeout: id => timeouts.delete(id),
    setInterval: fn => { const id = ++timerId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id)
  });
  const document = new Node('document');
  document.createElement = tag => new Node(tag);
  const client = {
    init(config) {
      const textarea = new Node('textarea'); textarea.className = 'wl-editor';
      textarea.value = session.getItem('ACTUARY_WALINE_COMMENT_BOX_EDITOR') || '';
      config.el.appendChild(textarea);
      const sorting = new Node('ul'); sorting.className = 'wl-sort';
      for (const label of ['按最新', '按最早', config.locale.hottest]) {
        const choice = new Node('li'); choice.textContent = label; sorting.appendChild(choice);
      }
      config.el.appendChild(sorting);
      const instance = { config, textarea, destroyed: false, destroy() { this.destroyed = true; textarea.remove(); } };
      instances.push(instance); return instance;
    }
  };
  window.__loadWaline = () => {
    imports.push(true);
    return options.load ? options.load(client) : Promise.resolve(client);
  };
  class Event { constructor(type, init = {}) { Object.assign(this, init, { type }); } }
  class MutationObserver { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} }
  vm.runInNewContext(source, { window, document, URL, Map, Number, Object, Promise, Event, MutationObserver, console });
  const host = new Node('div');
  const mount = id => window.ActuaryComments.mount(host, { questionId: id });
  const open = () => { const details = host.querySelector('details'); details.open = true; details.dispatchEvent(new Event('toggle')); };
  const type = value => { const textarea = host.querySelector('textarea.wl-editor'); textarea.value = value; textarea.dispatchEvent(new Event('input', { bubbles: true })); };
  return { window, document, Event, host, mount, open, type, local, session, intervals, timeouts, instances, imports, client };
}

(async () => {
  const h = harness();
  h.window.ACTUARY_COMMENTS.enabled = false;
  h.mount(587);
  assert.equal(h.host.hidden, true); assert.equal(h.imports.length, 0);
  h.window.ACTUARY_COMMENTS.enabled = true;
  h.window.ACTUARY_COMMENTS.serverURL = 'javascript:alert(1)'; h.mount(587);
  assert.equal(h.host.hidden, true); assert.equal(h.imports.length, 0);
  h.window.ACTUARY_COMMENTS.serverURL = 'https://comments.example.test/';
  h.mount(587);
  assert.equal(h.host.hidden, false);
  assert.equal(h.host.querySelector('details').open, false);
  assert.match(h.host.querySelector('.question-comments-intro').textContent, /公开展示.*请勿填写电话、邮箱/);
  assert.equal(h.host.querySelector('.question-comments-privacy').attributes.href, '../about.html#comments-privacy');
  assert.equal(h.imports.length, 0, 'a collapsed comment panel performs no module or API request');
  h.open(); await flush();
  assert.equal(h.instances.length, 1);
  const cfg = h.instances[0].config;
  assert.equal(cfg.path, '/actuary-study/questions/587.html');
  assert.equal(cfg.login, 'disable'); assert.equal(cfg.meta.length, 0); assert.equal(cfg.requiredMeta.length, 0);
  assert.equal(cfg.locale.anonymous, '匿名同学'); assert.equal(cfg.noCopyright, false);
  assert.equal(cfg.noRss, true); assert.equal(cfg.imageUploader, false); assert.equal(cfg.reaction, false);
  assert.equal(cfg.wordLimit[1], 2000);
  assert.equal(h.host.querySelector('.wl-sort').children[0].hidden, false);
  assert.equal(h.host.querySelector('.wl-sort').children[1].hidden, false);
  assert.equal(h.host.querySelector('.wl-sort').children[2].hidden, true, 'unsupported hottest sorting is hidden');
  assert.equal(h.local.getItem('WALINE_USER'), 'unrelated-project');
  assert.equal(h.local.getItem('WALINE_USER_META'), 'unrelated-meta');
  assert.equal(h.local.getItem('ACTUARY_WALINE_USER'), null);

  h.type('第 587 题的未发送推导');
  h.mount(587);
  assert.equal(h.instances.length, 1, 'same-question redraw keeps the existing widget');
  assert.equal(h.host.querySelector('textarea.wl-editor').value, '第 587 题的未发送推导');
  const otherHost = new Node('div');
  h.window.ActuaryComments.mount(otherHost, { questionId: 587 });
  assert.equal(otherHost.querySelector('textarea.wl-editor').value, '第 587 题的未发送推导');
  assert.equal(h.instances.length, 1, 'a replacement host moves rather than rebuilds the live widget');
  h.window.ActuaryComments.mount(h.host, { questionId: 587 });
  h.mount(575);
  assert.equal(h.instances[0].destroyed, true);
  assert.equal(h.host.querySelector('details').open, false);
  h.open(); await flush();
  assert.equal(h.host.querySelector('textarea.wl-editor').value, '', 'a different question never gets the prior draft');
  h.type('第 575 题的转移矩阵');
  h.mount(587); h.open(); await flush();
  assert.equal(h.host.querySelector('textarea.wl-editor').value, '第 587 题的未发送推导');
  h.host.querySelector('textarea.wl-editor').value = ''; // Waline successful-submit behavior.
  for (const poll of h.intervals.values()) poll();
  h.mount(575); h.open(); await flush();
  assert.equal(h.host.querySelector('textarea.wl-editor').value, '第 575 题的转移矩阵');
  h.mount(587); h.open(); await flush();
  assert.equal(h.host.querySelector('textarea.wl-editor').value, '', 'posted comments are not restored as drafts');
  h.window.ActuaryComments.unmount();
  assert.equal(h.intervals.size, 0); assert.equal(h.host.hidden, true);

  const delayed = deferred();
  const race = harness({ load: () => delayed.promise });
  race.mount(1); race.open();
  race.mount(2);
  delayed.resolve(race.client); await flush();
  assert.equal(race.instances.length, 0, 'a delayed import cannot mount the previous question');
  race.open(); await flush();
  assert.equal(race.instances[0].config.path, '/actuary-study/questions/2.html');

  let attempts = 0;
  const failure = harness({ load: client => ++attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(client) });
  failure.mount(9); failure.open(); await flush();
  assert.equal(failure.host.querySelector('.question-comments-retry').hidden, false);
  assert.equal(failure.instances.length, 0);
  failure.host.querySelector('.question-comments-retry').dispatchEvent(new failure.Event('click'));
  await flush();
  assert.equal(failure.instances.length, 1, 'loading can recover without navigating away from the question');

  const firstTab = harness(); firstTab.mount(7); firstTab.open(); await flush(); firstTab.type('只在第一个标签页');
  const otherTab = harness(); otherTab.mount(7); otherTab.open(); await flush();
  assert.equal(otherTab.host.querySelector('textarea.wl-editor').value, '', 'separate tabs have independent draft stores');
  const reload = harness({ session: firstTab.session }); reload.mount(7); reload.open(); await flush();
  assert.equal(reload.host.querySelector('textarea.wl-editor').value, '只在第一个标签页', 'draft survives reload in its own tab');

  const vendorPath = path.join(__dirname, '../source-data/vendor/waline/');
  const vendor = fs.readFileSync(path.join(vendorPath, 'waline.js'), 'utf8');
  const metadata = JSON.parse(fs.readFileSync(path.join(vendorPath, 'version.json'), 'utf8'));
  assert.equal(metadata.version, '3.16.1');
  assert.match(vendor, /kn\(`ACTUARY_WALINE_COMMENT_BOX_EDITOR`,``,actuaryCommentStorage\)/);
  assert.doesNotMatch(vendor, /`WALINE_(?:USER|USER_META|COMMENT_BOX_EDITOR)`/);
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(vendorPath, 'waline.js'))).digest('hex'), metadata.patchedJavaScriptSHA256);
  const css = fs.readFileSync(path.join(__dirname, '../source-data/comments.css'), 'utf8');
  assert.match(css, /\.question-comments \.wl-like\{display:none!important\}/, 'likes must not appear when the backend disables them');
  assert.doesNotMatch(css, /\.wl-reply[^}]*display\s*:\s*none/, 'reply remains available');
  console.log('PASS anonymous comments: lazy loading, identity isolation, stable question paths, redraw/move, per-question drafts, successful-submit clearing, stale async work, retry, tab isolation, unsupported controls hidden and vendor patch integrity.');
})().catch(error => { console.error(error); process.exitCode = 1; });
