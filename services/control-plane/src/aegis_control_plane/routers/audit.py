"""Read-only API for the audit log — `/api/v1/audit`.

The audit log is append-only at the DB level (RULEs in migration 0003).
This router only exposes reads; appends happen through the writer used by
state-transition handlers (Phase 3+).
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.config import get_settings
from aegis_control_plane.db import get_session
from aegis_control_plane.orm import AuditLogRow
from aegis_shared.audit import AuditRow, verify_chain

router = APIRouter(prefix="/api/cp/audit", tags=["audit"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class AuditPage(BaseModel):
    """One page of audit-log rows + pagination cursor."""

    model_config = ConfigDict(extra="forbid")

    rows: list[AuditRow]
    next_since_seq: int | None
    total: int


class VerifyResult(BaseModel):
    """Outcome of a chain-verification call."""

    model_config = ConfigDict(extra="forbid")

    valid: bool
    rows_checked: int
    head_row_hash: str | None


def _row_to_audit(row: AuditLogRow) -> AuditRow:
    return AuditRow(
        sequence_n=row.sequence_n,
        ts=row.ts,
        actor=row.actor,
        action=row.action,
        payload=row.payload,
        prev_hash=row.prev_hash,
        row_hash=row.row_hash,
        signature=row.signature,
    )


@router.get("", response_model=AuditPage)
async def list_audit(
    session: SessionDep,
    since_seq: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> AuditPage:
    """Paginated read of the audit log starting after `since_seq`."""
    stmt = (
        select(AuditLogRow)
        .where(AuditLogRow.sequence_n > since_seq)
        .order_by(AuditLogRow.sequence_n)
        .limit(limit)
    )
    rows = (await session.execute(stmt)).scalars().all()
    audit_rows = [_row_to_audit(r) for r in rows]
    total = (await session.execute(select(func.count()).select_from(AuditLogRow))).scalar_one()
    next_since = audit_rows[-1].sequence_n if len(audit_rows) == limit else None
    return AuditPage(rows=audit_rows, next_since_seq=next_since, total=int(total))


@router.post("/verify", response_model=VerifyResult, status_code=status.HTTP_200_OK)
async def verify(session: SessionDep) -> VerifyResult:
    """Run `verify_chain` over the live rows. Returns valid + head row hash.

    Used by the dashboard's "verify chain" button and by the daily
    chain-anchor GitHub Action.
    """
    secret = get_settings().audit_log_hmac_secret
    rows = (
        (await session.execute(select(AuditLogRow).order_by(AuditLogRow.sequence_n)))
        .scalars()
        .all()
    )
    audit_rows = [_row_to_audit(r) for r in rows]
    valid = verify_chain(audit_rows, secret=secret) if audit_rows else True
    head: str | None = audit_rows[-1].row_hash if audit_rows else None
    return VerifyResult(valid=valid, rows_checked=len(audit_rows), head_row_hash=head)


# Re-export the response models so OpenAPI and the dashboard can import them.
__all__ = ["AuditPage", "VerifyResult", "router"]
# Reference values to silence "unused" warnings when only the router is imported.
_ = (Any,)
