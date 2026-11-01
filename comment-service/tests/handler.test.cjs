'use strict';

// Integration test: the production Netlify export, real Waline/ThinkJS,
// serverless-http, password hashing and DOMPurify. Storage is a deliberately
// isolated in-memory fixture, so no network credentials or Neon account are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { makeSetupCookie, COOKIE_NAME, FUNCTION_PREFIX } = require('../lib/gateway.cjs');
const origin = 'https://comment-handler-test.netlify.app';
Object.assign(process.env, {
  SERVER_URL: origin + FUNCTION_PREFIX,
  BOOTSTRAP_TOKEN: 'TEST_ONLY_BOOTSTRAP_NOT_A_REAL_SECRET_12345',
  JWT_TOKEN: 'TEST_ONLY_JWT_NOT_A_REAL_SECRET_1234567890',
  PG_HOST: 'fixture.invalid', PG_DB: 'fixture', PG_USER: 'fixture', PG_PASSWORD: 'fixture', PG_SSL: 'true',
});
const rows = { Users: [], Comment: [], Counter: [] };
const questionVotes = new Map();
const rankProof = 'e5'.repeat(32);
// Replace only this test process's manifest export with a synthetic credential.
// Neither a real vault key nor a production proof is read into the integration test.
const accessPath = require.resolve('../study-access-verifiers.json');
require(accessPath);
require.cache[accessPath].exports = { version: 1, sha256: [crypto.createHash('sha256').update(rankProof).digest('hex')] };
const pg = require('pg');
const statements = [];
const query = async (sql, params) => {
  statements.push(sql);
  if (sql.includes('NOT EXISTS')) return { rows: [{ empty: rows.Users.length === 0 }] };
  if (sql.includes('wl_request_limit')) return { rowCount: 1, rows: [] };
  if (sql.startsWith('INSERT INTO wl_question_vote')) {
    questionVotes.set(`${params[0]}:${params[1]}`, { questionId: params[0], hash: params[1], vote: params[2] });
    return { rows: [] };
  }
  if (sql.includes('AS my_vote')) {
    const matching = [...questionVotes.values()].filter((row) => row.questionId === params[0]);
    return { rows: [{ likes: matching.filter((row) => row.vote === 1).length, dislikes: matching.filter((row) => row.vote === -1).length, my_vote: matching.find((row) => row.hash === params[1])?.vote || 0 }] };
  }
  if (sql.includes('AS totals')) return { rows: [] };
  if (sql.includes('GROUP BY question_id')) return { rows: [] };
  if (sql.includes('SELECT id, rid')) return { rows: rows.Comment.filter((row) => String(row.objectId) === String(params[0]) && row.url === params[1] && row.status === params[2]).map((row) => ({ id: row.objectId, rid: row.rid })) };
  return { rows: [] };
};
pg.Pool.prototype.query = query;
pg.Pool.prototype.connect = async () => ({ query, release() {} });

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === '_complex') return true;
    if (Array.isArray(value)) {
      if (value[0] === 'IN') return value[1].some((x) => String(x) === String(row[key]));
      if (value[0] === 'NOT IN') return !value[1].includes(row[key]);
      if (value[0] === '!=') return row[key] !== value[1];
      if (value[0] === '>') return new Date(row[key]) > new Date(value[1]);
    }
    if (value === undefined || value === null) return row[key] === undefined || row[key] === null || row[key] === '';
    return String(row[key]) === String(value);
  });
}

const model = (name) => ({
  select: async (where = {}, options = {}) => rows[name].filter((row) => matches(row, where)).slice(options.offset || 0, options.limit ? (options.offset || 0) + options.limit : undefined).map((row) => ({ ...row })),
  count: async (where = {}) => rows[name].filter((row) => matches(row, where)).length,
  add: async (data) => {
    const row = { ...data, objectId: rows[name].length + 1 };
    // PostgreSQL persists integer IDs, while Waline's add response preserves input fields.
    const persisted = { ...row };
    if (name === 'Comment') for (const key of ['pid', 'rid']) if (persisted[key] != null) persisted[key] = Number(persisted[key]);
    rows[name].push(persisted);
    return { ...row };
  },
  update: async (data, where) => rows[name].filter((row) => matches(row, where)).map((row) => { Object.assign(row, data); return { ...row }; }),
  delete: async (where) => { rows[name] = rows[name].filter((row) => !matches(row, where)); },
});

