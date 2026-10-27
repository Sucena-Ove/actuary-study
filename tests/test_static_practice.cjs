'use strict';

// Run with: node public-site/tests/test_static_practice.cjs
// Questions and credentials below are synthetic. These normal-UI route checks
// do not claim that a static site can stop users editing JavaScript or storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../source-data/app.js'), 'utf8');
const STORAGE = 'actuary-mobile-400-v1';
const DAILY_STORAGE = 'actuary-study-daily-goal-v1';
const ACCESS_STORAGE = 'actuary-study-access-key-v1';
const TEST_CODE = 'SA-AAAAAAAA-AAAAAAAA-AAAAAAAA-AAAAAAAA';

function question(id) {
  return {
    id, sourceId: 'fixture-public', module: '测试模块', topic: '测试知识点',
    difficulty: id >= 10001 ? '提高' : '基础', scope: 'core',
    stem: `UNIQUE_FIXTURE_STEM_${id}_END`, options: ['A', 'B', 'C', 'D'],
    answer: 1, objective: '验证学习流程', pitfall: '测试易错说明',
    sourceRef: 'synthetic test fixture', adaptation: '仅供自动检查的虚构数据',
    steps: ['测试解析。'], tags: ['测试标签']
  };
}

function fixtureBank() {
  return {
    id: 'prob-stat-complete-v3', modules: ['测试模块'],
    questions: Array.from({ length: 516 }, (_, n) => question(n + 1))
      .concat(Array.from({ length: 24 }, (_, n) => question(10001 + n))),
    sources: [{ id: 'fixture-public', title: '虚构公开题库' }]
  };
}

function node() {
  return {
    innerHTML: '', textContent: '', value: '', disabled: false, children: [], dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    querySelector() { return this; },
    insertAdjacentHTML(_position, html) { this.innerHTML += html; },
    scrollIntoView() {}, focus() {}, click() {}, remove() {}
  };
}

