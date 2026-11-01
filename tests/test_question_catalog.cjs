'use strict';

// All questions and access proofs below are synthetic. No network or storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../source-data/question-catalog.js'), 'utf8');
const PROOF = 'c'.repeat(64), OTHER_PROOF = 'd'.repeat(64);

class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
    this.className = ''; this.attributes = {}; this.listeners = new Map();
    this.hidden = false; this.disabled = false; this.value = ''; this._text = '';
    this.classList = { toggle: (name, enabled) => {
      const classes = new Set(this.className.split(' ').filter(Boolean));
      if (enabled) classes.add(name); else classes.delete(name);
      this.className = [...classes].join(' ');
    } };
  }
  appendChild(child) { if (child.parentNode) child.remove(); child.parentNode = this; this.children.push(child); return child; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(item => item !== this); this.parentNode = null; }
  replaceChildren(...children) { for (const item of this.children) item.parentNode = null; this.children = []; this._text = ''; children.forEach(item => this.appendChild(item)); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  get textContent() { return this._text + this.children.map(item => item.textContent).join(''); }
  set innerHTML(_) { throw Error('Catalog must render trusted structure and textContent, not HTML strings'); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(listener); }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) || []) listener(event); }
  click() { if (!this.disabled) this.dispatchEvent({ type: 'click', target: this }); }
  scrollIntoView() { this.scrolledIntoView = true; }
  querySelector(selector) {
    const [tag, cls] = selector.split('.');
    for (const child of this.children) {
      if ((!tag || child.tagName === tag.toUpperCase()) && (!cls || child.className.split(' ').includes(cls))) return child;
      const match = child.querySelector(selector); if (match) return match;
    }
    return null;
  }
}
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
function harness() {
  const requests = [], opens = [], practices = [], timers = new Map(); let timerId = 0;
  const questions = Array.from({ length: 70 }, (_, index) => {
    const id = 70 - index;
    return { id, module: id % 2 ? '模块甲' : '模块乙', topic: id === 1 ? '<img src=x onerror=alert(1)>' : '知识点 ' + id,
      stem: '<script>synthetic preview</script>', tags: [id % 2 ? '仅甲专题' : '仅乙专题', ...(id % 5 ? [] : ['跨模块专题'])] };
  });
  const controls = { proof: PROOF, status: 200, hold: null, transform: data => data };
  const window = { ACTUARY_COMMENTS: { enabled: true, serverURL: 'https://comments.example.test/service/' },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) };
  const document = { createElement: tag => new Node(tag) };
  function fetch(url, options) {
    requests.push({ url, options });
    assert.equal(url, 'https://comments.example.test/service/api/question-catalog');
    const data = controls.transform({ total: 70, items: questions.map(q => ({ questionId: q.id,
      likes: q.id === 1 ? 2 : [2, 3].includes(q.id) ? 10 : 0, dislikes: q.id === 65 ? 9 : q.id === 5 ? 2 : 0 })) });
    const status = controls.status, hold = controls.hold; controls.hold = null;
    const response = { status, ok: status === 200, json: async () => ({ errno: status === 200 ? 0 : status, data }) };
    return hold ? hold.promise.then(() => response) : Promise.resolve(response);
  }
  vm.runInNewContext(source, { window, document, fetch, URL, Map, Set, Promise, Object, Array, String, Number, Math, AbortController, console });
  let host = new Node('div');
  const options = { questions, getProof: () => controls.proof, filterToken: 0,
    onOpen: id => opens.push(id), onPractice: ids => practices.push(Array.from(ids)) };
  const api = window.ActuaryCatalog;
  const select = (name, value) => { const item = host.querySelector('.question-catalog-' + name); item.value = String(value); item.dispatchEvent({ type: 'change', target: item }); };
  return { window, controls, requests, opens, practices, timers, api, options, questions, select,
    get host() { return host; }, find: name => host.querySelector('.question-catalog-' + name),
    ids: () => (host.querySelector('.question-catalog-list')?.children || []).map(item => Number(item.attributes['data-question-id'])),
    mount: patch => api.mount(host, Object.assign(options, patch)),
    move: () => { host = new Node('div'); api.mount(host, options); } };
}