const { handler } = require('../netlify/functions/comment.js');
function request(route, method = 'GET', body, queryStringParameters = {}, extraHeaders = {}) {
  const queryString = new URLSearchParams(queryStringParameters).toString();
  const rawBody = body === undefined ? '' : JSON.stringify(body);
  return handler({
    path: FUNCTION_PREFIX + route,
    rawUrl: origin + FUNCTION_PREFIX + route + (queryString ? `?${queryString}` : ''),
    rawQuery: queryString,
    httpMethod: method, queryStringParameters,
    headers: { host: 'comment-handler-test.netlify.app', origin, 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(rawBody, 'utf8')), 'x-forwarded-proto': 'https', 'x-nf-client-connection-ip': '192.0.2.14', 'user-agent': 'integration-test', ...extraHeaders },
    body: rawBody, isBase64Encoded: false,
  }, {});
}

test('production export serves anonymous vote reads/writes and verifies independent ranking proof', async () => {
  const voter = 'd4'.repeat(32);
  const read = await request('/api/question-vote', 'GET', undefined, { questionId: '587' });
  assert.equal(read.statusCode, 200, read.body);
  assert.deepEqual(JSON.parse(read.body).data, { questionId: 587, likes: 0, dislikes: 0, myVote: 0 });
  for (const vote of [1, 1, -1, 0]) {
    const response = await request('/api/question-vote', 'PUT', { questionId: 587, vote }, {}, { 'x-study-voter': voter });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(JSON.parse(response.body).data, { questionId: 587, likes: Number(vote === 1), dislikes: Number(vote === -1), myVote: vote });
  }
  assert.equal(questionVotes.size, 1);
  assert.notEqual([...questionVotes.values()][0].hash, voter);
  assert.equal((await request('/api/question-rank')).statusCode, 403);
  assert.equal((await request('/api/question-rank', 'GET', undefined, {}, { 'x-study-access': 'a'.repeat(64) })).statusCode, 403);
  const rank = await request('/api/question-rank', 'GET', undefined, {}, { 'x-study-access': rankProof });
  assert.equal(rank.statusCode, 200, rank.body);
  assert.deepEqual(JSON.parse(rank.body).data, { sort: 'likes', limit: 20, items: [] });
});

test('production catalog returns the entire current manifest behind the same proof boundary', async () => {
  assert.equal((await request('/api/question-catalog')).statusCode, 403);
  assert.equal((await request('/api/question-catalog', 'GET', undefined, {}, { 'x-study-access': 'a'.repeat(64) })).statusCode, 403);
  assert.equal((await request('/api/question-catalog', 'POST', {}, {}, { 'x-study-access': rankProof })).statusCode, 405);
  assert.equal((await request('/api/question-catalog', 'GET', undefined, { limit: '611' }, { 'x-study-access': rankProof })).statusCode, 400);
  const response = await request('/api/question-catalog', 'GET', undefined, {}, { 'x-study-access': rankProof });
  assert.equal(response.statusCode, 200, response.body);
  const manifest = require('../question-ids.json');
  const ids = [...(Array.isArray(manifest) ? manifest : manifest.ids)].sort((a, b) => a - b);
  const body = JSON.parse(response.body);
  assert.equal(body.errno, 0);
  assert.equal(body.data.total, ids.length);
  assert.deepEqual(body.data.items, ids.map((questionId) => ({ questionId, likes: 0, dislikes: 0 })));
  assert.doesNotMatch(response.body, /myVote|voter|hash/);
});

test('production handler initializes pinned Waline and serves guarded management UI', async () => {
  const health = await request('/health');
  assert.equal(health.statusCode, 200, health.body);
  assert.equal(JSON.parse(health.body).ok, true);
  assert.equal(think.config('model').postgresql.ssl.rejectUnauthorized, true);
  assert.equal(think.config('model').postgresql.logSql, false);
  assert.equal(think.config('markdown').plugin.tex, false);
  think.config('customModel', model);
  const ui = await request('/ui');
  assert.equal(ui.statusCode, 200, ui.body);
  assert.match(ui.body, /https:\/\/comment-handler-test.netlify.app\/admin.js/);
  assert.match(ui.body, /window.oauthServices = \[\]/);
  assert.equal((await request('/ui/register')).statusCode, 403);
});

