"""Control-plane audit-log writer.

This is the *single* writer of the Merkle-chained `audit_log` table. Other
services emit events; the control plane validates them and appends rows
here. The chain construction reuses the primitives from
`aegis_shared.audit` so the verification logic is the same on both sides
of the boundary.

Concurrency. The writer is intentionally **not** thread-safe at the row
level — the caller (a router handler) holds an `AsyncSession`, and the
sequence comes from a Postgres SEQUENCE that the DB serializes per
INSERT. Tests build rows in-memory and verify the chain; production
runtime appends them via `AsyncSession.execute`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Final

from aegis_shared.audit import (
    GENESIS_PREV_HASH,
    AuditRow,
    canonicalize_payload,
    compute_row_hash,
    sign_row,
)

ACTOR_SYSTEM_PREFIX: Final[str] = "system:"
"""Actors that originate from automated system steps must use this prefix."""


@dataclass(frozen=True)
class ChainState:
    """The chain's tail position — sequence number and last row hash."""

    next_sequence: int
    last_row_hash: str

    @classmethod
    def genesis(cls) -> ChainState:
        """Initial state for an empty chain."""
        return cls(next_sequence=1, last_row_hash=GENESIS_PREV_HASH)

    def advance(self, *, last_row_hash: str) -> ChainState:
        """Return the chain state after appending one row."""
        return ChainState(next_sequence=self.next_sequence + 1, last_row_hash=last_row_hash)


class AuditWriter:
    """Builds Merkle-chained audit rows. Stateless — caller threads `ChainState`."""

    def __init__(self, *, secret: str) -> None:
        if not secret:
            msg = "AuditWriter requires a non-empty HMAC secret"
            raise ValueError(msg)
        self._secret = secret

    def build_row(
        self,
        *,
        state: ChainState,
        actor: str,
        action: str,
        payload: dict[str, Any],
        decision_id: str | None,
        ts: datetime | None = None,
    ) -> tuple[AuditRow, ChainState]:
        """Construct an `AuditRow` extending the chain. Returns (row, new_state).

        The new state must be passed to the next call. Use the row to
        write to the DB; the writer never touches the DB directly.
        """
        timestamp = ts or datetime.now(UTC)
        canonical = canonicalize_payload(payload)
        row_hash = compute_row_hash(
            prev_hash=state.last_row_hash,
            canonical_payload=canonical,
            ts=timestamp,
            actor=actor,
            action=action,
            sequence_n=state.next_sequence,
        )
        signature = sign_row(row_hash, self._secret)
        row = AuditRow(
            sequence_n=state.next_sequence,
            ts=timestamp,
            actor=actor,
            action=action,
            payload=payload,
            prev_hash=state.last_row_hash,
            row_hash=row_hash,
            signature=signature,
        )
        # `decision_id` is part of the persisted ORM row but not the hashed
        # content — it's a foreign-key index, not part of the cryptographic
        # commitment. Keeping it out of the hash means a row stays valid if
        # we ever migrate the FK reference target.
        _ = decision_id
        return row, state.advance(last_row_hash=row_hash)
