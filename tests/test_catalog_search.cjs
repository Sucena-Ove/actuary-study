'use strict';

// Run with: node tests/test_catalog_search.cjs
// A DOM boundary fixture exercises the shipped static search script, without
// loading production question data or relying on a browser's storage state.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/search.js'), 'utf8');

function row(id, { tags = ['点估计'], module = '统计推断', level = '基础', search = '点估计 gamma 均值' } = {}) {
  return { id, hidden: false, dataset: { tags: JSON.stringify(tags), module, level, search } };
}

function harness({ query = '', rows = [], missingTopicUI = false, failHistory = false, noSearch = false } = {}) {
  const nodes = new Map();
  const replacements = [];
  const start = new URL('https://sucena-ove.github.io/actuary-study/questions.html' + query);
  const location = { href: start.href, search: start.search };
  const historyState = { unrelated: 'keep this state' };
  const history = {
    state: historyState,
    replaceState(state, title, url) {
      if (failHistory) throw new Error('Fixture denied history update');
      assert.equal(state, historyState);
      assert.equal(title, '');
      const next = new URL(url, location.href);
      assert.equal(next.origin, start.origin);
      replacements.push(next);
      location.href = next.href;
      location.search = next.search;
    },
  };
  const unavailable = new Set(missingTopicUI ? ['exact-topic-filter', 'exact-topic-label', 'clear-topic-filter'] : []);
  if (noSearch) unavailable.add('search');
  function getNode(id) {
    if (unavailable.has(id)) return null;
    if (!nodes.has(id)) {
      const listeners = new Map();
      nodes.set(id, {
        hidden: false, value: '', textContent: '',
        set innerHTML(_) { throw new Error('Search must never render query text as HTML'); },
        addEventListener(type, callback) { listeners.set(type, callback); },
        dispatch(type) { let prevented = false; const listener = listeners.get(type); if (listener) listener({ preventDefault() { prevented = true; } }); return prevented; },
      });
    }
    return nodes.get(id);
  }
  vm.runInNewContext(source, {
    URL, URLSearchParams, location, history,
    document: { getElementById: getNode, querySelectorAll(selector) { assert.equal(selector, '.question-row'); return rows; } },
  });
  return {
    rows, nodes, replacements, location,
    node: getNode,
    visible: () => rows.filter((entry) => !entry.hidden).map((entry) => entry.id),
    input(id, value) { getNode(id).value = value; getNode(id).dispatch('input'); },
  };
}

test('exact tag selection never matches a substring, search text, differently cased tag or invalid tag metadata', () => {
  const rows = [
    row(1), row(2, { tags: ['无偏点估计'] }), row(3, { tags: ['区间估计'], search: '点估计 gamma 均值' }),
    row(4, { tags: ['点估计', '多标签'] }), row(5, { tags: ['点估计', 1] }),
    row(6, { tags: { value: '点估计' } }), row(7), row(8),
  ];
  rows[6].dataset.tags = 'not JSON';
  delete rows[7].dataset.tags;
  const fixture = harness({ query: '?tag=' + encodeURIComponent('点估计'), rows });
  assert.deepEqual(fixture.visible(), [1, 4]);
  assert.equal(fixture.node('exact-topic-label').textContent, '专题：点估计');
  assert.equal(fixture.node('exact-topic-filter').hidden, false);
  assert.equal(fixture.node('search').value, '');
  assert.equal(fixture.node('result-count').textContent, '找到 2 道题 · 共 8 道');
  const caseSensitive = harness({ query: '?tag=Gamma', rows: [row(1, { tags: ['Gamma'] }), row(2, { tags: ['gamma'] })] });
  assert.deepEqual(caseSensitive.visible(), [1]);
});

test('tag, module, level and each free-text term are combined with AND, including initial deep-link filters', () => {
  const fixture = harness({
    query: '?' + new URLSearchParams({ tag: '点估计', module: '统计推断', level: '基础', q: 'GAMMA 均值' }),
    rows: [row(1), row(2, { module: '概率分布' }), row(3, { level: '提高' }), row(4, { search: '点估计 gamma 方差' }), row(5, { tags: ['区间估计'] })],
  });
  assert.deepEqual(fixture.visible(), [1]);
  fixture.input('filter-level', '提高');
  assert.deepEqual(fixture.visible(), [3]);
  fixture.input('filter-module', '概率分布');
  assert.deepEqual(fixture.visible(), []);
  assert.equal(fixture.node('empty-result').hidden, false);
  fixture.input('filter-level', '');
  assert.deepEqual(fixture.visible(), [2]);
  fixture.input('filter-module', '统计推断');
  fixture.input('search', 'gamma 方差');
  assert.deepEqual(fixture.visible(), [4]);
  assert.equal(fixture.node('search-form').dispatch('submit'), true);
  assert.deepEqual(fixture.visible(), [4]);
});

test('clearing exact topic preserves the other filters, unrelated query and hash, then restores eligible rows', () => {
  const fixture = harness({
    query: '?' + new URLSearchParams({ tag: '点估计', module: '统计推断', level: '基础', q: 'gamma', keep: 'one & two' }) + '#question-5',
    rows: [row(1), row(2, { tags: ['区间估计'] }), row(3, { module: '概率分布' }), row(4, { level: '提高' }), row(5, { search: '正态分布' })],
  });
  assert.deepEqual(fixture.visible(), [1]);
  fixture.node('clear-topic-filter').dispatch('click');
  assert.deepEqual(fixture.visible(), [1, 2]);
  assert.equal(fixture.node('filter-module').value, '统计推断');
  assert.equal(fixture.node('filter-level').value, '基础');
  assert.equal(fixture.node('search').value, 'gamma');
  assert.equal(fixture.node('exact-topic-filter').hidden, true);
  assert.equal(fixture.node('exact-topic-label').textContent, '');
  const url = fixture.replacements[0];
  assert.equal(url.searchParams.has('tag'), false);
  assert.equal(url.searchParams.get('module'), '统计推断');
  assert.equal(url.searchParams.get('level'), '基础');
  assert.equal(url.searchParams.get('q'), 'gamma');
  assert.equal(url.searchParams.get('keep'), 'one & two');
  assert.equal(url.hash, '#question-5');
});

test('malicious tag text remains literal, not markup, and blocked history writes do not block clearing', () => {
  const malicious = '<img src=x onerror=alert(1)> & "标签"';
  const fixture = harness({ query: '?tag=' + encodeURIComponent(malicious), failHistory: true, rows: [row(1, { tags: [malicious] }), row(2)] });
  assert.deepEqual(fixture.visible(), [1]);
  assert.equal(fixture.node('exact-topic-label').textContent, '专题：' + malicious);
  fixture.node('clear-topic-filter').dispatch('click');
  assert.deepEqual(fixture.visible(), [1, 2]);
  assert.equal(fixture.node('exact-topic-filter').hidden, true);
  assert.equal(fixture.replacements.length, 0);
});

test('existing q-only links and form edits work without the optional new topic controls', () => {
  const fixture = harness({ query: '?q=GAMMA', missingTopicUI: true, rows: [row(1), row(2, { search: '正态分布' })] });
  assert.deepEqual(fixture.visible(), [1]);
  fixture.input('search', '正态');
  assert.deepEqual(fixture.visible(), [2]);
  fixture.input('search', '');
  assert.deepEqual(fixture.visible(), [1, 2]);
  assert.equal(fixture.node('empty-result').hidden, true);
  assert.doesNotThrow(() => harness({ noSearch: true }));
});
