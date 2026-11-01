'use strict';

// No network, real credentials, bank data, or production votes are used here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../source-data/question-votes.js'), 'utf8');
const VOTER_KEY = 'actuary-question-voter-v1';
const UPDATE_KEY = 'actuary-question-vote-update-v1';
const PROOF = 'c'.repeat(64); // Explicitly synthetic, never a production proof.

class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
    this.className = ''; this.attributes = {}; this.listeners = new Map();
    this.hidden = false; this.disabled = false; this._text = '';
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
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(listener); }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) || []) listener(event); }
  click() { if (!this.disabled) this.dispatchEvent({ type: 'click', target: this }); }
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
async function flush() { for (let index = 0; index < 30; index++) await Promise.resolve(); }

function harness() {
  let now = 100000, timerId = 0, randomSequence = 0;
  const timers = new Map(), storage = new Map(), requests = [], rows = new Map(), selections = new Map();
  const controls = { getStatus: 200, putStatus: 200, rankStatus: 200, holdGet: null, holdPut: null, holdRank: null };
  class Clock extends Date { static now() { return now; } }
  const window = new Node('window'), document = new Node('document');
  document.hidden = false; document.createElement = tag => new Node(tag);
  Object.assign(window, {
    ACTUARY_COMMENTS: { enabled: true, serverURL: 'https://comments.example.test/' },
    crypto: { getRandomValues(bytes) { bytes.fill(++randomSequence); return bytes; } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  const reply = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => status === 200 ? { errno: 0, data } : { errno: status, errmsg: 'synthetic rejection' } });
  function fetch(url, options) {
    requests.push({ url, options });
    const parsed = new URL(url), method = options.method || 'GET';
    let result, hold;
    if (parsed.pathname === '/api/question-vote') {
      if (method === 'PUT' && controls.putStatus !== 200) return Promise.resolve(reply(controls.putStatus));
      if (method === 'GET' && controls.getStatus !== 200) return Promise.resolve(reply(controls.getStatus));
      const input = method === 'PUT' ? JSON.parse(options.body) : null;
      const id = input ? input.questionId : Number(parsed.searchParams.get('questionId'));
      const voter = options.headers['x-study-voter'] || '';
      const row = rows.get(id) || { likes: 0, dislikes: 0 };
      const key = `${id}:${voter}`, previous = selections.get(key) || 0;
      if (input) {
        if (previous === 1) row.likes--; if (previous === -1) row.dislikes--;
        if (input.vote === 1) row.likes++; if (input.vote === -1) row.dislikes++;
        selections.set(key, input.vote); rows.set(id, row);
      }
      result = reply(200, { questionId: id, ...row, myVote: selections.get(key) || 0 });
      hold = method === 'PUT' ? controls.holdPut : controls.holdGet;
      if (method === 'PUT') controls.holdPut = null; else controls.holdGet = null;
    } else if (parsed.pathname === '/api/question-rank') {
      const sort = parsed.searchParams.get('sort');
      result = reply(controls.rankStatus, { sort, limit: 20, items: [
        { questionId: 7, likes: 10, dislikes: 2 }, { questionId: 3, likes: 10, dislikes: 5 }, { questionId: 2, likes: 0, dislikes: 8 }
      ] });
      hold = controls.holdRank; controls.holdRank = null;
    } else throw Error('Unexpected fixture endpoint');
    return hold ? hold.promise.then(() => result) : Promise.resolve(result);
  }
  vm.runInNewContext(source, { window, document, fetch, URL, Map, Set, Promise, Object, Array, String, Number, Math, Date: Clock, Uint8Array, AbortController, console });
  const host = new Node('div'), rankHost = new Node('div');
  const mount = (id, canVote = true) => window.ActuaryVotes.mount(host, { questionId: id, canVote });
  const advance = ms => {
    now += ms;
    for (const [id, timer] of [...timers.entries()]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  };
  const emitStorage = (key, newValue) => window.dispatchEvent({ type: 'storage', key, newValue });
  return { window, document, host, rankHost, mount, advance, emitStorage, requests, controls, storage, rows, selections,
    up: () => host.querySelector('.vote-positive'), down: () => host.querySelector('.vote-negative'),
    readOptions: sort => ({ sort, getProof: () => PROOF, lookupQuestion: id => ({ id, topic: 'fixture ' + id, module: 'synthetic' }), onOpen() {} }) };
}

(async () => {
  const h = harness();
  h.mount(1, false); await flush();
  assert.equal(h.up().textContent, '有价值 · 0'); assert.equal(h.up().disabled, true, 'guests can read counts before checking an answer');
  const originalSection = h.host.children[0];
  h.mount(1, true);
  assert.equal(h.host.children[0], originalSection, 'same-question app redraw retains stable vote DOM');
  h.up().click(); h.up().click(); await flush();
  assert.equal(h.requests.filter(item => item.options.method === 'PUT').length, 1, 'in-flight double click must not send another vote');
  assert.equal(h.up().textContent, '有价值 · 1'); assert.equal(h.up().attributes['aria-pressed'], 'true');
  assert.equal(h.down().attributes['aria-pressed'], 'false');
  assert.equal(h.up().disabled, true, 'successful write has a cooldown');
  h.advance(1120); h.down().click(); await flush();
  assert.equal(h.up().textContent, '有价值 · 0'); assert.equal(h.down().textContent, '无价值 · 1');
  assert.equal(h.down().attributes['aria-pressed'], 'true', 'switching replaces the old vote');
  h.advance(1120); h.down().click(); await flush();
  assert.equal(h.down().textContent, '无价值 · 0'); assert.equal(h.down().attributes['aria-pressed'], 'false', 'clicking the selected choice withdraws it');
  const voter = h.storage.get(VOTER_KEY); assert.match(voter, /^[a-f0-9]{64}$/);
  for (const item of h.requests.filter(item => item.url.includes('/question-vote'))) {
    assert.equal(item.options.headers['x-study-access'], undefined, 'public vote requests never transmit rank access');
    assert.equal(item.options.credentials, 'omit'); assert(!item.url.includes(voter));
    if (item.options.method === 'PUT') assert.equal(new URL(item.url).search, '', 'PUT contract has no query');
  }

  h.advance(1120);
  h.controls.putStatus = 503; h.up().click(); await flush();
  assert.equal(h.up().textContent, '有价值 · 0', 'failed writes do not optimistically alter shared counts');
  assert.equal(h.host.querySelector('.question-vote-retry').hidden, false);
  h.controls.putStatus = 200; h.host.querySelector('.question-vote-retry').click(); await flush(); h.advance(1120);
  assert.equal(h.up().disabled, false, 'retry reconciles the server state before another vote');
  h.rows.set(1, { likes: 0, dislikes: 1 }); h.selections.set(`1:${voter}`, -1);
  h.emitStorage(UPDATE_KEY, JSON.stringify({ questionId: 1 })); await flush();
  assert.equal(h.down().attributes['aria-pressed'], 'true', 'another tab refreshes the authoritative selection');

  const stale = harness(), oldRead = deferred(); stale.controls.holdGet = oldRead;
  stale.mount(1); stale.mount(2); await flush(); oldRead.resolve(); await flush();
  assert.equal(stale.host.children[0].querySelector('.question-vote-buttons').attributes['aria-label'], '第 2 题的价值评价');
  assert.equal(stale.up().textContent, '有价值 · 0', 'late question 1 reads do not replace question 2');

  const identityRace = harness(); identityRace.mount(8); await flush();
  const oldVoter = identityRace.storage.get(VOTER_KEY), write = deferred();
  identityRace.controls.holdPut = write; identityRace.up().click();
  identityRace.storage.delete(VOTER_KEY); identityRace.emitStorage(VOTER_KEY, null);
  write.resolve(); await flush(); identityRace.advance(1120);
  assert.notEqual(identityRace.storage.get(VOTER_KEY), oldVoter);
  assert.equal(identityRace.up().textContent, '有价值 · 1');
  assert.equal(identityRace.up().attributes['aria-pressed'], 'false');
  assert.equal(identityRace.up().disabled, false, 'identity changes during PUT reconcile and do not leave the panel stuck');

  const move = harness(); move.mount(4); await flush(); move.up().click(); await flush(); move.mount(5); await flush();
  assert.equal(move.up().disabled, true, 'changing questions cannot bypass the browser cooldown');
  move.advance(1120); assert.equal(move.up().disabled, false, 'the new question is re-enabled when shared cooldown ends');

  const rankings = harness(); let proof = '';
  const opens = [], options = { ...rankings.readOptions('likes'), getProof: () => proof, onOpen: id => opens.push(id) };
  rankings.window.ActuaryVotes.mountRankings(rankings.rankHost, options);
  assert.equal(rankings.requests.length, 0, 'locked rankings never request or preload rows');
  proof = PROOF; rankings.window.ActuaryVotes.mountRankings(rankings.rankHost, options); await flush();
  let list = rankings.rankHost.querySelector('.question-ranking-list');
  assert.equal(list.children.length, 2, 'zero-value entries are excluded from each corresponding board');
  assert.match(list.children[0].textContent, /#3/); assert.match(list.children[1].textContent, /#7/);
  list.children[0].children[0].click(); assert.deepEqual(opens, [3]);
  const request = rankings.requests.at(-1);
  assert.equal(request.options.headers['x-study-access'], PROOF); assert(!request.url.includes(PROOF));
  assert(![...rankings.storage.values()].includes(PROOF), 'rank proof is never persisted');
  rankings.controls.rankStatus = 403; rankings.document.dispatchEvent({ type: 'visibilitychange' }); await flush();
  assert.equal(list.children.length, 0, 'server revocation removes previously visible rows');
  assert.match(rankings.rankHost.textContent, /未通过验证/);

  const rankRace = harness(), lateRank = deferred(); let liveProof = PROOF;
  rankRace.controls.holdRank = lateRank;
  rankRace.window.ActuaryVotes.mountRankings(rankRace.rankHost, { ...rankRace.readOptions('likes'), getProof: () => liveProof });
  liveProof = ''; lateRank.resolve(); await flush();
  assert.equal(rankRace.rankHost.hidden, true, 'revocation during a request cannot flash protected results');
  assert.equal(rankRace.rankHost.children.length, 0);

  const tabRace = harness(), firstTab = deferred(); tabRace.controls.holdRank = firstTab;
  tabRace.window.ActuaryVotes.mountRankings(tabRace.rankHost, tabRace.readOptions('likes'));
  tabRace.window.ActuaryVotes.mountRankings(tabRace.rankHost, tabRace.readOptions('dislikes')); await flush(); firstTab.resolve(); await flush();
  list = tabRace.rankHost.querySelector('.question-ranking-list');
  assert.equal(list.children.length, 3); assert.match(list.children[0].textContent, /#2/);
  assert.match(tabRace.rankHost.textContent, /无价值票数排序/);
  console.log('PASS question votes: public counts, exclusive switch/withdraw, stable redraw, stale reads, failures/retry, tab identity race, global cooldown, key-only rankings, sorting, protected late responses and 403 clearing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
