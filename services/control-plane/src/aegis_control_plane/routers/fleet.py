"""Fleet KPI rollup — `/api/cp/fleet/kpi`.

Composes two Tinybird pipe queries into the dashboard's UI-shaped
`ModelKPI[]` response:

  - `fleet_kpi` — one row per model with the headline rollup
    (predictions, latency, error rate, headline metric, severity, open incidents).
  - `kpi_sparkline` — many rows partitioned by `(model_id, kind)` where
    `kind` ∈ {predictions, latency, errors, headline}.

The router is the source of truth for the response shape — the dashboard
contract lives in `apps/dashboard/app/_lib/types.ts::ModelKPI`. Spec §10.1.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status

from aegis_control_plane.config import get_settings
from aegis_shared.tinybird_client import TinybirdClient

router = APIRouter(prefix="/api/cp/fleet", tags=["fleet"])

Window = Literal["24h", "7d", "30d"]

# Per-model headline KPI shape — the dashboard reads it as
# `ModelKPI.headline_metric` (key, value, floor, status, trend).
SparklineKind = Literal["predictions", "latency", "errors", "headline"]


def _kpi_point(row: dict[str, Any]) -> dict[str, Any]:
    """Project a sparkline row into the dashboard's `KPIPoint` shape."""
    return {"t": row["t"], "v": float(row["v"])}


def _build_response(
    rollup: list[dict[str, Any]], sparkline: list[dict[str, Any]], window: str
) -> list[dict[str, Any]]:
    """Compose two pipe outputs into `ModelKPI[]` exactly as the dashboard expects."""
    # Group sparkline rows by (model_id, kind).
    spark_index: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in sparkline:
        key = (row["model_id"], row["kind"])
        spark_index[key].append(_kpi_point(row))

    out: list[dict[str, Any]] = []
    for r in rollup:
        model_id = r["model_id"]
        out.append(
            {
                "model_id": model_id,
                "window": window,
                "predictions_total": int(r["predictions_total"]),
                "predictions_trend": spark_index.get((model_id, "predictions"), []),
                "p50_latency_ms": float(r["p50_latency_ms"]),
                "p95_latency_ms": float(r["p95_latency_ms"]),
                "latency_trend": spark_index.get((model_id, "latency"), []),
                "error_rate": float(r["error_rate"]),
                "error_trend": spark_index.get((model_id, "errors"), []),
                "headline_metric": {
                    "key": r["headline_metric_key"],
                    "value": float(r["headline_metric_value"]),
                    "floor": float(r["headline_metric_floor"]),
                    "trend": spark_index.get((model_id, "headline"), []),
                    "status": r["headline_metric_status"],
                },
                "severity": r["severity"],
                "open_incidents": int(r["open_incidents"]),
            }
        )
    return out


def _client_or_503() -> TinybirdClient:
    """Build a client or raise 503 if the deployment isn't configured for Tinybird."""
    settings = get_settings()
    if not settings.tinybird_token:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TINYBIRD_TOKEN not configured; KPI endpoints unavailable.",
        )
    return TinybirdClient(token=settings.tinybird_token, base_url=settings.tinybird_host)


@router.get("/kpi")
async def list_fleet_kpi(window: Annotated[Window, Query()] = "24h") -> list[dict[str, Any]]:
    """One `ModelKPI` per registered model over the requested window."""
    async with _client_or_503() as tb:
        rollup = await tb.query_endpoint("fleet_kpi", params={"window": window})
        sparkline = await tb.query_endpoint("kpi_sparkline", params={"window": window})
    return _build_response(rollup, sparkline, window)
