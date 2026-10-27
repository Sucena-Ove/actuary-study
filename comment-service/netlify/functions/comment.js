'use strict';

const http = require('node:http');
const { createGateway, makeConfig, contentError, ANONYMOUS } = require('../../lib/gateway.cjs');
const { createStore } = require('../../lib/store.cjs');
const { diagnostic } = require('../../lib/diagnostics.cjs');
const manifest = require('../../question-ids.json');

let handler;
let initializationStage = 'not-started';

function initialize() {
  initializationStage = 'config';
  const config = makeConfig(process.env, Array.isArray(manifest) ? manifest : manifest.ids);
  initializationStage = 'store';
  const store = createStore(process.env);
  // Explicit values avoid accidental exposure of commenter geography, email
  // notifications or external anti-spam processors in an anonymous-only service.
  Object.assign(process.env, {
    SERVER_URL: config.serverURL,
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
  initializationStage = 'waline-load';
  const Waline = require('@waline/vercel');
  const serverless = require('serverless-http');
  initializationStage = 'waline-init';
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
  initializationStage = 'database-adapter';
  const modelConfig = think.config('model');
  for (const value of Object.values(modelConfig)) if (value && typeof value === 'object') value.logSql = false;
  modelConfig.postgresql.ssl = { rejectUnauthorized: true };
  think.config('model', modelConfig);
  initializationStage = 'http-adapter';
  const gateway = createGateway({ config, store, waline: serverless(http.createServer(app)) });
  initializationStage = 'ready';
  return gateway;
}

exports.handler = async (event, context) => {
  try {
    handler ||= initialize();
    return await handler(event, context);
  } catch (error) {
    // Never return environment values, database URLs, SQL errors or stack traces.
    console.error(JSON.stringify(diagnostic(error, handler ? 'request' : initializationStage)));
    return { statusCode: 503, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify({ errno: 503, errmsg: '评论服务暂时不可用，请稍后再试。' }) };
  }
};
