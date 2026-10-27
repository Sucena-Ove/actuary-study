'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patchAdminBundle } = require('../scripts/build.cjs');
const original = fs.readFileSync(require.resolve('@waline/admin'), 'utf8');

test('bundled administrator links resolve fixed question threads without duplicating the project path', () => {
  const patched = patchAdminBundle(original);
  const expression = patched.match(/Ea = (\(e\) => [^\r\n]+), Da =/)[1];
  const site = 'https://sucena-ove.github.io/actuary-study/';
  const link = vm.runInNewContext(expression, { URL, window: { SITE_URL: site } });
  for (const id of [1, 575, 587, 10001, 10024]) {
    const thread = `/actuary-study/questions/${id}.html`;
    assert.equal(link(thread), `https://sucena-ove.github.io${thread}`);
  }
  for (const thread of ['/other', '/actuary-study/questions/0.html', '/actuary-study/questions/1.html?x=1', '//other.example/', 'https://other.example/']) {
    assert.equal(link(thread), site + thread, 'unrelated upstream behavior is unchanged');
  }
});

test('administrator patch fails closed when its pinned source changes or is ambiguous', () => {
  assert.throws(() => patchAdminBundle('changed upstream bundle'), /exactly once/);
  assert.throws(() => patchAdminBundle(original + original), /exactly once/);
  assert.throws(() => patchAdminBundle(patchAdminBundle(original)), /exactly once/);
});
