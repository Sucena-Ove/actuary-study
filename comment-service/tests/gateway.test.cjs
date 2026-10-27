'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGateway, makeConfig, makeSetupCookie, validSetupCookie, COOKIE_NAME, FUNCTION_PREFIX } = require('../lib/gateway.cjs');
const env = { SERVER_URL: `https://comments-test.netlify.app${FUNCTION_PREFIX}`, BOOTSTRAP_TOKEN: 'TEST_ONLY_NOT_A_DEPLOYMENT_SECRET_1234567890' };
const config = makeConfig(env, [1, 587, 10024]);
const path = '/actuary-study/questions/587.html';

function event(route, method = 'GET', body, changes = {}) {
  return { path: FUNCTION_PREFIX + route, httpMethod: method, queryStringParameters: {}, headers: { origin: config.siteOrigin, 'content-type': 'application/json', 'x-nf-client-connection-ip': '192.0.2.42' }, body: body ? JSON.stringify(body) : '', ...changes };
}

function fixture(overrides = {}) {
  const forwarded = [];
  const store = { emptyUsers: async () => true, withFirstUser: async (action) => action(), approvedParent: async () => null, rateLimit: async () => true, ...overrides };
  const gateway = createGateway({ config, store, waline: async (request) => { forwarded.push(request); return { statusCode: 200, headers: { 'access-control-allow-origin': '*' }, body: '{"errno":0,"data":{}}' }; } });
  return { gateway, forwarded, store };
}

test('accepts exactly production origin and real numeric question manifest', () => {
  assert.throws(() => makeConfig({ ...env, SERVER_URL: 'http://comments-test.netlify.app/foo' }, [1]));
  assert.throws(() => makeConfig({ ...env, SITE_URL: 'https://other.example/' }, [1]));
  assert.throws(() => makeConfig(env, []));
  assert.equal(config.questionPaths.has(path), true);
});

test('rejects hostile Origin, replaces upstream wildcard CORS', async () => {
  const { gateway } = fixture();
  const denied = await gateway(event('/api/comment', 'GET', null, { headers: { origin: 'https://evil.example' } }));
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
  const good = await gateway(event('/api/comment', 'GET', null, { queryStringParameters: { path } }));
  assert.equal(good.headers['access-control-allow-origin'], config.siteOrigin);
  assert.equal(good.headers['access-control-allow-credentials'], undefined);
});

test('unknown, encoded and legacy routes cannot reach Waline', async () => {
  const { gateway, forwarded } = fixture();
  for (const route of ['/user', '/api/user/register', '/api/User', '/api//user', '/api/%75ser', '/api/oauth', '/api/db', '/api/article', '/api/comment/rss']) {
    assert.equal((await gateway(event(route, 'POST', {}))).statusCode, 404, route);
  }
  assert.equal(forwarded.length, 0);
});

test('legacy method and session overrides are rejected, even if empty', async () => {
  const { gateway } = fixture();
  for (const key of ['method', '_method', 'state', 'action', 'controller', 'module']) {
    assert.equal((await gateway(event('/api/comment', 'POST', { url: path, comment: 'test' }, { queryStringParameters: { [key]: '' } }))).statusCode, 400);
  }
});

test('multi-value headers cannot reintroduce identity or CORS, queries cannot override method', async () => {
  const { gateway, forwarded } = fixture();
  const input = event('/api/comment', 'POST', { url: path, comment: 'multi-value attempt' }, { multiValueHeaders: { Authorization: ['Bearer forged'], Cookie: ['secret=1'] } });
  assert.equal((await gateway(input)).statusCode, 200);
  assert.deepEqual(forwarded[0].multiValueHeaders, {});
  assert.equal(forwarded[0].headers.authorization, undefined);
  const queryAttack = event('/api/comment', 'POST', { url: path, comment: 'x' }, { multiValueQueryStringParameters: { method: ['delete'] } });
  assert.equal((await gateway(queryAttack)).statusCode, 400);
  const differentPath = event('/api/comment', 'GET', null, { queryStringParameters: { path }, multiValueQueryStringParameters: { path: [path, '/other'] } });
  assert.equal((await gateway(differentPath)).statusCode, 400);
  const combined = createGateway({ config, store: {}, waline: async () => ({ statusCode: 200, headers: {}, multiValueHeaders: { 'Access-Control-Allow-Origin': ['*'] }, body: '{}' }) });
  assert.deepEqual((await combined(event('/api/comment', 'GET', null, { queryStringParameters: { path } }))).multiValueHeaders, {});
});

