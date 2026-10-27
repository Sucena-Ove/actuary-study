'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { diagnostic } = require('../lib/diagnostics.cjs');

test('diagnostics identify configuration fields without logging secret values', () => {
  assert.equal(diagnostic(new Error('Missing required environment field: PG_PASSWORD'), 'store').code, 'CONFIG_MISSING_PG_PASSWORD');
  assert.equal(diagnostic(new Error('PG_SSL=true is required for Neon'), 'store').code, 'CONFIG_PG_SSL');
  const error = new Error('postgresql://user:TEST_SECRET@db.example/database; SELECT email FROM wl_users');
  error.stack = 'TEST_SECRET in a private stack';
  assert.deepEqual(diagnostic(error, 'request'), { event: 'comment-service-unavailable', stage: 'request', errorType: 'Error' });
});

test('missing-module diagnostics only include a bounded npm module identifier', () => {
  const error = Object.assign(new Error("Cannot find module '@waline/vercel'"), { code: 'MODULE_NOT_FOUND' });
  assert.equal(diagnostic(error, 'waline-load').missingModule, '@waline/vercel');
  error.message = "Cannot find module '/private/path/TEST_SECRET'";
  assert.equal(diagnostic(error, 'waline-load').missingModule, undefined);
  error.message = "Cannot find module 'https://user:TEST_SECRET@example.com'";
  assert.equal(diagnostic(error, 'waline-load').missingModule, undefined);
});

test('arbitrary exception names and codes cannot leak messages into logs', () => {
  const output = JSON.stringify(diagnostic({ name: 'TEST_SECRET', code: 'password=TEST_SECRET', message: 'TEST_SECRET' }, 'request'));
  assert.equal(output.includes('TEST_SECRET'), false);
});
