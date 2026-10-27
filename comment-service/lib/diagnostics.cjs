'use strict';

// Diagnostics must remain useful in the private platform log without copying
// exception messages, SQL, stack traces, connection strings or environment values.
function diagnostic(error, stage) {
  const result = {
    event: 'comment-service-unavailable',
    stage,
    errorType: ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError'].includes(error?.name) ? error.name : 'Error',
  };
  if (typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code)) result.code = error.code;
  const missing = /^Missing required environment field: ([A-Z_]+)$/.exec(error?.message || '');
  if (missing) result.code = `CONFIG_MISSING_${missing[1]}`;
  const known = new Map([
    ['SERVER_URL must be the HTTPS Netlify comment function endpoint', 'CONFIG_SERVER_URL_FORMAT'],
    ['SITE_URL must be the production actuary-study site', 'CONFIG_SITE_URL_FORMAT'],
    ['Question id manifest is missing or invalid', 'CONFIG_QUESTION_MANIFEST'],
    ['JWT_TOKEN must contain at least 32 random characters', 'CONFIG_JWT_LENGTH'],
    ['PG_SSL=true is required for Neon', 'CONFIG_PG_SSL'],
    ['This deployment uses the official wl_ schema', 'CONFIG_PG_PREFIX'],
    ['No valid storage found. Please check your environment variables.', 'WALINE_STORAGE_CONFIG'],
  ]);
  if (known.has(error?.message)) result.code = known.get(error.message);
  if (['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(error?.code)) {
    const match = /Cannot find (?:module|package) '([^']+)'/.exec(error.message || '');
    if (match && match[1].length <= 160 && /^(?:@[a-z0-9_-]+\/)?[a-z0-9_-]+(?:\/[a-z0-9_.-]+)*$/i.test(match[1])) result.missingModule = match[1];
  }
  return result;
}

module.exports = { diagnostic };
