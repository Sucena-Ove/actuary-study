"""Derive a public one-way verifier from an existing vault without replacing keys.

Raw codes, content keys and access proofs are only used in memory. The output is
SHA-256 of a purpose-specific 256-bit proof, never an accepted access credential.
"""
from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from build_vault import code_id, decrypt_bank, wrapping_key, REPO


def rank_verifier(manifest, code):
    bank_id = manifest['bankId']
    slot = next(s for s in manifest['keySlots'] if s['id'] == code_id(code))
    salt = base64.b64decode(manifest['salt'])
    content_key = AESGCM(wrapping_key(code, salt, bank_id)).decrypt(
        base64.b64decode(slot['iv']), base64.b64decode(slot['wrappedKey']),
        (bank_id + '|key|1').encode())
    proof = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt,
                 info=(bank_id + ':question-rank-access:v1').encode()).derive(content_key).hex()
    return hashlib.sha256(proof.encode('ascii')).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vault', type=Path, required=True)
    parser.add_argument('--codes', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.codes.resolve().is_relative_to(REPO):
        parser.error('Private code list must be outside the public repository')
    manifest = json.loads(args.vault.read_text(encoding='utf-8'))
    with args.codes.open(encoding='utf-8-sig', newline='') as handle:
        codes = [row['code'] for row in csv.DictReader(handle)]
    if not codes or len(codes) > 500:
        parser.error('Expected a nonempty issued code list with at most 500 entries')
    # Verify the existing authenticated payload before enabling its grant.
    decrypt_bank(manifest, codes[0])
    verifiers = {rank_verifier(manifest, code) for code in codes}
    if len(verifiers) != 1:
        raise ValueError('Issued codes do not share the same existing vault')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'version': 1, 'sha256': sorted(verifiers)}, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'issuedCodesVerified': len(codes), 'verifierCount': len(verifiers),
                      'vaultRebuilt': False, 'credentialsWritten': False}))


if __name__ == '__main__':
    main()
