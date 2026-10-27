'use strict';

const crypto = require('node:crypto');

const FUNCTION_PREFIX = '/.netlify/functions/comment';
const COOKIE_NAME = '__Host-waline-setup';
const MAX_COMMENT_LENGTH = 2000;
const MAX_BODY_BYTES = 16384;
const ANONYMOUS = '匿名同学';
const SETUP_LIFETIME = 15 * 60;

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function makeSetupCookie(secret, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SETUP_LIFETIME}.${crypto.randomBytes(20).toString('hex')}`;
  return `${payload}.${signature(payload, secret)}`;
}

function validSetupCookie(headers, secret, now = Date.now()) {
  if (!secret || secret.length < 32) return false;
  const cookies = String(headers.cookie || '').split(';').map((part) => part.trim());
  const matching = cookies.filter((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (matching.length !== 1) return false;
  const value = matching[0].slice(COOKIE_NAME.length + 1);
  const parts = value.split('.');
  if (parts.length !== 3 || !/^\d{10}$/.test(parts[0]) || !/^[a-f0-9]{40}$/.test(parts[1])) return false;
  const expiry = Number(parts[0]);
  const current = Math.floor(now / 1000);
  if (expiry <= current || expiry > current + SETUP_LIFETIME) return false;
  return safeEqual(parts[2], signature(`${parts[0]}.${parts[1]}`, secret));
}

function cookieHeader(value, maxAge = SETUP_LIFETIME) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function makeConfig(env, questionIds) {
  const server = new URL(env.SERVER_URL);
  const site = new URL(env.SITE_URL || 'https://sucena-ove.github.io/actuary-study/');
  if (server.protocol !== 'https:' || server.pathname.replace(/\/$/, '') !== FUNCTION_PREFIX || server.search || server.hash) {
    throw new Error('SERVER_URL must be the HTTPS Netlify comment function endpoint');
  }
  if (site.protocol !== 'https:' || site.origin !== 'https://sucena-ove.github.io' || site.pathname.replace(/\/$/, '') !== '/actuary-study') {
    throw new Error('SITE_URL must be the production actuary-study site');
  }
  if (!Array.isArray(questionIds) || !questionIds.length || questionIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new Error('Question id manifest is missing or invalid');
  }
  return {
    serverOrigin: server.origin,
    serverURL: `${server.origin}${FUNCTION_PREFIX}`,
    siteOrigin: site.origin,
    allowedOrigins: new Set([server.origin, site.origin]),
    questionPaths: new Set(questionIds.map((id) => `/actuary-study/questions/${id}.html`)),
    bootstrapToken: env.BOOTSTRAP_TOKEN || '',
    maxCommentLength: MAX_COMMENT_LENGTH,
  };
}

function headersOf(event) {
  return Object.fromEntries(Object.entries(event.headers || {}).map(([name, value]) => [name.toLowerCase(), String(value)]));
}

function routeOf(event) {
  // Exact whitelist only: encoded slashes, duplicate slashes, dot segments and legacy
  // ThinkJS controller aliases must not bypass the registration guard.
  let path = event.path || '';
  if (!path.startsWith(`${FUNCTION_PREFIX}/`) && path !== FUNCTION_PREFIX) return null;
  path = path.slice(FUNCTION_PREFIX.length) || '/';
  if (/%|\\|\/\/|(?:^|\/)\.\.?\//.test(path)) return null;
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

function response(statusCode, message, extra = {}) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8', ...extra }, body: JSON.stringify({ errno: statusCode, errmsg: message }) };
}

function finish(result, origin, config, isSetupPage = false) {
  if (result.statusCode >= 500) result = response(503, '评论服务暂时不可用，请稍后再试。');
  const headers = Object.fromEntries(Object.entries(result.headers || {}).filter(([key]) => !key.toLowerCase().startsWith('access-control-')));
  Object.assign(headers, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    // A native same-origin HTML form needs its Origin preserved. Only our
    // script-free setup document opts in; APIs and the dashboard stay private.
    'referrer-policy': isSetupPage && headers['referrer-policy'] === 'same-origin' ? 'same-origin' : 'no-referrer',
    'x-frame-options': 'DENY',
    vary: 'Origin',
  });
  if (origin && config.allowedOrigins.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['access-control-allow-headers'] = 'Content-Type, Authorization';
  }
  // Same-origin admin sessions do not need cross-origin credential sharing.
  const multiValueHeaders = Object.fromEntries(Object.entries(result.multiValueHeaders || {}).filter(([key]) => !key.toLowerCase().startsWith('access-control-')));
  return { ...result, headers, multiValueHeaders };
}

function readBody(event, headers, allowForm = false) {
  const raw = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
  if (raw.length > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
  if (allowForm && headers['content-type']?.split(';')[0] === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
  }
  if (headers['content-type']?.split(';')[0] !== 'application/json') throw new Error('JSON_REQUIRED');
  const body = JSON.parse(raw.toString('utf8'));
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('JSON_REQUIRED');
  return body;
}

function eventWithBody(event, body, headers) {
  return { ...event, body: JSON.stringify(body), isBase64Encoded: false, headers: { ...headers, 'content-type': 'application/json' } };
}

function contentError(content) {
  if (typeof content !== 'string' || !content.trim()) return '请输入评论内容。';
  if ([...content].length > MAX_COMMENT_LENGTH) return `评论最多 ${MAX_COMMENT_LENGTH} 字。`;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)) return '评论包含不支持的控制字符。';
  return null;
}

function setupPage() {
  // No third-party scripts, no token in URLs or HTML. The owner types the secret.
  return { statusCode: 200, headers: {
    'content-type': 'text/html; charset=utf-8',
    'referrer-policy': 'same-origin',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  }, body: `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>评论管理员初始化</title><style>body{max-width:36rem;margin:4rem auto;padding:0 1rem;font:18px/1.7 system-ui}input,button{font:inherit;padding:.6rem;max-width:100%;box-sizing:border-box}input{width:100%}button{margin-top:1rem}</style><h1>评论管理员初始化</h1><p>仅网站所有者使用。输入你在 Netlify 设置的 BOOTSTRAP_TOKEN，验证后在 Waline 页面自行设置管理员邮箱与密码。</p><form method="post" action="${FUNCTION_PREFIX}/setup/session"><label>初始化密钥<input type="password" name="token" autocomplete="off" required minlength="32" maxlength="256"></label><button type="submit">验证并创建管理员</button></form><p>已有管理员时无法再次注册。日常管理请打开 <a href="${FUNCTION_PREFIX}/ui">管理后台</a>。</p></html>` };
}

function createGateway({ config, waline, store, now = Date.now }) {
  return async function handler(originalEvent, context) {
    // Netlify uses Lambda v1 events. Eliminate alternative multi-value and v2
    // transport representations before validation or delegation to serverless-http.
    if (originalEvent.version === '2.0' || originalEvent.requestPath || originalEvent.requestContext?.elb) return finish(response(400, '不支持此请求格式。'), '', config);
    const multiQuery = originalEvent.multiValueQueryStringParameters || {};
    const singleQuery = originalEvent.queryStringParameters || {};
    if (Object.entries(multiQuery).some(([key, values]) => !Array.isArray(values) || values.length !== 1 || String(values[0]) !== String(singleQuery[key]))) return finish(response(400, '重复或不一致的请求参数。'), '', config);
    originalEvent = { ...originalEvent, headers: headersOf(originalEvent), multiValueHeaders: {}, multiValueQueryStringParameters: {}, queryStringParameters: { ...singleQuery } };
    const headers = headersOf(originalEvent);
    const origin = headers.origin || '';
    const method = (originalEvent.httpMethod || '').toUpperCase();
    // Same-origin browser GET requests may omit Origin. Waline's own referrer
    // check still expects one; only reads receive this internal default.
    if (method === 'GET' && !origin) originalEvent.headers.origin = config.serverOrigin;
    const route = routeOf(originalEvent);
    const send = (res, isSetupPage = false) => finish(res, origin, config, isSetupPage);
    if (!route) return send(response(404, 'Not found'));
    if (origin && !config.allowedOrigins.has(origin)) return send(response(403, '来源不允许。'));
    if (method === 'OPTIONS') {
      if (!origin) return send(response(403, '需要有效来源。'));
      return send({ statusCode: 204, body: '', headers: {} });
    }
    if (method === 'GET' && route === '/health') return send({ statusCode: 200, headers: {}, body: JSON.stringify({ ok: true, service: 'question-comments' }) });
    if (route === '/setup' && method === 'GET') return send(setupPage(), true);
    if (route === '/setup/session') {
      if (method !== 'POST' || origin !== config.serverOrigin) return send(response(403, '请在评论服务自己的初始化页面操作。'));
      let body;
      try { body = readBody(originalEvent, headers, true); }
      catch { return send(response(400, '初始化表单无效。')); }
      if (config.bootstrapToken.length < 32 || !safeEqual(body.token, config.bootstrapToken)) return send(response(403, '初始化密钥无效或初始化已关闭。'));
      if (!(await store.emptyUsers())) return send(response(403, '管理员已经创建，注册已关闭。'));
      return send({ statusCode: 303, headers: { location: `${FUNCTION_PREFIX}/ui/register`, 'set-cookie': cookieHeader(makeSetupCookie(config.bootstrapToken, now())) }, body: '' });
    }
    if (/^\/ui(?:\/[a-zA-Z0-9_-]+)*$/.test(route) && method === 'GET') {
      const uiQuery = originalEvent.queryStringParameters || {};
      // Access redirects unauthenticated dashboard visits back through login.
      // Permit only those verified internal routes; upstream also supports
      // external token redirects, which this single-owner dashboard must reject.
      const internalRedirects = new Set(['/ui', '/ui/user', '/ui/profile', '/ui/migration']);
      const invalidRedirect = Object.hasOwn(uiQuery, 'redirect') && (
        route !== '/ui/login' || typeof uiQuery.redirect !== 'string' ||
        !internalRedirects.has(uiQuery.redirect.replace(/\/$/, ''))
      );
      if (Object.keys(uiQuery).some((key) => !['lang', 'redirect'].includes(key)) || invalidRedirect) return send(response(400, '只允许后台站内跳转，请不要附加外部地址或登录凭据。'));
      if (route === '/ui/register' && !validSetupCookie(headers, config.bootstrapToken, now())) return send(response(403, '公开注册已关闭，请由站长通过 /setup 初始化。'));
      return send(await waline(originalEvent, context));
    }
    const resource = route.match(/^\/api\/(comment|user|token)(?:\/([1-9]\d*|2fa|password))?$/);
    if (!resource || !['GET', 'POST', 'PUT', 'DELETE'].includes(method)) return send(response(404, 'Not found'));
    const [, kind, identifier] = resource;
    const query = originalEvent.queryStringParameters || {};
    if (['state', 'action', 'controller', 'module', 'method', '_method'].some((key) => Object.hasOwn(query, key))) return send(response(400, '不支持此接口参数。'));
    const allowedQuery = new Set(['path', 'type', 'lang', 'page', 'pageSize', 'sortBy', 'status', 'keyword', 'email', 'uid', 'owner']);
    if (Object.entries(query).some(([key, value]) => !allowedQuery.has(key) || typeof value !== 'string' || value.length > 500)) return send(response(400, '不支持此接口参数。'));
    if (method !== 'GET' && !origin) return send(response(403, '写入请求需要有效来源。'));
    if ((kind === 'user' || kind === 'token') && method !== 'GET' && origin !== config.serverOrigin) return send(response(403, '管理员操作仅限管理后台。'));
    // No publicly writable article counters, reactions, OAuth, import or legacy routes.
    let body;
    if (method !== 'GET') {
      try { body = readBody(originalEvent, headers); }
      catch (error) { return send(response(error.message === 'BODY_TOO_LARGE' ? 413 : 400, '请求内容过大或不是有效 JSON。')); }
    }
    if (kind === 'user' && method === 'POST') {
      if (identifier || !validSetupCookie(headers, config.bootstrapToken, now())) return send(response(403, '公开注册已关闭。'));
      if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254 || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) {
        return send(response(400, '请输入有效邮箱，以及 12–128 位管理员密码。'));
      }
      const data = { email: body.email.trim().toLowerCase(), password: body.password, display_name: '题库管理员' };
      for (const key of ['turnstile', 'recaptchaV3']) if (typeof body[key] === 'string') data[key] = body[key];
      const result = await store.withFirstUser(async () => waline(eventWithBody(originalEvent, data, headers), context));
      if (!result) return send(response(403, '管理员已经创建，注册已关闭。'));
      return send({ ...result, headers: { ...result.headers, 'set-cookie': cookieHeader('', 0) } });
    }
    // All public comment creation is anonymous, even if a browser has a leftover
    // Waline token. Admin identity is only used by the separate moderation UI.
    let event = originalEvent;
    if (kind === 'comment' && method === 'POST') {
      if (identifier) return send(response(404, 'Not found'));
      if (!config.questionPaths.has(body.url)) return send(response(400, '题号不存在。'));
      const invalid = contentError(body.comment);
      if (invalid) return send(response(400, invalid));
      const data = { comment: body.comment.trim(), url: body.url, nick: ANONYMOUS, mail: '', link: '', ua: '' };
      for (const key of ['pid', 'rid']) {
        if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
          if (!/^[1-9]\d{0,9}$/.test(String(body[key]))) return send(response(400, '回复编号无效。'));
          data[key] = String(body[key]);
        }
      }
      if (data.pid) {
        const parent = await store.approvedParent(data.pid, data.url);
        if (!parent) return send(response(400, '只能回复这道题已公开的评论。'));
        data.rid = String(parent.rid || parent.id);
      } else if (data.rid) return send(response(400, '回复缺少父评论。'));
      for (const key of ['turnstile', 'recaptchaV3']) if (typeof body[key] === 'string') data[key] = body[key];
      const anonymousHeaders = { ...headers };
      delete anonymousHeaders.authorization;
      delete anonymousHeaders.cookie;
      // Netlify overwrites this platform header. Never trust caller x-forwarded-for.
      const clientIp = headers['x-nf-client-connection-ip'] || originalEvent.requestContext?.identity?.sourceIp;
      if (!clientIp) return send(response(503, '暂时无法验证请求来源，请稍后重试。'));
      anonymousHeaders['x-forwarded-for'] = clientIp;
      anonymousHeaders['x-real-ip'] = clientIp;
      event = eventWithBody(originalEvent, data, anonymousHeaders);
      const accepted = await store.rateLimit(`comment:${clientIp}`, 60);
      if (!accepted) return send(response(429, '请间隔 60 秒再发表评论。', { 'retry-after': '60' }));
    }
    if (kind === 'comment' && method === 'GET' && !identifier) {
      if (query.type === 'list') {
        if ((origin && origin !== config.serverOrigin) || !headers.authorization) return send(response(403, '需要管理员登录。'));
      } else if (!config.questionPaths.has(query.path) || (query.type && query.type !== 'count')) return send(response(400, '请选择一个有效题号。'));
    }
    if (kind === 'comment' && ['PUT', 'DELETE'].includes(method)) {
      // Anonymous likes/edit/delete are intentionally disabled.
      if (!identifier || origin !== config.serverOrigin || !headers.authorization) return send(response(403, '评论管理需要管理员登录。'));
      if (method === 'PUT' && body.comment !== undefined) {
        const invalid = contentError(body.comment);
        if (invalid) return send(response(400, invalid));
      }
      if (method === 'PUT' && body.url !== undefined && !config.questionPaths.has(body.url)) return send(response(400, '题号不存在。'));
    }
    if (kind === 'token' && method === 'POST') {
      const ip = headers['x-nf-client-connection-ip'] || originalEvent.requestContext?.identity?.sourceIp;
      if (!ip || !(await store.rateLimit(`login:${ip}`, 3))) return send(response(429, '登录尝试过于频繁，请稍后再试。', { 'retry-after': '3' }));
    }
    return send(await waline(event, context));
  };
}

module.exports = { createGateway, makeConfig, contentError, makeSetupCookie, validSetupCookie, cookieHeader, routeOf, FUNCTION_PREFIX, COOKIE_NAME, MAX_COMMENT_LENGTH, ANONYMOUS };
