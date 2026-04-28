"""Audit-log CSV export — `/api/cp/audit/export.csv`.

Streams the full chain in `sequence_n` order as RFC-4180 CSV. Used by
the dashboard's audit page export button so reviewers can take the
chain offline (e.g. for regulator submission). The HTTP body is a
streaming response so multi-million-row chains don't materialise in
memory.
"""

from __future__ import annotations

import csv
import io
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.db import get_session
from aegis_control_plane.orm import AuditLogRow

router = APIRouter(prefix="/api/cp/audit", tags=["audit-export"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

CSV_HEADER: tuple[str, ...] = (
    "sequence_n",
    "ts",
    "actor",
    "action",
    "payload",
    "prev_hash",
    "row_hash",
    "signature",
)


async def _stream(session: AsyncSession) -> AsyncIterator[bytes]:
    """Yield UTF-8 bytes — one CSV header row, then one row per audit-log entry."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_HEADER)
    yield buf.getvalue().encode("utf-8")
    buf.seek(0)
    buf.truncate(0)

    stmt = select(AuditLogRow).order_by(AuditLogRow.sequence_n.asc())
    result = await session.stream(stmt)
    async for partition in result.partitions(500):
        for row in partition:
            r = row[0]
            writer.writerow(
                [
                    r.sequence_n,
                    r.ts.isoformat(),
                    r.actor,
                    r.action,
                    # csv.writer handles newlines inside fields by quoting them.
                    str(r.payload),
                    r.prev_hash,
                    r.row_hash,
                    r.signature,
                ]
            )
        yield buf.getvalue().encode("utf-8")
        buf.seek(0)
        buf.truncate(0)


@router.get("/export.csv")
async def export_csv(session: SessionDep) -> StreamingResponse:
    """Stream the full audit log as CSV. Empty chain → header row only."""
    return StreamingResponse(
        _stream(session),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=aegis-audit-chain.csv"},
    )
