'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createGateway, makeConfig, FUNCTION_PREFIX } = require('../lib/gateway.cjs');
const { validateVerifiers, authorized } = require('../lib/question-votes.cjs');
const proof = 'a1'.repeat(32); // Synthetic fixture, never a deployment credential.
const voter = 'b2'.repeat(32);
const otherVoter = 'c3'.repeat(32);
const verifier = crypto.createHash('sha256').update(proof).digest('hex');
const config = makeConfig({ SERVER_URL: `https://vote-test.netlify.app${FUNCTION_PREFIX}` }, [1, 587], { version: 1, sha256: [verifier] });
function event(route, method = 'GET', body, query = {}, extraHeaders = {}) {
  return { path: FUNCTION_PREFIX + route, httpMethod: method, queryStringParameters: query,
    headers: { origin: config.siteOrigin, 'content-type': 'application/json', 'x-study-voter': voter, 'x-nf-client-connection-ip': '192.0.2.7', ...extraHeaders },
    body: body === undefined ? '' : JSON.stringify(body) };
}
function fixture(overrides = {}) {
  const votes = new Map();
  const calls = [];
  const read = async (questionId, voterId) => {
    const matching = [...votes.entries()].filter(([key]) => key.startsWith(`${questionId}:`));
    return { questionId, likes: matching.filter(([, value]) => value === 1).length,
      dislikes: matching.filter(([, value]) => value === -1).length, myVote: votes.get(`${questionId}:${voterId}`) || 0 };
  };
  const store = {
    readQuestionVote: read,
    writeQuestionVote: async (questionId, voterId, vote) => { calls.push(['write', questionId, voterId, vote]); if (vote) votes.set(`${questionId}:${voterId}`, vote); else votes.delete(`${questionId}:${voterId}`); return read(questionId, voterId); },
    questionRanking: async (...args) => { calls.push(['rank', ...args]); return [{ questionId: 587, likes: 2, dislikes: 1 }]; },
    rateLimit: async (...args) => { calls.push(['limit', ...args]); return true; },
    ...overrides,
  };
  const gateway = createGateway({ config, store, waline: async () => { calls.push(['waline']); return { statusCode: 200, body: '{}' }; } });
  return { gateway, calls, votes };
}
const data = (response) => JSON.parse(response.body).data;

test('public likes and dislikes, same browser replacement and undo, no voter metadata in response', async () => {
  const { gateway } = fixture();
  const put = (vote, id = voter) => gateway(event('/api/question-vote', 'PUT', { questionId: 587, vote }, {}, { 'x-study-voter': id }));
  assert.deepEqual(data(await put(1)), { questionId: 587, likes: 1, dislikes: 0, myVote: 1 });
  assert.deepEqual(data(await put(1)), { questionId: 587, likes: 1, dislikes: 0, myVote: 1 });
  assert.deepEqual(data(await put(-1)), { questionId: 587, likes: 0, dislikes: 1, myVote: -1 });
  assert.deepEqual(data(await put(1, otherVoter)), { questionId: 587, likes: 1, dislikes: 1, myVote: 1 });
  const anonymous = await gateway(event('/api/question-vote', 'GET', undefined, { questionId: '587' }, { 'x-study-voter': '' }));
  assert.deepEqual(data(anonymous), { questionId: 587, likes: 1, dislikes: 1, myVote: 0 });
  assert.doesNotMatch(anonymous.body, /voter|hash|a1a1|b2b2|c3c3/i);
  assert.deepEqual(data(await put(0)), { questionId: 587, likes: 1, dislikes: 0, myVote: 0 });
  assert.deepEqual(data(await put(0)), { questionId: 587, likes: 1, dislikes: 0, myVote: 0 });
});

test('only genuine proof opens rankings, public verifier, boolean, admin-looking token and URL proof fail', async () => {
  const { gateway, calls } = fixture();
  for (const invalid of ['', 'true', verifier, 'f'.repeat(64), proof.toUpperCase()]) {
    const response = await gateway(event('/api/question-rank', 'GET', undefined, {}, { 'x-study-access': invalid, authorization: 'Bearer made-up-admin-token' }));
    assert.equal(response.statusCode, 403, invalid);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(JSON.parse(response.body).data, undefined);
  }
  assert.equal((await gateway(event('/api/question-rank', 'GET', undefined, { proof, unlocked: 'true' }))).statusCode, 403);
  assert.equal(calls.filter(([kind]) => kind === 'rank').length, 0);
  const good = await gateway(event('/api/question-rank', 'GET', undefined, { sort: 'dislikes', limit: '5' }, { 'x-study-access': proof }));
  assert.deepEqual(data(good), { sort: 'dislikes', limit: 5, items: [{ questionId: 587, likes: 2, dislikes: 1 }] });
  assert.deepEqual(calls.find(([kind]) => kind === 'rank'), ['rank', 'dislikes', 5, [1, 587]]);
  assert.doesNotMatch(good.body, new RegExp(proof + '|' + verifier));
});

test('rank parameters cannot inject sort SQL, exceed limits, or pass alternative credentials', async () => {
  const { gateway } = fixture();
  for (const query of [{ limit: '0' }, { limit: '101' }, { limit: '01' }, { limit: '1.1' }, { sort: 'likes DESC; DROP TABLE wl_users' }, { proof }, { _method: 'GET' }]) {
    assert.equal((await gateway(event('/api/question-rank', 'GET', undefined, query, { 'x-study-access': proof }))).statusCode, 400);
  }
  assert.equal(data(await gateway(event('/api/question-rank', 'GET', undefined, {}, { 'x-study-access': proof }))).limit, 20);
  assert.equal((await gateway(event('/api/question-rank', 'PUT', {}, {}, { 'x-study-access': proof }))).statusCode, 405);
});

