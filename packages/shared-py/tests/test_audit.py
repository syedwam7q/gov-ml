"""Tests for the Merkle-chained audit-log primitives."""

from datetime import UTC, datetime, timedelta

import pytest

from aegis_shared.audit import (
    GENESIS_PREV_HASH,
    AuditRow,
    canonicalize_payload,
    compute_row_hash,
    sign_row,
    verify_chain,
    verify_signature,
)

_BASE_TS = datetime(2026, 4, 28, 12, 0, 0, tzinfo=UTC)


def _ts(seconds: int) -> datetime:
    return _BASE_TS + timedelta(seconds=seconds)


def _row(
    seq: int,
    *,
    prev_hash: str,
    secret: str = "test-secret",
    payload: dict[str, object] | None = None,
) -> AuditRow:
    p = payload or {"action": "test", "value": seq}
    canon = canonicalize_payload(p)
    ts = _ts(seq)
    h = compute_row_hash(
        prev_hash=prev_hash,
        canonical_payload=canon,
        ts=ts,
        actor="system:test",
        action="test",
        sequence_n=seq,
    )
    sig = sign_row(h, secret)
    return AuditRow(
        sequence_n=seq,
        ts=ts,
        actor="system:test",
        action="test",
        payload=p,
        prev_hash=prev_hash,
        row_hash=h,
        signature=sig,
    )


class TestCanonicalization:
    def test_canonical_form_is_deterministic(self) -> None:
        a = canonicalize_payload({"b": 1, "a": 2})
        b = canonicalize_payload({"a": 2, "b": 1})
        assert a == b

    def test_canonical_form_is_compact(self) -> None:
        c = canonicalize_payload({"a": 1, "b": [1, 2]})
        assert " " not in c


class TestRowHash:
    def test_genesis_prev_hash_is_64_zeros(self) -> None:
        assert GENESIS_PREV_HASH == "0" * 64

    def test_row_hash_is_64_hex_chars(self) -> None:
        h = compute_row_hash(
            prev_hash=GENESIS_PREV_HASH,
            canonical_payload='{"x":1}',
            ts=_ts(0),
            actor="system:test",
            action="genesis",
            sequence_n=1,
        )
        assert len(h) == 64
        assert all(ch in "0123456789abcdef" for ch in h)

    def test_row_hash_changes_with_any_field(self) -> None:
        base = {
            "prev_hash": GENESIS_PREV_HASH,
            "canonical_payload": '{"x":1}',
            "ts": _ts(0),
            "actor": "system:test",
            "action": "t",
            "sequence_n": 1,
        }
        h0 = compute_row_hash(**base)
        h1 = compute_row_hash(**{**base, "actor": "system:other"})
        h2 = compute_row_hash(**{**base, "action": "u"})
        h3 = compute_row_hash(**{**base, "sequence_n": 2})
        h4 = compute_row_hash(**{**base, "canonical_payload": '{"x":2}'})
        h5 = compute_row_hash(**{**base, "ts": _ts(1)})
        assert len({h0, h1, h2, h3, h4, h5}) == 6


class TestSignature:
    def test_sign_and_verify(self) -> None:
        sig = sign_row("a" * 64, "secret")
        assert verify_signature("a" * 64, sig, "secret") is True

    def test_verify_rejects_wrong_secret(self) -> None:
        sig = sign_row("a" * 64, "secret")
        assert verify_signature("a" * 64, sig, "other-secret") is False

    def test_verify_rejects_tampered_hash(self) -> None:
        sig = sign_row("a" * 64, "secret")
        assert verify_signature("b" * 64, sig, "secret") is False


class TestVerifyChain:
    def test_empty_chain_verifies(self) -> None:
        assert verify_chain([], secret="s") is True

    def test_single_row_chain_verifies(self) -> None:
        rows = [_row(1, prev_hash=GENESIS_PREV_HASH)]
        assert verify_chain(rows, secret="test-secret") is True

    def test_three_row_chain_verifies(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        r2 = _row(2, prev_hash=r1.row_hash)
        r3 = _row(3, prev_hash=r2.row_hash)
        assert verify_chain([r1, r2, r3], secret="test-secret") is True

    def test_broken_chain_rejected(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        r2 = _row(2, prev_hash=GENESIS_PREV_HASH)
        assert verify_chain([r1, r2], secret="test-secret") is False

    def test_payload_tampering_rejected(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        r2 = _row(2, prev_hash=r1.row_hash)
        tampered = r2.model_copy(update={"payload": {"action": "EVIL"}})
        assert verify_chain([r1, tampered], secret="test-secret") is False

    def test_signature_tampering_rejected(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        bad = r1.model_copy(update={"signature": "deadbeef" * 8})
        assert verify_chain([bad], secret="test-secret") is False

    def test_wrong_starting_prev_hash_rejected(self) -> None:
        r1 = _row(1, prev_hash="f" * 64)
        assert verify_chain([r1], secret="test-secret") is False

    def test_non_sequential_sequence_n_rejected(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        r2 = _row(3, prev_hash=r1.row_hash)
        assert verify_chain([r1, r2], secret="test-secret") is False


@pytest.mark.parametrize("n", [10, 100])
def test_long_chains_verify(n: int) -> None:
    rows: list[AuditRow] = []
    prev = GENESIS_PREV_HASH
    for i in range(1, n + 1):
        r = _row(i, prev_hash=prev)
        rows.append(r)
        prev = r.row_hash
    assert verify_chain(rows, secret="test-secret") is True
