'use strict';

const fs = require('node:fs');
const path = require('node:path');

// @waline/admin 0.36.0 concatenates SITE_URL and the thread path. Our thread
// already contains /actuary-study, so resolve only the fixed question format.
const ADMIN_LINK_SOURCE = 'Ea = (e) => (window.SITE_URL ?? "") + e, Da =';
const ADMIN_LINK_PATCH = String.raw`Ea = (e) => (/^\/actuary-study\/questions\/[1-9]\d*\.html$/u.test(e) ? new URL(e, window.SITE_URL).href : (window.SITE_URL ?? "") + e), Da =`;

function patchAdminBundle(source) {
  if (source.split(ADMIN_LINK_SOURCE).length - 1 !== 1) throw new Error('Pinned administrator link patch must match exactly once');
  return source.replace(ADMIN_LINK_SOURCE, ADMIN_LINK_PATCH);
}

function build() {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'question-ids.json'), 'utf8'));
  const ids = Array.isArray(manifest) ? manifest : manifest.ids;
  if (!ids?.length || new Set(ids).size !== ids.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new Error('Invalid question manifest');
  const admin = patchAdminBundle(fs.readFileSync(require.resolve('@waline/admin'), 'utf8'));
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public/admin.js'), admin);
  fs.copyFileSync(path.join(root, 'LICENSE.waline'), path.join(root, 'public/LICENSE.waline.txt'));
  console.log(`Prepared pinned administrator UI and ${ids.length} legal question IDs.`);
}

if (require.main === module) build();
module.exports = { patchAdminBundle };
