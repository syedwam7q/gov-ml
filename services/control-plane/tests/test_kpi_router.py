"""Tests for `/api/cp/models/{model_id}/kpi`."""

from __future__ import annotations

from typing import Any

import pytest
from aegis_control_plane.app import build_app
from fastapi.testclient import TestClient

from aegis_shared.tinybird_client import TinybirdClient


@pytest.fixture
def fake_tinybird_one_model(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _query_endpoint(
        self: TinybirdClient,
        name: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        params = params or {}
        if name == "model_kpi":
            if params.get("model_id") == "no-such-model":
                return []
            return [
                {
                    "model_id": params["model_id"],
                    "predictions_total": 124_330,
                    "p50_latency_ms": 41.0,
                    "p95_latency_ms": 88.0,
                    "error_rate": 0.012,
                    "headline_metric_key": "demographic_parity_gender",
                    "headline_metric_value": 0.71,
                    "headline_metric_floor": 0.80,
                    "headline_metric_status": "danger",
                    "severity": "HIGH",
                    "open_incidents": 1,
                }
            ]
        if name == "kpi_sparkline":
            return [
                {
                    "model_id": params["model_id"],
                    "kind": "headline",
                    "t": "2026-04-28T00:00:00Z",
                    "v": 0.71,
                }
            ]
        raise AssertionError(f"unexpected pipe call: {name!r}")

    monkeypatch.setattr(TinybirdClient, "query_endpoint", _query_endpoint)
    monkeypatch.setenv("TINYBIRD_TOKEN", "test-token-do-not-use")
    from aegis_control_plane.config import get_settings

    get_settings.cache_clear()


def test_model_kpi_returns_one_rollup(fake_tinybird_one_model: None) -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/models/credit-v1/kpi?window=24h")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model_id"] == "credit-v1"
    assert body["window"] == "24h"
    assert body["headline_metric"]["status"] == "danger"
    assert len(body["headline_metric"]["trend"]) == 1


def test_model_kpi_404_when_no_rollup(fake_tinybird_one_model: None) -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/models/no-such-model/kpi?window=24h")
    assert res.status_code == 404
