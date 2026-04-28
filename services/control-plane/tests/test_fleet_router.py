"""Tests for `/api/cp/fleet/kpi` — the fleet-wide KPI rollup.

Patches `TinybirdClient.query_endpoint` so the test runs without network
access and without a Tinybird token. The router must compose two pipe
queries (rollup + sparkline) into one `ModelKPI[]` response shape that
matches the dashboard's contract in `apps/dashboard/app/_lib/types.ts`.
"""

from __future__ import annotations

from typing import Any

import pytest
from aegis_control_plane.app import build_app
from fastapi.testclient import TestClient

from aegis_shared.tinybird_client import TinybirdClient


# Composite fixture: monkeypatched two-pipe response. Reused by tests.
@pytest.fixture
def fake_tinybird_fleet(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[dict[str, Any]]]:
    pipes: dict[str, list[dict[str, Any]]] = {
        "fleet_kpi": [
            {
                "model_id": "credit-v1",
                "predictions_total": 124_330,
                "predictions_trend_total": 124_330,
                "p50_latency_ms": 41.0,
                "p95_latency_ms": 88.0,
                "error_rate": 0.012,
                "headline_metric_key": "demographic_parity_gender",
                "headline_metric_value": 0.71,
                "headline_metric_floor": 0.80,
                "headline_metric_status": "danger",
                "severity": "HIGH",
                "open_incidents": 1,
            },
            {
                "model_id": "toxicity-v1",
                "predictions_total": 88_400,
                "predictions_trend_total": 88_400,
                "p50_latency_ms": 92.0,
                "p95_latency_ms": 142.0,
                "error_rate": 0.004,
                "headline_metric_key": "f1",
                "headline_metric_value": 0.94,
                "headline_metric_floor": 0.90,
                "headline_metric_status": "ok",
                "severity": "OK",
                "open_incidents": 0,
            },
        ],
        "kpi_sparkline": [
            {
                "model_id": "credit-v1",
                "kind": "predictions",
                "t": "2026-04-28T00:00:00Z",
                "v": 5_300.0,
            },
            {
                "model_id": "credit-v1",
                "kind": "predictions",
                "t": "2026-04-28T01:00:00Z",
                "v": 5_180.0,
            },
            {"model_id": "credit-v1", "kind": "latency", "t": "2026-04-28T00:00:00Z", "v": 86.0},
            {"model_id": "credit-v1", "kind": "headline", "t": "2026-04-28T00:00:00Z", "v": 0.94},
            {"model_id": "credit-v1", "kind": "headline", "t": "2026-04-28T01:00:00Z", "v": 0.71},
            {"model_id": "credit-v1", "kind": "errors", "t": "2026-04-28T00:00:00Z", "v": 0.011},
            {"model_id": "toxicity-v1", "kind": "headline", "t": "2026-04-28T00:00:00Z", "v": 0.94},
        ],
    }

    async def _query_endpoint(
        self: TinybirdClient,
        name: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        rows = pipes.get(name)
        if rows is None:
            raise AssertionError(f"unexpected pipe call: {name!r} (params={params})")
        return rows

    monkeypatch.setattr(TinybirdClient, "query_endpoint", _query_endpoint)
    monkeypatch.setenv("TINYBIRD_TOKEN", "test-token-do-not-use")
    # Reset cached settings so the env var takes effect.
    from aegis_control_plane.config import get_settings

    get_settings.cache_clear()
    return pipes


def test_fleet_kpi_returns_one_kpi_per_model(
    fake_tinybird_fleet: dict[str, list[dict[str, Any]]],
) -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/fleet/kpi?window=24h")
    assert res.status_code == 200, res.text
    body = res.json()
    assert isinstance(body, list)
    assert {row["model_id"] for row in body} == {"credit-v1", "toxicity-v1"}

    credit = next(r for r in body if r["model_id"] == "credit-v1")
    assert credit["window"] == "24h"
    assert credit["predictions_total"] == 124_330
    assert credit["p95_latency_ms"] == pytest.approx(88.0)
    assert credit["headline_metric"]["key"] == "demographic_parity_gender"
    assert credit["headline_metric"]["status"] == "danger"
    assert credit["severity"] == "HIGH"
    assert credit["open_incidents"] == 1

    # Sparklines partitioned by `kind` and projected as KPIPoint[].
    assert len(credit["predictions_trend"]) == 2
    assert credit["predictions_trend"][0]["t"].startswith("2026-04-28T00")
    assert len(credit["headline_metric"]["trend"]) == 2


def test_fleet_kpi_window_validated(
    fake_tinybird_fleet: dict[str, list[dict[str, Any]]],
) -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/fleet/kpi?window=banana")
    assert res.status_code == 422


def test_fleet_kpi_503_when_tinybird_token_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("TINYBIRD_TOKEN", raising=False)
    monkeypatch.setenv("TINYBIRD_TOKEN", "")
    from aegis_control_plane.config import get_settings

    get_settings.cache_clear()
    client = TestClient(build_app())
    res = client.get("/api/cp/fleet/kpi?window=24h")
    assert res.status_code == 503
    assert "TINYBIRD_TOKEN" in res.json()["detail"]
