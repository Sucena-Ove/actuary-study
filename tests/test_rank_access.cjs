'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../source-data/vault.js'), 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const b64 = value => Buffer.from(value).toString('base64');
const hkdf = (key, salt, info) => Buffer.from(crypto.hkdfSync('sha256', key, salt, info, 32));
function sealed(key, iv, text, aad) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  return Buffer.concat([cipher.update(text), cipher.final(), cipher.getAuthTag()]);
}
function fixture() {
  const codes = ['SA' + 'A'.repeat(32), 'SA' + 'B'.repeat(32)]; // Synthetic, never production credentials.
  const key = crypto.randomBytes(32), salt = crypto.randomBytes(32), bankId = 'local-proof-test';
  const payloadIv = crypto.randomBytes(12);
  const bank = { id: bankId, questions: [], sources: [] };
  const manifest = {
    version: 1, algorithm: 'AES-256-GCM+HKDF-SHA-256', bankId, salt: b64(salt),
    keySlots: codes.map(code => {
      const iv = crypto.randomBytes(12);
      return {id: hash('lookup:' + code), iv: b64(iv), wrappedKey: b64(sealed(
        hkdf(code, salt, bankId + ':code-wrap:v1'), iv, key, bankId + '|key|1'))};
    }),
    payload: {iv: b64(payloadIv), data: b64(sealed(key, payloadIv, JSON.stringify(bank), bankId + '|payload|1'))}
  };
  const context = { crypto: crypto.webcrypto, TextEncoder, TextDecoder, atob,
    fetch: async () => ({ok: true, text: async () => JSON.stringify(manifest)}) };
  vm.runInNewContext(source, context);
  return { context, vault: context.StudyVault, codes, manifest,
    expected: hkdf(key, salt, bankId + ':question-rank-access:v1').toString('hex'), contentKey: key.toString('hex') };
}

test('only authenticated decryption yields a separate rank credential; lock clears it', async () => {
  const f = fixture();
  assert.equal(f.vault.getRankProof(), '');
  const bank = await f.vault.unlock(f.codes[0]);
  assert.equal(bank.id, f.manifest.bankId);
  assert.equal(f.vault.getRankProof(), f.expected);
  assert.notEqual(f.expected, f.contentKey);
  assert.notEqual(f.expected, hash('lookup:' + f.codes[0]));
  assert.notEqual(f.expected, hash(f.expected)); // Server stores only this second hash.
  assert.ok(!JSON.stringify(f.manifest).includes(f.expected));
  await f.vault.unlock(f.codes[1]);
  assert.equal(f.vault.getRankProof(), f.expected);
  f.vault.lock();
  assert.equal(f.vault.getRankProof(), '');
});

test('invalid key and tampered payload cannot retain or grant ranking access', async () => {
  const f = fixture();
  await f.vault.unlock(f.codes[0]);
  await assert.rejects(f.vault.unlock('SA' + 'C'.repeat(32)));
  assert.equal(f.vault.getRankProof(), '');
  const bytes = Buffer.from(f.manifest.payload.data, 'base64'); bytes[0] ^= 1;
  f.manifest.payload.data = b64(bytes);
  await assert.rejects(f.vault.unlock(f.codes[0]));
  assert.equal(f.vault.getRankProof(), '');
});

test('locking during an outstanding unlock cannot restore the ranking credential', async () => {
  const f = fixture(); let release;
  f.context.fetch = () => new Promise(resolve => { release = resolve; });
  const pending = f.vault.unlock(f.codes[0]);
  f.vault.lock();
  release({ok: true, text: async () => JSON.stringify(f.manifest)});
  await assert.rejects(pending);
  assert.equal(f.vault.getRankProof(), '');
});
