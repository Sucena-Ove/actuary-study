'use strict';

const crypto = require('node:crypto');

const VOTE_ROUTE = '/api/question-vote';
const RANK_ROUTE = '/api/question-rank';
const CATALOG_ROUTE = '/api/question-catalog';
const HEX_32 = /^[a-f0-9]{64}$/;

function validateVerifiers(manifest = { version: 1, sha256: [] }) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.sha256) || manifest.sha256.length > 500 ||
      manifest.sha256.some((hash) => typeof hash !== 'string' || !HEX_32.test(hash))) {
    throw new Error('Invalid study access verifier manifest');
  }
  return manifest.sha256.map((hash) => Buffer.from(hash, 'hex'));
}

function authorized(proof, verifiers) {
  if (typeof proof !== 'string' || !HEX_32.test(proof)) return false;
  const digest = crypto.createHash('sha256').update(proof, 'utf8').digest();
  // Check every accepted verifier so position does not become a timing signal.
  let valid = 0;
  for (const verifier of verifiers) valid |= Number(crypto.timingSafeEqual(digest, verifier));
  return valid === 1;
}

const result = (statusCode, body, headers = {}) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', ...headers }, body: JSON.stringify(body) });
const error = (status, message, headers) => result(status, { errno: status, errmsg: message }, headers);

function createVoteGateway({ config, store, readBody }) {
  return async function votes({ event, headers, method, route }) {
    const query = event.queryStringParameters || {};
    if (route === CATALOG_ROUTE) {
      if (method !== 'GET') return error(405, '此接口只支持读取。', { allow: 'GET' });
      if (!authorized(headers['x-study-access'], config.studyAccessVerifiers)) return error(403, '请先用题库密钥解锁，再查看题目目录。');
      if (Object.keys(query).length) return error(400, '题目目录不接受查询参数。');
      const items = await store.questionCatalog([...config.questionIds]);
      return result(200, { errno: 0, data: { items, total: items.length } });
    }
    if (route === RANK_ROUTE) {
      if (method !== 'GET') return error(405, '此接口只支持读取。', { allow: 'GET' });
      // The static site's unlocked boolean and public slot IDs are not credentials.
      // This bearer proof is derived from the content key after successful decryption.
      if (!authorized(headers['x-study-access'], config.studyAccessVerifiers)) return error(403, '请先用题库密钥解锁，再查看榜单。');
      if (Object.keys(query).some((key) => !['sort', 'limit'].includes(key)) ||
          (query.sort !== undefined && !['likes', 'dislikes'].includes(query.sort)) ||
          (query.limit !== undefined && (typeof query.limit !== 'string' || !/^[1-9]\d?$|^100$/.test(query.limit)))) return error(400, '榜单参数无效。');
      const sort = query.sort || 'likes';
      const limit = Number(query.limit || 20);
      const items = await store.questionRanking(sort, limit, [...config.questionIds]);
      return result(200, { errno: 0, data: { sort, limit, items } });
    }
    if (!['GET', 'PUT'].includes(method)) return error(405, '此接口只支持读取或更新投票。', { allow: 'GET, PUT' });
    const voterId = headers['x-study-voter'] || '';
    if ((voterId && !HEX_32.test(voterId)) || (method === 'PUT' && !voterId)) return error(400, '设备投票标识无效，请刷新后重试。');
    if (method === 'GET') {
      if (Object.keys(query).some((key) => key !== 'questionId') || typeof query.questionId !== 'string' || !/^[1-9]\d*$/.test(query.questionId)) return error(400, '题号无效。');
      const questionId = Number(query.questionId);
      if (!config.questionIds.has(questionId)) return error(400, '题号不存在。');
      return result(200, { errno: 0, data: await store.readQuestionVote(questionId, voterId) });
    }
    if (!headers.origin) return error(403, '写入请求需要有效来源。');
    if (Object.keys(query).length) return error(400, '投票参数应放在请求正文中。');
    let body;
    try { body = readBody(event, headers); }
    catch (failure) { return error(failure.message === 'BODY_TOO_LARGE' ? 413 : 400, '请求内容过大或不是有效 JSON。'); }
    if (Object.keys(body).some((key) => !['questionId', 'vote'].includes(key)) ||
        !Number.isSafeInteger(body.questionId) || !config.questionIds.has(body.questionId)) return error(400, '题号不存在或请求参数无效。');
    if (!Number.isInteger(body.vote) || ![-1, 0, 1].includes(body.vote)) return error(400, '投票只能是赞、踩或撤销。');
    const clientIp = headers['x-nf-client-connection-ip'] || event.requestContext?.identity?.sourceIp;
    if (!clientIp) return error(503, '暂时无法验证投票来源，请稍后重试。');
    // Reuse the persistent atomic limiter with a distinct subject namespace.
    // The submitted browser ID is never persisted in plaintext, including here.
    if (!(await store.rateLimit(`question-vote-ip:${clientIp}`, 1)) ||
        !(await store.rateLimit(`question-vote-device:${voterId}`, 1))) return error(429, '操作较快，请一秒后重试。', { 'retry-after': '1' });
    const data = await store.writeQuestionVote(body.questionId, voterId, body.vote);
    return result(200, { errno: 0, data });
  };
}

module.exports = { createVoteGateway, validateVerifiers, authorized, VOTE_ROUTE, RANK_ROUTE, CATALOG_ROUTE };