test('every ordinary visitor receives anonymous identity and no auth token is forwarded', async () => {
  const { gateway, forwarded } = fixture();
  const input = event('/api/comment', 'POST', { url: path, comment: '讨论题解', nick: '管理员', mail: 'fake@example.com', link: 'https://evil.example', user_id: 1, status: 'approved', label: '站长', ua: 'secret-UA' });
  input.headers.authorization = 'Bearer fake'; input.headers.cookie = 'private=value'; input.headers['x-forwarded-for'] = 'forged-address';
  assert.equal((await gateway(input)).statusCode, 200);
  const sent = forwarded[0];
  assert.deepEqual(JSON.parse(sent.body), { url: path, comment: '讨论题解', nick: '匿名同学', mail: '', link: '', ua: '' });
  assert.equal(sent.headers.authorization, undefined); assert.equal(sent.headers.cookie, undefined);
  assert.equal(sent.headers['x-forwarded-for'], '192.0.2.42');
});

test('unknown question cannot create or read a thread', async () => {
  const { gateway } = fixture();
  for (const url of ['/actuary-study/questions/588.html', 'https://sucena-ove.github.io' + path, path + '?x=1', '/arbitrary']) {
    assert.equal((await gateway(event('/api/comment', 'POST', { url, comment: 'x' }))).statusCode, 400);
    assert.equal((await gateway(event('/api/comment', 'GET', null, { queryStringParameters: { path: url } }))).statusCode, 400);
  }
});

test('comments are bounded, JSON only, no control characters', async () => {
  const { gateway } = fixture();
  for (const comment of ['', ' ', '字'.repeat(2001), 'x\u0000y', null, {}]) assert.equal((await gateway(event('/api/comment', 'POST', { url: path, comment }))).statusCode, 400);
  const huge = event('/api/comment', 'POST', { url: path, comment: 'x'.repeat(17000) });
  assert.equal((await gateway(huge)).statusCode, 413);
  const form = event('/api/comment', 'POST', { url: path, comment: 'hi' }); form.headers['content-type'] = 'text/plain';
  assert.equal((await gateway(form)).statusCode, 400);
  assert.equal((await gateway(event('/api/comment', 'POST', { url: path, comment: '字'.repeat(2000) }))).statusCode, 200);
});

test('rate limiting fails closed and returns Retry-After', async () => {
  const { gateway, forwarded } = fixture({ rateLimit: async () => false });
  const result = await gateway(event('/api/comment', 'POST', { url: path, comment: 'x' }));
  assert.equal(result.statusCode, 429); assert.equal(result.headers['retry-after'], '60'); assert.equal(forwarded.length, 0);
});

test('reply must exist, be approved, and belong to this question', async () => {
  const checked = [];
  const { gateway, forwarded } = fixture({ approvedParent: async (id, url) => { checked.push([id, url]); return id === '11' ? { id: 11, rid: 7 } : null; } });
  assert.equal((await gateway(event('/api/comment', 'POST', { url: path, comment: 'x', pid: '12' }))).statusCode, 400);
  assert.equal((await gateway(event('/api/comment', 'POST', { url: path, comment: 'x', rid: '7' }))).statusCode, 400);
  assert.equal((await gateway(event('/api/comment', 'POST', { url: path, comment: 'x', pid: '11', rid: '999' }))).statusCode, 200);
  assert.deepEqual(checked[1], ['11', path]); assert.equal(JSON.parse(forwarded[0].body).rid, '7');
});

test('no public registration, including valid-looking email/password', async () => {
  const { gateway, forwarded } = fixture();
  const result = await gateway(event('/api/user', 'POST', { email: 'owner@example.com', password: 'long-test-password' }, { headers: { origin: config.serverOrigin, 'content-type': 'application/json' } }));
  assert.equal(result.statusCode, 403); assert.equal(forwarded.length, 0);
});

test('administrator UI refuses external token redirects and URL login credentials', async () => {
  const { gateway, forwarded } = fixture();
  for (const key of ['redirect', 'token', 'state', 'code']) {
    assert.equal((await gateway(event('/ui/login', 'GET', null, { queryStringParameters: { [key]: 'https://evil.example/' } }))).statusCode, 400);
  }
  assert.equal(forwarded.length, 0);
});

test('administrator login accepts only upstream dashboard return routes', async () => {
  const { gateway, forwarded } = fixture();
  for (const redirect of ['/ui', '/ui/', '/ui/user', '/ui/profile', '/ui/migration']) {
    const result = await gateway(event('/ui/login', 'GET', null, { queryStringParameters: { redirect, lang: 'zh-CN' } }));
    assert.equal(result.statusCode, 200, redirect);
    assert.equal(forwarded.at(-1).queryStringParameters.redirect, redirect);
  }
  for (const redirect of ['https://evil.example/ui', '//evil.example/ui', '\\evil.example\\ui', '/ui/../evil', '/ui?token=x', '/ui#token=x', '%2Fui', '/ui//', '/ui/login', '', ['/ui']]) {
    assert.equal((await gateway(event('/ui/login', 'GET', null, { queryStringParameters: { redirect } }))).statusCode, 400, String(redirect));
  }
  assert.equal((await gateway(event('/ui', 'GET', null, { queryStringParameters: { redirect: '/ui' } }))).statusCode, 400);
  assert.equal((await gateway(event('/ui/login', 'GET', null, { queryStringParameters: { redirect: '/ui', token: 'injected' } }))).statusCode, 400);
});

