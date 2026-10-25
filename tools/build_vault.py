"""Encrypt a separately authored bank. Plain bank and 160-bit codes stay outside this repository.

Install cryptography locally to use this tool; normal site builds need only Python's stdlib.
The same CSV can rebuild the vault without changing readers' existing codes.
"""
from __future__ import annotations
import argparse
import base64
import csv
import hashlib
import json
import os
import re
import secrets
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

REPO = Path(__file__).resolve().parents[1]


def normalize(code):
    value = re.sub(r"[\s-]", "", code.upper())
    if not re.fullmatch(r"SA[A-Z2-7]{32}", value):
        raise ValueError("Invalid code format")
    return value


def new_code():
    chars = base64.b32encode(secrets.token_bytes(20)).decode("ascii")
    return "SA-" + "-".join(chars[i:i + 8] for i in range(0, 32, 8))


def code_id(code):
    return hashlib.sha256(("lookup:" + normalize(code)).encode()).hexdigest()


def wrapping_key(code, salt, bank_id):
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=salt,
                info=(bank_id + ":code-wrap:v1").encode()).derive(normalize(code).encode())


def encode(raw):
    return base64.b64encode(raw).decode("ascii")


def encrypt_bank(bank, codes):
    bank_id = bank["id"]
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", bank_id):
        raise ValueError("Invalid bank id")
    normalized = [normalize(c) for c in codes]
    if not normalized or len(set(normalized)) != len(normalized):
        raise ValueError("Codes must be nonempty and unique")
    content_key = AESGCM.generate_key(bit_length=256)
    salt = secrets.token_bytes(32)
    iv = secrets.token_bytes(12)
    plaintext = json.dumps(bank, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    payload = AESGCM(content_key).encrypt(iv, plaintext, (bank_id + "|payload|1").encode())
    slots = []
    for code in normalized:
        slot_iv = secrets.token_bytes(12)
        wrapped = AESGCM(wrapping_key(code, salt, bank_id)).encrypt(
            slot_iv, content_key, (bank_id + "|key|1").encode())
        slots.append({"id": code_id(code), "iv": encode(slot_iv), "wrappedKey": encode(wrapped)})
    return {"version": 1, "bankId": bank_id, "algorithm": "AES-256-GCM+HKDF-SHA-256",
            "salt": encode(salt), "keySlots": slots,
            "payload": {"iv": encode(iv), "data": encode(payload)}}


def decrypt_bank(manifest, code):
    bank_id = manifest["bankId"]
    slot = next(s for s in manifest["keySlots"] if s["id"] == code_id(code))
    key = AESGCM(wrapping_key(code, base64.b64decode(manifest["salt"]), bank_id)).decrypt(
        base64.b64decode(slot["iv"]), base64.b64decode(slot["wrappedKey"]),
        (bank_id + "|key|1").encode())
    plaintext = AESGCM(key).decrypt(base64.b64decode(manifest["payload"]["iv"]),
        base64.b64decode(manifest["payload"]["data"]), (bank_id + "|payload|1").encode())
    return json.loads(plaintext)


def load_or_create_codes(path, count):
    path = path.resolve()
    if path.is_relative_to(REPO):
        raise ValueError("Codes CSV must be outside the public repository")
    if path.exists():
        with path.open(encoding="utf-8-sig", newline="") as handle:
            codes = [row["code"] for row in csv.DictReader(handle)]
        if len(codes) != count or len({normalize(c) for c in codes}) != count:
            raise ValueError("Existing code count/uniqueness differs; no codes replaced")
        return codes
    path.parent.mkdir(parents=True, exist_ok=True)
    codes = [new_code() for _ in range(count)]
    # Exclusive creation: never overwrite a previously issued list.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["number", "code", "recipient", "issued_at", "notes"])
        for index, code in enumerate(codes, 1):
            writer.writerow([index, code, "", "", ""])
    return codes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bank", type=Path, required=True)
    parser.add_argument("--codes", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--count", type=int, default=50)
    args = parser.parse_args()
    if not 1 <= args.count <= 500:
        parser.error("Count must be 1..500")
    if args.bank.resolve().is_relative_to(REPO):
        parser.error("Plaintext bank must be outside the public repository")
    bank = json.loads(args.bank.read_text(encoding="utf-8"))
    codes = load_or_create_codes(args.codes, args.count)
    manifest = encrypt_bank(bank, codes)
    # Verify every issued code without exposing any code or question in output.
    assert all(decrypt_bank(manifest, code) == bank for code in codes)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"codeCount": len(codes), "questionCount": len(bank["questions"]),
                      "encryptedFile": str(args.output), "allCodesVerified": True}, ensure_ascii=False))


if __name__ == "__main__":
    main()