function harness(options = {}) {
  const storage = options.storage || new Map();
  const listeners = new Map(), nodes = new Map(), blobs = [];
  let now = options.now ?? Date.UTC(2026, 9, 25, 15, 59, 59);
  const randomValues = (options.randomValues || []).slice();
  class FixtureClock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const getNode = id => {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  };
  const addListener = (event, listener) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(listener);
  };
  const bank = fixtureBank();
  const context = {
    Date: FixtureClock, Uint32Array, URLSearchParams, Blob, console,
    navigator: options.navigator,
    crypto: {
      subtle: webcrypto.subtle,
      getRandomValues(array) {
        if (randomValues.length) { array.fill(randomValues.shift()); return array; }
        return webcrypto.getRandomValues(array);
      }
    },
    setTimeout() {}, clearTimeout() {},
    fetch(url) {
      if (!options.bootstrap) return new Promise(() => {});
      assert(['bank.json', 'math-map.json'].includes(url));
      return Promise.resolve({ ok: true, json: async () => url === 'bank.json' ? bank : {} });
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    document: {
      getElementById: getNode, querySelector: getNode,
      addEventListener: addListener, createElement: () => node()
    },
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:fixture'; }, revokeObjectURL() {} },
    location: { search: options.search || '', href: 'https://fixture.invalid/practice/' + (options.search || '') },
    addEventListener: addListener, scrollTo() {}, confirm() { return true; },
    StudyVault: options.vault || { unlock: async () => { throw Error('Fixture credential rejected'); }, lock() {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(options.sourceText || source, context, { filename: 'app.js' });
  if (!options.bootstrap) {
    context.BANK = bank;
    context.MATH = {};
    vm.runInContext(`
      byId = new Map(BANK.questions.map(q => [q.id, q]));
      sourceMap = new Map(BANK.sources.map(s => [s.id, s]));
      progress = readProgress();
    `, context);
  }
  return {
    context, storage, nodes, listeners, blobs,
    setTime(value) { now = value; },
    run(code) { return vm.runInContext(code, context); },
    async emit(event, value = {}) {
      for (const listener of listeners.get(event) || []) await listener(value);
    },
    async click(action, extra = {}) {
      const element = { disabled: false, dataset: { action, ...extra } };
      for (const listener of listeners.get('click') || []) {
        await listener({ target: { closest() { return element; } } });
      }
    },
    async settled() { for (let turn = 0; turn < 8; turn++) await new Promise(setImmediate); }
  };
}

function sessionFor(ids, extra = {}) {
  return { ids, index: 0, answers: {}, checked: [], notes: {}, at: Date.now(),
    done: false, title: '虚构练习', ...extra };
}
function outsideId(context, pool) {
  return context.BANK.questions.find(q => !pool.includes(q.id)).id;
}

function checkDailyDrawAndPersistence() {
  const h = harness({ randomValues: [4] }), c = h.context;
  assert.equal(c.todayGoal().date, '2026-10-25');
  assert.equal(c.todayGoal().target, null);
  assert.equal(c.hasFullAccess(), false);
  c.start([1], '直接进入', 'ordered', 'all');
  assert.equal(c.progress.session, null, 'guest must roll before opening a question');
  c.rollDailyGoal();
  const goal = c.todayGoal(), pool = Array.from(goal.ids);
  assert.equal(goal.target, 5);
  assert.equal(pool.length, 5, 'die determines the entire allowed question pool');
  assert.equal(new Set(pool).size, pool.length);
  assert(pool.every(id => c.byId.has(id)));
  assert.equal(c.BANK.questions.length, 540);
  assert(c.byId.has(10001) && c.byId.has(10024), 'advanced questions belong to the common bank');
  c.rollDailyGoal();
  assert.deepEqual(Array.from(c.todayGoal().ids), pool, 'same-day reroll cannot change the draw');
  const fresh = harness({ storage: h.storage });
  assert.deepEqual(Array.from(fresh.context.todayGoal().ids), pool, 'refresh retains the exact draw');
  assert.equal(fresh.context.todayGoal().target, 5);
  c.start(pool, '今日随机题', 'ordered', 'all');
  assert.deepEqual(Array.from(c.progress.session.ids), pool);
  assert.equal(c.progress.session.dailyDate, '2026-10-25');
  const first = pool[0];
  c.check(true);
  assert(c.todayGoal().submitted.includes(first), '不会做 consumes this question');
  assert(c.progress.wrong.includes(first));
  c.markDailyAttempt(first, -1);
  assert.equal(c.todayGoal().submitted.filter(id => id === first).length, 1);
  const outside = outsideId(c, pool);
  c.markDailyAttempt(outside, -1);
  assert(!c.todayGoal().submitted.includes(outside));
  const afterAnswer = harness({ storage: h.storage });
  afterAnswer.context.startDaily();
  assert(afterAnswer.context.progress.session.checked.includes(first), 'refresh retains completed daily answers');
  assert.equal(afterAnswer.context.progress.session.answers[first], -1);
  const before = JSON.stringify(c.progress.session);
  c.start([outside], '尝试任意选题', 'ordered', 'all');
  assert.equal(JSON.stringify(c.progress.session), before, 'outside question cannot replace an allowed session');
  h.setTime(Date.UTC(2026, 9, 25, 16));
  assert.equal(c.todayGoal().date, '2026-10-26', 'day changes at Beijing midnight');
  assert.equal(c.todayGoal().target, null);
  assert.equal(c.todayGoal().ids.length, 0);
  c.session();
  assert(!h.nodes.get('app').innerHTML.includes(question(first).stem), 'yesterday session cannot bypass a new day');
}

function checkRollBoundariesAndMigration() {
  for (const [values, expected] of [[[0], 1], [[119], 120], [[4294967280, 119], 120]]) {
    const h = harness({ randomValues: values });
    h.context.rollDailyGoal();
    assert.equal(h.context.todayGoal().target, expected);
    assert.equal(h.context.todayGoal().ids.length, expected);
  }
  const storage = new Map([[DAILY_STORAGE, JSON.stringify({
    date: '2026-10-25', target: 3, submitted: [1, 10001]
  })]]);
  const h = harness({ storage }), goal = h.context.todayGoal();
  assert.equal(goal.target, 3, 'existing same-day die must not be rerolled on upgrade');
  assert.equal(goal.ids.length, 3);
  assert(goal.ids.includes(1) && goal.ids.includes(10001), 'prior submitted questions remain part of migrated allowance');
  assert.deepEqual(Array.from(h.context.todayGoal().ids), Array.from(goal.ids));
  assert.deepEqual(Array.from(harness({ storage }).context.todayGoal().ids), Array.from(goal.ids));
}

async function checkConcurrentDraw() {
  let queue = Promise.resolve();
  const navigator = { locks: { request(_name, callback) { queue = queue.then(callback); return queue; } } };
  const storage = new Map();
  const first = harness({ storage, navigator, randomValues: [4] });
  const second = harness({ storage, navigator, randomValues: [119] });
  await Promise.all([first.context.rollDailyGoal(), second.context.rollDailyGoal()]);
  assert.equal(first.context.todayGoal().target, 5);
  assert.equal(second.context.todayGoal().target, 5, 'two tabs rolling together must share a single draw');
  assert.deepEqual(Array.from(first.context.todayGoal().ids), Array.from(second.context.todayGoal().ids));
}

async function checkGuestEntryPoints() {
  const h = harness({ randomValues: [2] }), c = h.context;
  c.rollDailyGoal();
  const pool = Array.from(c.todayGoal().ids), inside = pool[0], outside = outsideId(c, pool);
  c.progress.wrong = [inside, outside];
  c.progress.stars = [inside, outside];
  for (const kind of ['wrong', 'stars']) {
    c.library(kind);
    assert(!h.nodes.get('app').innerHTML.includes(question(outside).stem), `${kind} must not reveal outside question`);
    await h.click('practice-library', { kind });
    assert(!c.progress.session || c.progress.session.ids.every(id => pool.includes(id)));
  }
  for (const action of ['quick', 'daily-start', 'start-filter', 'single']) {
    await h.click(action, { id: String(outside) });
    assert(!c.progress.session || c.progress.session.ids.every(id => pool.includes(id)), `${action} cannot escape today's pool`);
  }
  for (const action of ['tag', 'module', 'reset-filter']) {
    await h.click(action, { tag: '测试标签', module: '测试模块' });
    await h.click('start-filter');
    assert(!c.progress.session || c.progress.session.ids.every(id => pool.includes(id)), `${action} cannot select a fresh pool`);
  }
  c.progress.session = sessionFor([outside], { dailyDate: c.dayKey(), answers: { [outside]: 1 } });
  c.session();
  assert(!h.nodes.get('app').innerHTML.includes(question(outside).stem));
  c.report();
  assert(!h.nodes.get('app').innerHTML.includes('本组知识模块'));
  c.choose(0);
  assert.equal(c.progress.session.answers[outside], 1, 'disallowed session cannot accept answers');
  c.check(true);
  assert(!c.progress.stats[outside], 'disallowed session cannot reveal/check its answer');
  const imported = c.blank();
  imported.session = sessionFor([outside]);
  imported.stats[outside] = { attempts: 1, correct: 0, lastCorrect: false, at: Date.now() };
  imported.wrong = [outside]; imported.stars = [outside];
  const drawBefore = h.storage.get(DAILY_STORAGE);
  c.receiveImport(JSON.stringify(imported));
  assert(c.progress.wrong.includes(outside), 'legacy progress is preserved, not deleted to enforce the draw');
  assert(c.progress.stars.includes(outside));
  assert.equal(h.storage.get(DAILY_STORAGE), drawBefore, 'import must not replace daily allowance');
  c.session();
  assert(!h.nodes.get('app').innerHTML.includes(question(outside).stem));
  c.start(pool, '复习今日题目', 'ordered', 'all');
  c.check(true); c.session();
  assert(h.nodes.get('app').innerHTML.includes(question(pool[0]).stem), 'today pool remains reviewable');
}

function approvedPayload() {
  return { id: 'fixture-access', title: '虚构验证凭证', questions: [], sources: [] };
}

async function checkRememberedCredential() {
  const calls = [];
  const vault = {
    async unlock(code) {
      calls.push(code);
      if (code !== TEST_CODE) throw Error('Fixture credential rejected');
      return approvedPayload();
    }, lock() {}
  };
  const h = harness({ vault }), c = h.context;
  await c.unlockAccess(TEST_CODE, true);
  assert.equal(c.hasFullAccess(), true);
  assert(h.storage.get(ACCESS_STORAGE)?.includes(TEST_CODE), 'verified key is remembered separately on this browser');
  assert.equal(c.BANK.questions.length, 540, 'authentication cannot append duplicate advanced questions');
  c.start([10024], '进阶题普通练习', 'ordered', 'all');
  assert.equal(c.progress.session.ids[0], 10024);
  c.check(true); c.persist();
  assert(!h.storage.get(STORAGE).includes(TEST_CODE));
  c.exportProgress();
  const exported = await h.blobs.at(-1).text();
  assert(!exported.includes(TEST_CODE), 'learning backup must never contain remembered key');
  assert(!exported.includes('UNIQUE_FIXTURE_STEM'), 'backup contains records, not question bodies');
  await h.emit('pagehide');
  assert(h.storage.get(ACCESS_STORAGE)?.includes(TEST_CODE), 'leaving page does not forget a valid key');
  const fresh = harness({ storage: h.storage, vault });
  assert.equal(fresh.context.hasFullAccess(), false, 'stored text alone is not verified entitlement');
  await fresh.context.initializeAccess();
  assert.equal(fresh.context.hasFullAccess(), true, 'reload automatically verifies saved key');
  assert.equal(calls.length, 2);
  assert.equal(fresh.context.progress.stats[10024].attempts, 1);
  fresh.context.forgetAccess();
  assert.equal(fresh.context.hasFullAccess(), false);
  assert.equal(h.storage.has(ACCESS_STORAGE), false, 'manual forget removes local key');
  assert.equal(fresh.context.progress.stats[10024].attempts, 1, 'forgetting key retains progress');
  const invalid = harness({ vault });
  try { await invalid.context.unlockAccess('wrong-fixture-code', true); } catch (_) {}
  assert.equal(invalid.context.hasFullAccess(), false);
  assert.equal(invalid.storage.has(ACCESS_STORAGE), false);
  invalid.storage.set(ACCESS_STORAGE, 'wrong-fixture-code');
  await invalid.context.initializeAccess();
  assert.equal(invalid.context.hasFullAccess(), false, 'invalid remembered credential cannot grant access');

  for (const [failureCode, keep] of [['NETWORK', true], ['INVALID_KEY', false], ['FORMAT', false]]) {
    const unavailable = harness({ storage: new Map([[ACCESS_STORAGE, TEST_CODE]]),
      vault: { async unlock() { throw Object.assign(Error('Fixture validation failure'), { code: failureCode }); } } });
    await unavailable.context.initializeAccess();
    assert.equal(unavailable.context.hasFullAccess(), false);
    assert.equal(unavailable.storage.has(ACCESS_STORAGE), keep,
      'network failure retains remembered key; definitive invalidity removes it');
  }
}

async function checkVerificationIsRequired() {
  let resolveUnlock;
  const h = harness({ vault: { unlock() { return new Promise(resolve => { resolveUnlock = resolve; }); }, lock() {} } });
  const input = node(), button = node();
  input.value = TEST_CODE;
  const form = { id: 'vault-form', querySelector(selector) { return selector.includes('[name=') ? input : button; } };
  const submission = h.emit('submit', { target: form, preventDefault() {} });
  assert.equal(input.value, '', 'form clears entered credential during verification');
  assert.equal(button.disabled, true);
  assert.equal(h.context.hasFullAccess(), false);
  assert.equal(h.storage.has(ACCESS_STORAGE), false, 'pending verification must not persist a key');
  resolveUnlock(approvedPayload());
  await submission;
  assert.equal(h.context.hasFullAccess(), true);
  assert.equal(h.context.accessState.loading, false);
  assert(h.nodes.get('app').innerHTML.includes('本机已解锁'));
  assert(h.storage.get(ACCESS_STORAGE)?.includes(TEST_CODE));

  let resolveLate;
  const late = harness({ vault: { unlock() { return new Promise(resolve => { resolveLate = resolve; }); }, lock() {} } });
  const pending = late.context.unlockAccess(TEST_CODE, true);
  late.context.forgetAccess();
  resolveLate(approvedPayload());
  await pending;
  assert.equal(late.context.hasFullAccess(), false, 'a late response must not undo manual forget');
  assert.equal(late.storage.has(ACCESS_STORAGE), false);

  h.storage.delete(ACCESS_STORAGE);
  await h.emit('storage', { key: ACCESS_STORAGE });
  await h.settled();
  assert.equal(h.context.hasFullAccess(), false, 'clearing key in another tab must remove access in this tab');
}

function checkImportAllowlist() {
  const h = harness(), c = h.context;
  h.run(`
    progress.stats[10001]={attempts:1,correct:0,lastCorrect:false,at:Date.now(),stem:'EXTRA_PAYLOAD'};
    progress.wrong=[10001]; progress.stars=[10001];
    progress.secret='EXTRA_SECRET'; progress.questions=['EXTRA_PAYLOAD'];
    progress.accessKey='SHOULD_NOT_IMPORT'; progress=validate(progress);
  `);
  const result = JSON.stringify(c.progress);
  assert.equal(c.progress.wrong[0], 10001); assert.equal(c.progress.stars[0], 10001);
  assert(!result.includes('EXTRA_PAYLOAD'));
  assert(!result.includes('EXTRA_SECRET'));
  assert(!result.includes('SHOULD_NOT_IMPORT'));
  assert.equal(c.hasFullAccess(), false);
}

async function checkPublishedQueryRoute() {
  const generated = path.join(__dirname, '../docs/practice/app.js');
  if (!fs.existsSync(generated)) throw Error('Build the static website before running this test.');
  const compiled = fs.readFileSync(generated, 'utf8');
  const locked = harness({ sourceText: compiled, bootstrap: true, search: '?question=10024' });
  await locked.settled();
  assert(locked.context.BANK, 'generated app bootstrap must finish');
  assert(!locked.context.progress.session, 'query cannot open a question before guest draws');
  assert(!locked.nodes.get('app').innerHTML.includes(question(10024).stem));
  const drawn = harness({ randomValues: [2] });
  drawn.context.rollDailyGoal();
  const pool = Array.from(drawn.context.todayGoal().ids), outside = outsideId(drawn.context, pool);
  const restricted = harness({ sourceText: compiled, bootstrap: true, storage: drawn.storage,
    search: '?question=' + outside });
  await restricted.settled();
  assert(!restricted.context.progress.session || restricted.context.progress.session.ids.every(id => pool.includes(id)));
  assert(!restricted.nodes.get('app').innerHTML.includes(question(outside).stem));
  const within = harness({ sourceText: compiled, bootstrap: true, storage: drawn.storage,
    search: '?question=' + pool[0] });
  await within.settled();
  assert.equal(within.context.progress.session.ids[0], pool[0], 'query may open a question that is in the daily draw');
  const member = harness({ sourceText: compiled, bootstrap: true,
    storage: new Map([[ACCESS_STORAGE, TEST_CODE]]), search: '?question=10024',
    vault: { async unlock(code) { assert.equal(code, TEST_CODE); return approvedPayload(); }, lock() {} } });
  await member.settled();
  assert.equal(member.context.hasFullAccess(), true);
  assert.equal(member.context.progress.session.ids[0], 10024, 'startup verifies saved key before routing a direct question link');
}

function checkCommentAccessIntegration() {
  const h = harness(), c = h.context, mounted = [];
  let unmounts = 0;
  c.ActuaryComments = {
    mount(host, details) { mounted.push(details.questionId); host.hidden = false; },
    unmount() { unmounts++; }
  };
  c.accessState.unlocked = true;
  c.start([1, 2], 'comment fixture', 'ordered', 'all');
  assert.equal(mounted.length, 0, 'comments must not appear before an answer is checked');
  c.choose(1); c.check(false);
  assert.equal(mounted.at(-1), 1);
  assert.equal(h.nodes.get('question-comments').hidden, false);
  c.render();
  assert.equal(mounted.at(-1), 1, 'same question must retain its stable thread identity');
  c.progress.session.index = 1; c.render();
  assert.equal(h.nodes.get('question-comments').hidden, true, 'next unanswered question cannot show previous discussion');
  c.check(true);
  assert.equal(mounted.at(-1), 2, 'skip/reveal also unlocks the current discussion');
  c.setScreen('home');
  assert.equal(h.nodes.get('question-comments').hidden, true);
  c.screen = 'session'; c.accessState.unlocked = false; c.render();
  assert.equal(h.nodes.get('question-comments').hidden, true, 'revoked question access must hide comments');
  assert(unmounts > 0);
  c.ActuaryComments = { mount() { throw Error('comment service unavailable'); }, unmount() {} };
  c.accessState.unlocked = true;
  assert.doesNotThrow(() => c.render(), 'comment failure must not block practice');
  assert.equal(h.nodes.get('question-comments').hidden, true);
}

async function main() {
  checkDailyDrawAndPersistence();
  checkRollBoundariesAndMigration();
  await checkConcurrentDraw();
  await checkGuestEntryPoints();
  await checkRememberedCredential();
  await checkVerificationIsRequired();
  checkImportAllowlist();
  checkCommentAccessIntegration();
  await checkPublishedQueryRoute();
  console.log('PASS: fixed daily pool, roll bounds/migration/day rollover, guest route guards, unknown-answer quota, preserved progress, remembered-key verification, key-free backups and generated query routes.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