test('setup cookies are signed, expire and reject duplicate cookie values', () => {
  const now = Date.now(); const value = makeSetupCookie(env.BOOTSTRAP_TOKEN, now);
  assert.equal(validSetupCookie({ cookie: `${COOKIE_NAME}=${value}` }, env.BOOTSTRAP_TOKEN, now), true);
  assert.equal(validSetupCookie({ cookie: `${COOKIE_NAME}=${value}x` }, env.BOOTSTRAP_TOKEN, now), false);
  assert.equal(validSetupCookie({ cookie: `${COOKIE_NAME}=${value}` }, env.BOOTSTRAP_TOKEN, now + 901000), false);
  assert.equal(validSetupCookie({ cookie: `${COOKIE_NAME}=${value}; ${COOKIE_NAME}=${value}` }, env.BOOTSTRAP_TOKEN, now), false);
  assert.equal(validSetupCookie({ cookie: `${COOKIE_NAME}=${value}` }, '', now), false);
});

test('setup requires correct secret and same-origin form POST, never URL token', async () => {
  const { gateway } = fixture();
  assert.equal((await gateway(event('/setup/session', 'POST', { token: env.BOOTSTRAP_TOKEN }))).statusCode, 403);
  assert.equal((await gateway(event('/setup/session', 'GET', null, { queryStringParameters: { token: env.BOOTSTRAP_TOKEN } }))).statusCode, 403);
  const wrong = event('/setup/session', 'POST', { token: 'bad' }, { headers: { origin: config.serverOrigin, 'content-type': 'application/json' } });
  assert.equal((await gateway(wrong)).statusCode, 403);
  wrong.body = JSON.stringify({ token: env.BOOTSTRAP_TOKEN });
  const good = await gateway(wrong);
  assert.equal(good.statusCode, 303);
  assert.match(good.headers['set-cookie'], /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(good.headers.location.includes(env.BOOTSTRAP_TOKEN), false);
});

test('bootstrap and setup are closed after any user exists', async () => {
  const { gateway, forwarded } = fixture({ emptyUsers: async () => false, withFirstUser: async () => null });
  const headers = { origin: config.serverOrigin, 'content-type': 'application/json', cookie: `${COOKIE_NAME}=${makeSetupCookie(env.BOOTSTRAP_TOKEN)}` };
  assert.equal((await gateway(event('/setup/session', 'POST', { token: env.BOOTSTRAP_TOKEN }, { headers }))).statusCode, 403);
  assert.equal((await gateway(event('/api/user', 'POST', { email: 'owner@example.com', password: 'long-test-password' }, { headers }))).statusCode, 403);
  assert.equal(forwarded.length, 0);
});

test('first registration uses a server-controlled payload and consumes cookie', async () => {
  const { gateway, forwarded } = fixture();
  const headers = { origin: config.serverOrigin, 'content-type': 'application/json', cookie: `${COOKIE_NAME}=${makeSetupCookie(env.BOOTSTRAP_TOKEN)}` };
  const result = await gateway(event('/api/user', 'POST', { email: 'Owner@example.com', password: 'long-test-password', type: 'administrator', avatar: 'evil', github: 'spoof' }, { headers }));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(forwarded[0].body), { email: 'owner@example.com', password: 'long-test-password', display_name: '题库管理员' });
  assert.match(result.headers['set-cookie'], /Max-Age=0/);
});

test('anonymous likes, edits, deletes and bulk recent reads are disabled', async () => {
  const { gateway } = fixture();
  for (const method of ['PUT', 'DELETE']) assert.equal((await gateway(event('/api/comment/5', method, { like: true }))).statusCode, 403);
  assert.equal((await gateway(event('/api/comment', 'GET', null, { queryStringParameters: { type: 'recent' } }))).statusCode, 400);
});

test('same-origin admin GET can omit Origin, but still needs Authorization', async () => {
  const { gateway, forwarded } = fixture();
  const request = event('/api/comment', 'GET', null, { headers: { authorization: 'Bearer test-admin-token' }, queryStringParameters: { type: 'list' } });
  assert.equal((await gateway(request)).statusCode, 200); assert.equal(forwarded.length, 1);
  request.headers = {};
  assert.equal((await gateway(request)).statusCode, 403);
});

test('upstream server failures do not expose SQL or configuration', async () => {
  const gateway = createGateway({ config, store: {}, waline: async () => ({ statusCode: 500, headers: {}, body: 'password=secret; SELECT * FROM wl_users' }) });
  const result = await gateway(event('/api/comment', 'GET', null, { queryStringParameters: { path } }));
  assert.equal(result.statusCode, 503); assert.equal(result.body.includes('secret'), false);
});
