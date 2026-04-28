"""`get_fleet_status` dispatcher tests."""

from __future__ import annotations

import httpx
import pytest
import respx
from aegis_assistant.tools import execute_tool


@pytest.mark.asyncio
async def test_get_fleet_status_returns_summary() -> None:
    async with respx.mock(assert_all_called=True) as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(
                200,
                json=[
                    {
                        "id": "credit-v1",
                        "risk_class": "HIGH",
                        "name": "Credit",
                        "family": "tabular",
                    },
                    {
                        "id": "toxicity-v1",
                        "risk_class": "MEDIUM",
                        "name": "Toxicity",
                        "family": "text",
                    },
                ],
            )
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_fleet_status", {})
    assert result.error is None
    assert "2 model(s)" in result.summary
    assert "credit-v1" in result.summary
    assert isinstance(result.payload, list)
    assert len(result.payload) == 2


@pytest.mark.asyncio
async def test_get_fleet_status_empty_fleet() -> None:
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(200, json=[])
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_fleet_status", {})
    assert result.error is None
    assert "no models" in result.summary.lower()


@pytest.mark.asyncio
async def test_get_fleet_status_handles_500() -> None:
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(return_value=httpx.Response(500))
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_fleet_status", {})
    assert result.error is not None
    assert result.payload is None
