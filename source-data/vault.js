/* Public decryptor. Codes and plaintext questions are never stored in this file. */
(function () {
  'use strict';
  const utf8 = new TextEncoder();
  const from64 = value => {
    if (typeof value !== 'string' || value.length > 8000000) throw new Error('加密文件格式不正确。');
    return Uint8Array.from(atob(value), c => c.charCodeAt(0));
  };
  const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
  async function unlock(input) {
    if (!globalThis.crypto || !crypto.subtle) throw new Error('请通过 HTTPS 网站或本机预览地址打开，并使用较新的浏览器。');
    const code = String(input || '').toUpperCase().replace(/[\s-]/g, '');
    if (!/^SA[A-Z2-7]{32}$/.test(code)) throw new Error('密钥格式不正确，请完整粘贴作者提供的密钥。');
    let manifest;
    try {
      const response = await fetch('vault.json', {cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer'});
      if (!response.ok) throw new Error();
      const text = await response.text();
      if (text.length > 8000000) throw new Error();
      manifest = JSON.parse(text);
    } catch (_) { throw new Error('进阶题库暂时未能加载，请检查网络后重试。'); }
    if (manifest.version !== 1 || manifest.algorithm !== 'AES-256-GCM+HKDF-SHA-256' ||
        !/^[A-Za-z0-9_-]{1,80}$/.test(manifest.bankId) || !Array.isArray(manifest.keySlots) ||
        manifest.keySlots.length > 500 || !manifest.payload) throw new Error('加密题库版本不受支持。');
    let rawKey, plaintext;
    try {
      const id = hex(await crypto.subtle.digest('SHA-256', utf8.encode('lookup:' + code)));
      const slot = manifest.keySlots.find(item => item.id === id);
      if (!slot) throw new Error();
      const salt = from64(manifest.salt), iv = from64(slot.iv), payloadIv = from64(manifest.payload.iv);
      if (salt.length !== 32 || iv.length !== 12 || payloadIv.length !== 12) throw new Error();
      const material = await crypto.subtle.importKey('raw', utf8.encode(code), 'HKDF', false, ['deriveKey']);
      const wrappingKey = await crypto.subtle.deriveKey({name: 'HKDF', hash: 'SHA-256', salt,
        info: utf8.encode(manifest.bankId + ':code-wrap:v1')}, material,
        {name: 'AES-GCM', length: 256}, false, ['decrypt']);
      rawKey = new Uint8Array(await crypto.subtle.decrypt({name: 'AES-GCM', iv,
        additionalData: utf8.encode(manifest.bankId + '|key|1'), tagLength: 128}, wrappingKey, from64(slot.wrappedKey)));
      if (rawKey.length !== 32) throw new Error();
      const contentKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
      rawKey.fill(0);
      plaintext = new Uint8Array(await crypto.subtle.decrypt({name: 'AES-GCM', iv: payloadIv,
        additionalData: utf8.encode(manifest.bankId + '|payload|1'), tagLength: 128}, contentKey, from64(manifest.payload.data)));
      const bank = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(plaintext));
      if (bank.id !== manifest.bankId || !Array.isArray(bank.questions) || !Array.isArray(bank.sources)) throw new Error();
      return bank;
    } catch (_) { throw new Error('无法解锁，请核对密钥；也可能是题库文件已损坏。'); }
    finally { if (rawKey) rawKey.fill(0); if (plaintext) plaintext.fill(0); }
  }
  globalThis.StudyVault = Object.freeze({unlock, lock: function () {}});
}());
