"""Merkle-chained audit-log primitives.

The audit log is the immutable, ordered ledger of every governance event.
Each row's hash is computed from its content + the previous row's hash,
making the chain tamper-evident. Each row is also HMAC-signed with the
server's secret for non-repudiation within the platform's trust boundary.

Invariants enforced here (and tested):
  1. Chain starts from GENESIS_PREV_HASH (64 hex zeros).
  2. row_hash = SHA256(prev_hash || canonical_payload || ts_iso || actor || action || sequence_n).
  3. signature = HMAC-SHA256(row_hash, secret).
  4. Sequence numbers are strictly increasing by 1.
  5. Each row's prev_hash equals the previous row's row_hash.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime
from typing import Any, Final

from pydantic import BaseModel, ConfigDict, Field

GENESIS_PREV_HASH: Final[str] = "0" * 64
"""The prev_hash for the very first audit row in a freshly-initialized chain."""


class AuditRow(BaseModel):
    """One row in the immutable, Merkle-chained audit log."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    sequence_n: int = Field(ge=1)
    ts: datetime
    actor: str = Field(min_length=1)
    action: str = Field(min_length=1)
    payload: dict[str, Any]
    prev_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    row_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    signature: str = Field(pattern=r"^[0-9a-f]{64}$")


def canonicalize_payload(payload: dict[str, Any]) -> str:
    """Deterministic JSON encoding: sorted keys, no whitespace, no NaN/Inf."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)


def compute_row_hash(
    *,
    prev_hash: str,
    canonical_payload: str,
    ts: datetime,
    actor: str,
    action: str,
    sequence_n: int,
) -> str:
    """SHA-256 hash of the row's content concatenated with the previous row's hash."""
    h = hashlib.sha256()
    h.update(prev_hash.encode("ascii"))
    h.update(b"\x00")
    h.update(canonical_payload.encode("utf-8"))
    h.update(b"\x00")
    h.update(ts.isoformat().encode("ascii"))
    h.update(b"\x00")
    h.update(actor.encode("utf-8"))
    h.update(b"\x00")
    h.update(action.encode("utf-8"))
    h.update(b"\x00")
    h.update(str(sequence_n).encode("ascii"))
    return h.hexdigest()


def sign_row(row_hash: str, secret: str) -> str:
    """HMAC-SHA256 signature of the row hash, hex-encoded."""
    return hmac.new(secret.encode("utf-8"), row_hash.encode("ascii"), hashlib.sha256).hexdigest()


def verify_signature(row_hash: str, signature: str, secret: str) -> bool:
    """Constant-time check that the signature matches HMAC(row_hash, secret)."""
    expected = sign_row(row_hash, secret)
    return hmac.compare_digest(expected, signature)


def verify_chain(rows: list[AuditRow], *, secret: str) -> bool:
    """Verify a chain end-to-end: order, prev_hash links, recomputed row_hashes, signatures."""
    if not rows:
        return True

    expected_seq = rows[0].sequence_n
    if expected_seq < 1:
        return False
    if expected_seq == 1 and rows[0].prev_hash != GENESIS_PREV_HASH:
        return False

    prev_hash = rows[0].prev_hash if expected_seq > 1 else GENESIS_PREV_HASH

    for row in rows:
        if row.sequence_n != expected_seq:
            return False
        if row.prev_hash != prev_hash:
            return False

        recomputed = compute_row_hash(
            prev_hash=row.prev_hash,
            canonical_payload=canonicalize_payload(row.payload),
            ts=row.ts,
            actor=row.actor,
            action=row.action,
            sequence_n=row.sequence_n,
        )
        if recomputed != row.row_hash:
            return False
        if not verify_signature(row.row_hash, row.signature, secret):
            return False

        prev_hash = row.row_hash
        expected_seq += 1

    return True
