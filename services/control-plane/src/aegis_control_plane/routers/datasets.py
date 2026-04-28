"""Dataset registry endpoint — `/api/cp/datasets`.

Reads the seeded `datasets` table and projects each row into the
dashboard's UI-shaped `Dataset` JSON. The shape mirrors
`apps/dashboard/app/_lib/types.ts::Dataset` exactly so the dashboard
can consume the response with no client-side transform.

Spec §10.1 (dataset detail page) and Appendix A (the three real-world
corpora seeded by `aegis_control_plane.seed.seed_datasets()`).
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.db import get_session
from aegis_control_plane.orm import DatasetRow

router = APIRouter(prefix="/api/cp/datasets", tags=["datasets"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _row_to_dataset(row: DatasetRow) -> dict[str, Any]:
    """Project a `DatasetRow` into the dashboard's `Dataset` JSON shape."""
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "source": row.source,
        "source_url": row.source_url,
        "created_at": row.created_at.isoformat(),
        "row_count": row.row_count,
        "snapshot_id": row.snapshot_id,
        "model_ids": list(row.model_ids),
        "datasheet": row.datasheet,
        "snapshots": row.snapshots,
        "schema": row.schema_overview,  # rename: db column is schema_overview
    }


@router.get("")
async def list_datasets(session: SessionDep) -> list[dict[str, Any]]:
    """List every registered dataset, sorted by id (stable ordering)."""
    rows = (await session.execute(select(DatasetRow).order_by(DatasetRow.id))).scalars().all()
    return [_row_to_dataset(r) for r in rows]
