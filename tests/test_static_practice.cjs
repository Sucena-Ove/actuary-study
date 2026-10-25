'use strict';

// Run with: node public-site/tests/test_static_practice.cjs
// These are application-state checks. Real layout and browser behavior are
// verified separately; this small DOM stand-in deliberately does not render.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '../source-data/app.js'), 'utf8');

function question(id, sourceId = 'fixture-public') {
  return {
    id, sourceId, module: '测试模块', topic: '测试知识点', difficulty: '基础',
    scope: 'core', stem: `测试题目 ${id}`, options: ['A', 'B', 'C', 'D'],
    answer: 1, objective: '验证学习流程', pitfall: '测试易错说明',
    sourceRef: 'synthetic test fixture', adaptation: '仅供自动检查的虚构数据',
    steps: ['测试解析。'], tags: ['测试标签']
  };
}

function node() {
  return {
    innerHTML: '', textContent: '', value: '', disabled: false, children: [],
    classList: { toggle() {} },
    querySelector() { return this; },
    insertAdjacentHTML(_position, html) { this.innerHTML += html; },
    scrollIntoView() {}, focus() {}
  };
}

function harness() {
  const storage = new Map();
  const listeners = new Map();
  const nodes = new Map();
  let now = Date.UTC(2026, 9, 25, 15, 59, 59);
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
  const context = {
    Date: FixtureClock, crypto: webcrypto, Uint32Array,
    setTimeout() {}, clearTimeout() {},
    // Do not let the application's real bootstrap fetch any network resources.
    fetch() { return new Promise(() => {}); },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    document: {
      getElementById: getNode,
      querySelector: getNode,
      addEventListener: addListener
    },
    addEventListener: addListener,
    scrollTo() {}, confirm() { return true; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'app.js' });
  context.BANK = {
    id: 'prob-stat-complete-v3', modules: ['测试模块'],
    questions: [question(1), question(2)],
    sources: [{ id: 'fixture-public', title: '虚构公开题库' }]
  };
  context.MATH = {};
  vm.runInContext(`
    byId = new Map(BANK.questions.map(q => [q.id, q]));
    sourceMap = new Map(BANK.sources.map(s => [s.id, s]));
    progress = blank();
  `, context);
  return {
    context, storage, nodes, listeners,
    setTime(value) { now = value; },
    run(code) { return vm.runInContext(code, context); },
    async emit(event, value) {
      for (const listener of listeners.get(event) || []) await listener(value);
    }
  };
}

function checkDailyGoal() {
  const h = harness(), c = h.context;
  assert.equal(c.todayGoal().date, '2026-10-25');
  c.rollDailyGoal();
  const target = c.todayGoal().target;
  assert(Number.isInteger(target) && target >= 1 && target <= 120);
  c.rollDailyGoal();
  assert.equal(c.todayGoal().target, target, 'same-day roll must stay unchanged');
  c.dailyMemory = null;
  assert.equal(c.todayGoal().target, target, 'roll survives application memory reset');
  c.markDailyAttempt(1);
  c.markDailyAttempt(1);
  c.markDailyAttempt(2);
  assert.equal(c.todayGoal().submitted.length, 2, 'repeat answers count only once');

  h.setTime(Date.UTC(2026, 9, 25, 16));
  assert.equal(c.todayGoal().date, '2026-10-26', 'reset follows Beijing midnight');
  assert.equal(c.todayGoal().target, null);
  assert.equal(c.todayGoal().submitted.length, 0);
  for (let day = 1; day <= 180; day++) {
    h.setTime(Date.UTC(2027, 0, day, 5));
    c.rollDailyGoal();
    const rolled = c.todayGoal().target;
    assert(Number.isInteger(rolled) && rolled >= 1 && rolled <= 120);
  }
  assert.equal(c.BANK.questions.length, 2, 'daily goal never removes public questions');
}

