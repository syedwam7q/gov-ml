"""Per-model KPI rollup — `/api/cp/models/{model_id}/kpi`.

Same shape as `/api/cp/fleet/kpi` but for a single model. Returns 404
when Tinybird has no rollup row for the requested model (typically the
first 5 minutes after registration, before any predictions land).
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status

from aegis_control_plane.routers.fleet import build_response_payload, tinybird_client_or_503

router = APIRouter(prefix="/api/cp/models", tags=["kpi"])

Window = Literal["24h", "7d", "30d"]


@router.get("/{model_id}/kpi")
async def get_model_kpi(
    model_id: str,
    window: Annotated[Window, Query()] = "24h",
) -> dict[str, Any]:
    """One `ModelKPI` for the requested model + window."""
    async with tinybird_client_or_503() as tb:
        rollup = await tb.query_endpoint(
            "model_kpi", params={"model_id": model_id, "window": window}
        )
        sparkline = await tb.query_endpoint(
            "kpi_sparkline", params={"model_id": model_id, "window": window}
        )
    composed = build_response_payload(rollup, sparkline, window)
    if not composed:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=f"no KPI rollup for model_id={model_id!r}",
        )
    return composed[0]
