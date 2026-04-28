"""`get_model_metrics` dispatcher tests."""

from __future__ import annotations

import httpx
import pytest
import respx
from aegis_assistant.tools import execute_tool


@pytest.mark.asyncio
async def test_get_model_metrics_summary_includes_headline_and_floor() -> None:
    canned = {
        "model_id": "credit-v1",
        "window": "24h",
        "p95_latency_ms": 88.0,
        "headline_metric": {
            "key": "demographic_parity_gender",
            "value": 0.71,
            "floor": 0.80,
        },
    }
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models/credit-v1/kpi?window=24h").mock(
            return_value=httpx.Response(200, json=canned)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(
                client,
                "get_model_metrics",
                {"model_id": "credit-v1", "window": "24h"},
            )
    assert result.error is None
    assert "credit-v1" in result.summary
    assert "0.71" in result.summary
    assert "0.80" in result.summary
    assert "88" in result.summary
    assert result.payload == canned


@pytest.mark.asyncio
async def test_get_model_metrics_defaults_to_24h() -> None:
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models/toxicity-v1/kpi?window=24h").mock(
            return_value=httpx.Response(
                200,
                json={
                    "model_id": "toxicity-v1",
                    "window": "24h",
                    "p95_latency_ms": 145,
                    "headline_metric": {"key": "toxicity_f1", "value": 0.92},
                },
            )
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_model_metrics", {"model_id": "toxicity-v1"})
    assert result.error is None
    assert "toxicity-v1" in result.summary
    assert "0.92" in result.summary


@pytest.mark.asyncio
async def test_get_model_metrics_missing_model_id_args() -> None:
    """Missing required arg should surface as a tool error, not crash."""
    async with httpx.AsyncClient() as client:
        result = await execute_tool(client, "get_model_metrics", {})
    assert result.error is not None
