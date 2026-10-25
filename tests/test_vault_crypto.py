import importlib.util
import json
from pathlib import Path

import pytest
from cryptography.exceptions import InvalidTag

spec = importlib.util.spec_from_file_location('build_vault', Path(__file__).parents[1] / 'tools' / 'build_vault.py')
vault = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vault)


def test_all_fifty_random_codes_decrypt_and_are_not_in_public_file():
    bank = {'id': 'test-private-bank', 'questions': [{'stem': 'PRIVATE SENTINEL 314159'}], 'sources': []}
    codes = [vault.new_code() for _ in range(50)]
    sealed = vault.encrypt_bank(bank, codes)
    public = json.dumps(sealed)
    assert len(set(codes)) == 50
    assert 'PRIVATE SENTINEL' not in public
    for code in codes:
        assert code not in public and vault.normalize(code) not in public
        assert vault.decrypt_bank(sealed, code) == bank
    with pytest.raises(StopIteration):
        vault.decrypt_bank(sealed, vault.new_code())


@pytest.mark.parametrize('field', ['payload', 'wrapped', 'bank_id'])
def test_tampering_cannot_decrypt(field):
    code = vault.new_code()
    sealed = vault.encrypt_bank({'id': 'test', 'questions': [], 'sources': []}, [code])
    if field == 'bank_id':
        sealed['bankId'] = 'different'
    else:
        obj, key = (sealed['payload'], 'data') if field == 'payload' else (sealed['keySlots'][0], 'wrappedKey')
        value = bytearray(vault.base64.b64decode(obj[key]))
        value[0] ^= 1
        obj[key] = vault.encode(bytes(value))
    with pytest.raises(InvalidTag):
        vault.decrypt_bank(sealed, code)


def test_existing_issued_codes_are_reused_not_overwritten(tmp_path):
    path = tmp_path / 'codes.csv'
    first = vault.load_or_create_codes(path, 50)
    original = path.read_bytes()
    assert vault.load_or_create_codes(path, 50) == first
    with pytest.raises(ValueError):
        vault.load_or_create_codes(path, 49)
    assert path.read_bytes() == original


def test_plaintext_codes_cannot_be_written_into_repository():
    with pytest.raises(ValueError):
        vault.load_or_create_codes(vault.REPO / 'never-created.csv', 50)
