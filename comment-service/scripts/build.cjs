'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'question-ids.json'), 'utf8'));
const ids = Array.isArray(manifest) ? manifest : manifest.ids;
if (!ids?.length || new Set(ids).size !== ids.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new Error('Invalid question manifest');
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.copyFileSync(require.resolve('@waline/admin'), path.join(root, 'public/admin.js'));
fs.copyFileSync(path.join(root, 'LICENSE.waline'), path.join(root, 'public/LICENSE.waline.txt'));
console.log(`Prepared pinned administrator UI and ${ids.length} legal question IDs.`);