test('invalid question, vote, voter, duplicate query and wrong transport cannot reach persistence', async () => {
  const { gateway, calls } = fixture();
  for (const questionId of [0, 2, -1, 1.2, '587', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await gateway(event('/api/question-vote', 'PUT', { questionId, vote: 1 }))).statusCode, 400);
  }
  for (const vote of ['1', true, 2, null]) assert.equal((await gateway(event('/api/question-vote', 'PUT', { questionId: 587, vote }))).statusCode, 400);
  for (const id of ['', 'random', voter.toUpperCase(), voter + 'a']) assert.equal((await gateway(event('/api/question-vote', 'PUT', { questionId: 587, vote: 1 }, {}, { 'x-study-voter': id }))).statusCode, 400);
  for (const questionId of ['2', '0', '-1', '1.1', '01', '1;SELECT', '999999999999999999999999']) assert.equal((await gateway(event('/api/question-vote', 'GET', undefined, { questionId }))).statusCode, 400);
  assert.equal((await gateway(event('/api/question-vote', 'PUT', { questionId: 587, vote: 1 }, { questionId: '587' }))).statusCode, 400);
  assert.equal((await gateway(event('/api/question-vote', 'POST', { questionId: 587, vote: 1 }))).statusCode, 405);
  const duplicated = event('/api/question-vote', 'GET', undefined, { questionId: '587' });
  duplicated.multiValueQueryStringParameters = { questionId: ['587', '1'] };
  assert.equal((await gateway(duplicated)).statusCode, 400);
  const multiHeader = event('/api/question-rank');
  multiHeader.multiValueHeaders = { 'X-Study-Access': [proof] };
  assert.equal((await gateway(multiHeader)).statusCode, 403);
  assert.equal(calls.length, 0);
});

test('same device and trusted Netlify IP are limited independently; forged forwarded IP is ignored', async () => {
  const { gateway, calls } = fixture();
  await gateway(event('/api/question-vote', 'PUT', { questionId: 587, vote: 1 }, {}, { 'x-forwarded-for': 'attacker-controlled' }));
  assert.deepEqual(calls.filter(([kind]) => kind === 'limit'), [['limit', 'question-vote-ip:192.0.2.7', 1], ['limit', `question-vote-device:${voter}`, 1]]);
  for (const blockedPart of ['question-vote-ip:', 'question-vote-device:']) {
    const blocked = fixture({ rateLimit: async (subject) => !subject.startsWith(blockedPart) });
    const response = await blocked.gateway(event('/api/question-vote', 'PUT', { questionId: 587, vote: 1 }));
    assert.equal(response.statusCode, 429);
    assert.equal(response.headers['retry-after'], '1');
    assert.equal(blocked.votes.size, 0);
  }
  const missingIp = await gateway(event('/api/question-vote', 'PUT', { questionId: 587, vote: 1 }, {}, { 'x-nf-client-connection-ip': '', 'x-forwarded-for': 'attacker-controlled' }));
  assert.equal(missingIp.statusCode, 503);
});

test('Origin/CORS and failure isolation preserve existing comment/admin routes', async () => {
  const { gateway, calls } = fixture({ readQuestionVote: async () => { throw new Error('PRIVATE_DATABASE_DIAGNOSTIC'); } });
  const evil = await gateway(event('/api/question-rank', 'GET', undefined, {}, { origin: 'https://evil.example', 'x-study-access': proof }));
  assert.equal(evil.statusCode, 403);
  assert.equal(evil.headers['access-control-allow-origin'], undefined);
  assert.equal((await gateway(event('/api/question-vote', 'PUT', { questionId: 587, vote: 1 }, {}, { origin: '' }))).statusCode, 403);
  const preflight = await gateway(event('/api/question-vote', 'OPTIONS'));
  assert.match(preflight.headers['access-control-allow-headers'], /X-Study-Access, X-Study-Voter/);
  assert.equal(preflight.headers['access-control-allow-credentials'], undefined);
  const failure = await gateway(event('/api/question-vote', 'GET', undefined, { questionId: '587' }));
  assert.equal(failure.statusCode, 503);
  assert.doesNotMatch(failure.body, /PRIVATE|DATABASE/);
  assert.equal((await gateway(event('/api/comment', 'GET', undefined, { path: '/actuary-study/questions/587.html' }))).statusCode, 200);
  assert.equal((await gateway(event('/ui/register'))).statusCode, 403);
  assert.equal((await gateway(event('/api/user', 'POST', { email: 'try@example.com', password: 'DO_NOT_USE_FIXTURE_123' }))).statusCode, 403);
  assert.equal(calls.filter(([kind]) => kind === 'waline').length, 1);
});

test('verifier manifests fail closed and cryptographic proof is checked against every accepted digest', () => {
  assert.equal(authorized(proof, validateVerifiers({ version: 1, sha256: [verifier] })), true);
  assert.equal(authorized(proof, validateVerifiers()), false);
  assert.equal(authorized(verifier, validateVerifiers({ version: 1, sha256: [verifier] })), false);
  for (const invalid of [{ version: 2, sha256: [verifier] }, { version: 1, sha256: ['short'] }, null]) assert.throws(() => validateVerifiers(invalid));
});