(async () => {
  const h = harness(); h.mount(); await flush();
  assert.deepEqual(h.ids(), Array.from({ length: 30 }, (_, i) => i + 1), 'default numeric question order, including explicit zero counts');
  assert.match(h.find('list').children[0].textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(h.find('list').querySelector('img'), null, 'question strings are text, never markup');
  assert.match(h.find('list').children[3].textContent, /有价值 0无价值 0/);
  h.find('open').click(); assert.deepEqual(h.opens, [1]);
  h.find('next').click(); assert.equal(h.ids()[0], 31);
  assert.equal(h.find('summary').scrolledIntoView, true, 'page navigation brings the new page back into view');
  assert.equal(h.find('pagination').tagName, 'DIV', 'pagination must not inherit the site-wide fixed nav styles');
  assert.equal(h.find('pagination').attributes.role, 'navigation');
  const section = h.host.children[0]; h.mount(); assert.equal(h.requests.length, 1); assert.equal(h.ids()[0], 31);
  h.move(); assert.equal(h.host.children[0], section); assert.equal(h.ids()[0], 31, 'host replacement preserves the selected page');
  h.api.unmount(); assert.equal(h.host.hidden, true); h.mount(); await flush();
  assert.equal(h.requests.length, 2); assert.equal(h.ids()[0], 31, 'returning fetches fresh counts while retaining page state');
  h.select('pageSize', 50); assert.equal(h.ids().length, 50); assert.equal(h.ids()[0], 1);
  h.find('next').click(); assert.equal(h.ids().length, 20); assert.equal(h.ids()[0], 51);
  h.find('practice').click(); assert.equal(h.practices.at(-1).length, 70, 'practice uses the entire filtered sequence, not one page');

  h.select('sort', 'likes'); h.select('direction', 'desc');
  assert.deepEqual(h.ids().slice(0, 5), [2, 3, 1, 4, 5], 'count sorting is numerical, with ascending IDs for ties');
  h.find('practice').click(); assert.deepEqual(h.practices.at(-1).slice(0, 5), [2, 3, 1, 4, 5]);
  assert.equal(h.practices.at(-1).length, 70, 'zero-vote questions remain in a popularity sort');
  h.select('direction', 'asc'); assert.deepEqual(h.ids().slice(0, 3), [4, 5, 6]);
  h.select('sort', 'dislikes'); h.select('direction', 'desc'); assert.deepEqual(h.ids().slice(0, 3), [65, 5, 1]);
  h.select('sort', 'questionId'); assert.equal(h.ids()[0], 70, 'question ID descending is supported');

  h.mount({ filterToken: 1, initialFilters: { module: '', tag: '跨模块专题', sort: 'questionId', direction: 'asc' } });
  assert.deepEqual(h.ids(), Array.from({ length: 14 }, (_, i) => (i + 1) * 5));
  h.select('module', '模块甲'); assert.deepEqual(h.ids(), [5, 15, 25, 35, 45, 55, 65], 'module and tag combine with AND');
  h.select('tag', '仅甲专题'); assert.equal(h.ids().length, 35);
  h.select('module', '模块乙'); assert.equal(h.find('tag').value, '', 'changing module clears an unavailable tag');
  assert.equal(h.find('tag').children.some(option => option.value === '仅甲专题'), false);
  assert.deepEqual(h.ids().slice(0, 3), [2, 4, 6]);
  h.select('direction', 'desc');
  h.mount({ filterToken: 2, initialFilters: { module: '模块甲', tag: '' } });
  assert.equal(h.ids()[0], 69, 'module entry preserves unspecified sort and direction');
  h.select('module', ''); h.mount(); assert.equal(h.find('module').value, '', 'ordinary mount does not reapply an old preset');

  h.controls.status = 403; h.find('refresh').click();
  assert.equal(h.ids().length, 0, 'refresh never presents old counts as current');
  await flush(); assert.equal(h.ids().length, 0); assert.match(h.find('status').textContent, /权限未通过验证/);
  h.controls.status = 200; h.find('refresh').click(); await flush(); assert.equal(h.ids().length, 50);
  for (const request of h.requests) {
    assert.equal(request.options.headers['x-study-access'], PROOF); assert(!request.url.includes(PROOF));
    assert.equal(request.options.credentials, 'omit'); assert.equal(request.options.cache, 'no-store');
  }
  assert.equal(h.timers.size, 0);

  const locked = harness(); locked.controls.proof = ''; locked.mount();
  assert.equal(locked.requests.length, 0); assert.equal(locked.host.hidden, true);
  locked.controls.proof = 'invalid'; locked.mount(); assert.equal(locked.requests.length, 0);
  locked.controls.proof = PROOF; locked.window.ACTUARY_COMMENTS.serverURL = 'http://external.example.test'; locked.mount();
  assert.equal(locked.requests.length, 0, 'non-HTTPS remote endpoint is rejected');

  const late = harness(), waiting = deferred(); late.controls.hold = waiting; late.mount();
  late.controls.proof = ''; waiting.resolve(); await flush();
  assert.equal(late.host.hidden, true); assert.equal(late.host.children.length, 0, 'locked proof discards an in-flight protected response');

  const swapped = harness(), old = deferred(); swapped.controls.hold = old; swapped.mount();
  swapped.controls.proof = OTHER_PROOF;
  swapped.controls.transform = data => ({ ...data, items: data.items.map(item => ({ ...item, likes: 123 })) });
  swapped.mount(); await flush(); old.resolve(); await flush();
  assert.match(swapped.find('list').children[0].textContent, /有价值 123/, 'old proof response cannot replace the new session');
  assert.equal(swapped.requests[0].options.signal.aborted, true);
  const capturedOpen = swapped.find('open'); swapped.controls.proof = ''; capturedOpen.click();
  assert.equal(swapped.opens.length, 0); assert.equal(swapped.host.hidden, true, 'stale controls cannot open a question after lock');

  for (const transform of [
    data => ({ ...data, total: 69 }),
    data => ({ ...data, items: [data.items[0], ...data.items.slice(1, -1), data.items[0]] }),
    data => ({ total: 69, items: data.items.slice(1) }),
    data => ({ ...data, items: data.items.map((item, i) => i ? item : { ...item, likes: -1 }) })
  ]) {
    const invalid = harness(); invalid.controls.transform = transform; invalid.mount(); await flush();
    assert.equal(invalid.ids().length, 0); assert.match(invalid.find('status').textContent, /未能完整加载/);
  }
  console.log('PASS question catalog: full zero-inclusive numeric sorting, stable tie breaks, module/tag AND, pagination, full ordered practice, returning state, safe text rendering, proof-only requests, 403 clearing, stale-response isolation and incomplete payload rejection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
