"""Persist Merkle-chained audit rows alongside their domain rows.

Wraps `aegis_control_plane.audit.AuditWriter` with the DB-side state
management: read the chain head from `audit_log`, build the next row
using the writer, INSERT it. Single-writer discipline is enforced because
this module is the only thing in the codebase that calls `INSERT INTO
audit_log`.

All writes happen inside the caller's `AsyncSession` so a domain INSERT
(e.g. opening a `governance_decisions` row) and the corresponding audit
row commit atomically.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.audit import AuditWriter, ChainState
from aegis_control_plane.config import get_settings
from aegis_control_plane.orm import AuditLogRow


async def _read_chain_state(session: AsyncSession) -> ChainState:
    """Look up the chain's tail. New chains start at the genesis state."""
    stmt = select(AuditLogRow).order_by(AuditLogRow.sequence_n.desc()).limit(1)
    last = (await session.execute(stmt)).scalar_one_or_none()
    if last is None:
        return ChainState.genesis()
    return ChainState(next_sequence=last.sequence_n + 1, last_row_hash=last.row_hash)


async def append_audit_row(
    session: AsyncSession,
    *,
    actor: str,
    action: str,
    payload: dict[str, Any],
    decision_id: str | None,
    ts: datetime | None = None,
) -> AuditLogRow:
    """Append one row to the audit log, returning the persisted ORM row.

    The caller is expected to commit the surrounding transaction. The
    audit-log INSERT and the decision-state INSERT thus land atomically.
    """
    secret = get_settings().audit_log_hmac_secret
    if not secret:
        msg = (
            "AUDIT_LOG_HMAC_SECRET is not configured; refusing to append "
            "audit rows without a signature."
        )
        raise RuntimeError(msg)

    state = await _read_chain_state(session)
    writer = AuditWriter(secret=secret)
    audit_row, _new_state = writer.build_row(
        state=state,
        actor=actor,
        action=action,
        payload=payload,
        decision_id=decision_id,
        ts=ts or datetime.now(UTC),
    )
    orm_row = AuditLogRow(
        sequence_n=audit_row.sequence_n,
        decision_id=decision_id,
        ts=audit_row.ts,
        actor=audit_row.actor,
        action=audit_row.action,
        payload=audit_row.payload,
        prev_hash=audit_row.prev_hash,
        row_hash=audit_row.row_hash,
        signature=audit_row.signature,
    )
    session.add(orm_row)
    await session.flush()  # populate id-side defaults; commit happens upstream
    return orm_row