test('real Waline registration can only create the first owner behind bootstrap cookie', async () => {
  const body = { email: 'test-owner@example.com', password: 'TEST_ONLY_LONG_PASSWORD_12345' };
  assert.equal((await request('/api/user', 'POST', body)).statusCode, 403);
  const cookie = `${COOKIE_NAME}=${makeSetupCookie(process.env.BOOTSTRAP_TOKEN)}`;
  const result = await request('/api/user', 'POST', body, {}, { cookie });
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(JSON.parse(result.body).errno, 0, result.body);
  assert.equal(rows.Users.length, 1);
  assert.equal(rows.Users[0].type, 'administrator');
  assert.notEqual(rows.Users[0].password, body.password);
  assert.equal((await request('/api/user', 'POST', body, {}, { cookie })).statusCode, 403);
  assert.ok(statements.some((sql) => sql.includes('pg_advisory_xact_lock')));
});

test('real Waline renders comments without script execution or remote media', async () => {
  const response = await request('/api/comment', 'POST', {
    url: '/actuary-study/questions/587.html',
    comment: '公式讨论 **加粗** <script>alert(1)</script><img src="https://track.invalid/pixel" onerror="alert(2)"> ![x](https://track.invalid/markdown.png) <iframe src="https://track.invalid"></iframe>',
    nick: '站长', user_id: '1', mail: 'test-owner@example.com', status: 'approved',
  }, {}, { authorization: 'Bearer forged' });
  assert.equal(response.statusCode, 200, response.body);
  const data = JSON.parse(response.body);
  assert.equal(data.errno, 0, response.body);
  assert.equal(data.data.nick, '匿名同学');
  assert.equal(data.data.type, undefined);
  assert.doesNotMatch(data.data.comment, /<script|<img|<iframe|onerror|track\.invalid/i);
  assert.match(data.data.comment, /<strong>加粗<\/strong>/);
  assert.equal(data.data.avatar, origin + '/anonymous.svg');
  assert.equal(rows.Comment[0].user_id, undefined);
  assert.equal(rows.Comment[0].mail, '');
});

test('real administrator login works, ordinary visitors cannot moderate', async () => {
  const result = await request('/api/token', 'POST', { email: 'test-owner@example.com', password: 'TEST_ONLY_LONG_PASSWORD_12345' });
  assert.equal(result.statusCode, 200, result.body);
  const login = JSON.parse(result.body);
  assert.equal(login.errno, 0, result.body);
  assert.ok(login.data.token);
  const unauthenticated = await request('/api/comment/1', 'DELETE', {});
  assert.equal(unauthenticated.statusCode, 403);
  const admin = await request('/api/comment', 'GET', undefined, { type: 'list', owner: 'all', status: 'approved', keyword: '', page: '1', lang: 'zh-CN' }, { origin: '', authorization: `Bearer ${login.data.token}` });
  assert.equal(admin.statusCode, 200, admin.body);
  assert.equal(JSON.parse(admin.body).errno, 0, admin.body);
});

test('reply POST IDs match the numeric PostgreSQL GET IDs used by the client', async () => {
  const path = '/actuary-study/questions/587.html';
  const rootId = rows.Comment[0].objectId;
  const response = await request('/api/comment', 'POST', {
    url: path, comment: '回复：补充推导步骤', pid: String(rootId), rid: '999',
  }, {}, { 'x-nf-client-connection-ip': '192.0.2.15' });
  assert.equal(response.statusCode, 200, response.body);
  const reply = JSON.parse(response.body).data;
  const listing = await request('/api/comment', 'GET', undefined, { path });
  assert.equal(listing.statusCode, 200, listing.body);
  const result = JSON.parse(listing.body).data;
  const root = result.data.find(({ objectId }) => objectId === rootId);
  assert.ok(root);
  assert.equal(result.count, 2);
  assert.equal(reply.pid, root.objectId);
  assert.equal(reply.rid, root.objectId);
  const persistedReply = root.children.find(({ objectId }) => objectId === reply.objectId);
  assert.ok(persistedReply);
  assert.equal(reply.pid, persistedReply.pid);
  assert.equal(reply.rid, persistedReply.rid);
});
