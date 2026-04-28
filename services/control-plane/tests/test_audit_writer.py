"""Tests for the control-plane audit-log writer.

These are unit tests against the writer's internal state-machine + chain
construction. The full integration test against Postgres lives in
test_audit_router.py (Task 9).
"""

from __future__ import annotations

import pytest
from aegis_control_plane.audit import AuditWriter, ChainState

from aegis_shared.audit import GENESIS_PREV_HASH, verify_chain


def test_initial_chain_state_starts_at_genesis() -> None:
    state = ChainState.genesis()
    assert state.next_sequence == 1
    assert state.last_row_hash == GENESIS_PREV_HASH


def test_writer_appends_first_row_with_genesis_prev_hash(hmac_secret: str) -> None:
    writer = AuditWriter(secret=hmac_secret)
    state = ChainState.genesis()
    row, new_state = writer.build_row(
        state=state,
        actor="system:test",
        action="detect",
        payload={"signal": "DP_gender", "value": 0.71},
        decision_id=None,
    )
    assert row.sequence_n == 1
    assert row.prev_hash == GENESIS_PREV_HASH
    assert new_state.next_sequence == 2
    assert new_state.last_row_hash == row.row_hash


def test_writer_chains_consecutive_rows(hmac_secret: str) -> None:
    writer = AuditWriter(secret=hmac_secret)
    state = ChainState.genesis()
    rows = []
    for i in range(5):
        row, state = writer.build_row(
            state=state,
            actor="system:test",
            action="step",
            payload={"i": i},
            decision_id=None,
        )
        rows.append(row)
    assert verify_chain(rows, secret=hmac_secret) is True
    assert rows[1].prev_hash == rows[0].row_hash
    assert rows[2].prev_hash == rows[1].row_hash


def test_writer_signs_with_provided_secret(hmac_secret: str) -> None:
    writer = AuditWriter(secret=hmac_secret)
    row, _ = writer.build_row(
        state=ChainState.genesis(),
        actor="system:test",
        action="detect",
        payload={},
        decision_id=None,
    )
    # A row built with one secret must NOT verify against a different secret.
    other = "deadbeef" * 16
    assert verify_chain([row], secret=hmac_secret) is True
    assert verify_chain([row], secret=other) is False


def test_writer_rejects_empty_secret() -> None:
    with pytest.raises(ValueError, match="secret"):
        AuditWriter(secret="")


@pytest.mark.parametrize("n", [10, 100])
def test_writer_long_chains_verify(hmac_secret: str, n: int) -> None:
    writer = AuditWriter(secret=hmac_secret)
    state = ChainState.genesis()
    rows = []
    for i in range(n):
        row, state = writer.build_row(
            state=state,
            actor="system:test",
            action="step",
            payload={"i": i},
            decision_id=None,
        )
        rows.append(row)
    assert verify_chain(rows, secret=hmac_secret) is True
    assert state.next_sequence == n + 1
