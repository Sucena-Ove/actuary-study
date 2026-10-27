'use strict';

const http = require('node:http');
const { createGateway, makeConfig, contentError, ANONYMOUS } = require('../../lib/gateway.cjs');
const { createStore } = require('../../lib/store.cjs');
const manifest = require('../../question-ids.json');

let handler;

function initialize() {
  const config = makeConfig(process.env, Array.isArray(manifest) ? manifest : manifest.ids);
  const store = createStore(process.env);
  // Explicit values avoid accidental exposure of commenter geography, email
  // notifications or external anti-spam processors in an anonymous-only service.
  Object.assign(process.env, {
    SITE_URL: 'https://sucena-ove.github.io/actuary-study/',
    SITE_NAME: '精算随身练',
    LOGIN: 'disable',
    IPQPS: '60',
    DISABLE_USERAGENT: 'true', DISABLE_REGION: 'true', DISABLE_AUTHOR_NOTIFY: 'true',
    AKISMET_KEY: 'false', AVATAR_PROXY: 'false',
    GRAVATAR_STR: '',
    MARKDOWN_TEX: 'false', MARKDOWN_HIGHLIGHT: 'false',
    WALINE_ADMIN_MODULE_ASSET_URL: `${config.serverOrigin}/admin.js`,
    _HANDLER: 'comment.handler',
  });
  const Waline = require('@waline/vercel');
  const serverless = require('serverless-http');
  const app = Waline({
    env: 'netlify',
    // Empty, local data URL: no third-party OAuth discovery on each request.
    oauthUrl: 'data:application/json,%7B%22services%22%3A%5B%5D%7D',
    secureDomains: [new URL(config.siteOrigin).hostname, new URL(config.serverOrigin).hostname],
    avatarUrl: () => `${config.serverOrigin}/anonymous.svg`,
    audit: process.env.COMMENT_AUDIT === 'true',
    domPurify: {
      FORBID_TAGS: ['form', 'input', 'style', 'img', 'iframe', 'video', 'audio', 'object', 'embed'],
      FORBID_ATTR: ['autoplay', 'style'],
    },
    async preSave(comment) {
      if (!config.questionPaths.has(comment.url)) return { errmsg: '题号不存在。' };
      const invalid = contentError(comment.comment);
      if (invalid) return { errmsg: invalid };
      if (!comment.user_id) Object.assign(comment, { nick: ANONYMOUS, mail: '', link: '', ua: '' });
    },
    async preUpdate(comment) {
      if (comment.comment !== undefined) {
        const invalid = contentError(comment.comment);
        if (invalid) return { errmsg: invalid };
      }
    },
  });
  // The upstream PostgreSQL adapter defaults to encryption without checking the
  // server certificate. Neon presents a trusted certificate; verify it here.
  const modelConfig = think.config('model');
  for (const value of Object.values(modelConfig)) if (value && typeof value === 'object') value.logSql = false;
  modelConfig.postgresql.ssl = { rejectUnauthorized: true };
  think.config('model', modelConfig);
  return createGateway({ config, store, waline: serverless(http.createServer(app)) });
}

exports.handler = async (event, context) => {
  try {
    handler ||= initialize();
    return await handler(event, context);
  } catch {
    // Never return environment values, database URLs, SQL errors or stack traces.
    console.error('Comment service unavailable; check required environment fields and database schema.');
    return { statusCode: 503, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify({ errno: 503, errmsg: '评论服务暂时不可用，请稍后再试。' }) };
  }
};