async function checkVaultAndLockedProgress() {
  const h = harness(), c = h.context;
  const fixtureStem = 'ONLY_IN_MEMORY_FIXTURE_QUESTION';
  const payload = {
    id: 'fixture-vault', title: '虚构专题题库',
    sources: [{ id: 'fixture-private', title: '虚构专题来源' }],
    questions: [{ ...question(10001, 'fixture-private'), stem: fixtureStem }]
  };
  let finishUnlock;
  let lockCalls = 0;
  c.StudyVault = {
    unlock(code) {
      assert.equal(code, 'fixture-test-code');
      return new Promise(resolve => { finishUnlock = resolve; });
    },
    lock() { lockCalls++; }
  };
  const input = node(), button = node();
  input.value = 'fixture-test-code';
  const form = {
    id: 'vault-form',
    querySelector(selector) { return selector.includes('[name=') ? input : button; }
  };
  const unlock = h.emit('submit', { target: form, preventDefault() {} });
  assert.equal(input.value, '', 'input is cleared before decryption finishes');
  assert.equal(button.disabled, true);
  finishUnlock(payload);
  await unlock;
  assert.equal(input.value, '');
  assert.equal(button.disabled, false);
  assert.equal(c.vaultState.ids.size, 1);
  assert.equal(c.byId.get(10001).stem, fixtureStem);
  assert.equal(c.BANK.questions.length, 3);

  h.run(`
    progress.stats[10001] = {attempts:1,correct:0,lastCorrect:false,at:Date.now()};
    progress.wrong.push(10001);
    progress.stars.push(10001);
    progress.session = {ids:[10001],index:0,answers:{10001:0},checked:[10001],
      notes:{},at:Date.now(),done:true,title:'专题练习'};
    persist();
  `);
  const saved = h.storage.get('actuary-mobile-400-v1');
  assert(saved, 'progress should persist');
  assert(!saved.includes(fixtureStem), 'progress cannot contain decrypted questions');
  assert(!saved.includes('fixture-test-code'), 'progress cannot contain the code');
  for (const value of h.storage.values()) {
    assert(!value.includes(fixtureStem));
    assert(!value.includes('fixture-test-code'));
  }

  c.lockVault(true);
  assert.equal(c.BANK.questions.length, 2);
  assert.equal(c.byId.has(10001), false);
  assert.equal(c.vaultState.ids.size, 0);
  assert.equal(lockCalls, 1);
  h.run('progress = validate(JSON.parse(localStorage.getItem(STORAGE)));');
  assert.equal(c.progress.wrong[0], 10001);
  assert.equal(c.progress.stars[0], 10001);
  assert.equal(c.progress.session.ids[0], 10001);
  c.session();
  assert(h.nodes.get('app').innerHTML.includes('先打开本组的专题题库'));
  c.report();
  assert(h.nodes.get('app').innerHTML.includes('作答、错题和收藏记录仍然保留'));
  c.library('wrong');
  assert(h.nodes.get('app').innerHTML.includes('进阶题记录已保留'));
  assert(h.nodes.get('app').innerHTML.includes('当前可查看 0 题，另有 1 题待解锁'));
  assert(!h.nodes.get('app').innerHTML.includes('目前没有待复习的错题'));
  c.library('stars');
  assert(h.nodes.get('app').innerHTML.includes('进阶题记录已保留'));
  assert(h.nodes.get('app').innerHTML.includes('当前可查看 0 题，另有 1 题待解锁'));

  c.attachVault(payload);
  assert.equal(c.byId.get(10001).stem, fixtureStem);
  assert.equal(c.progress.stats[10001].attempts, 1);
  c.session();
  assert(h.nodes.get('app').innerHTML.includes(fixtureStem));
  await h.emit('pagehide', {});
  assert.equal(c.byId.has(10001), false);
  assert.equal(h.nodes.get('app').innerHTML, '', 'pagehide removes decrypted DOM for bfcache');
  await h.emit('pageshow', { persisted: true });
  assert(!h.nodes.get('app').innerHTML.includes(fixtureStem));
}

function checkImportAllowlist() {
  const h = harness(), c = h.context;
  h.run(`
    progress.stats[10001]={attempts:1,correct:0,lastCorrect:false,at:Date.now(),stem:'EXTRA_PAYLOAD'};
    progress.wrong=[10001];
    progress.secret='EXTRA_SECRET';
    progress.questions=['EXTRA_PAYLOAD'];
    progress=validate(progress);
  `);
  const result = JSON.stringify(c.progress);
  assert.equal(c.progress.wrong[0], 10001);
  assert(!result.includes('EXTRA_PAYLOAD'));
  assert(!result.includes('EXTRA_SECRET'));
}

async function main() {
  checkDailyGoal();
  await checkVaultAndLockedProgress();
  checkImportAllowlist();
  console.log('PASS: dice range, day reset, distinct answers, memory-only unlock/lock, locked progress/session/wrongbook, bfcache cleanup and import allowlist.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
