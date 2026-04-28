"""`list_pending_approvals` dispatcher tests."""

from __future__ import annotations

import httpx
import pytest
import respx
from aegis_assistant.tools import execute_tool


@pytest.mark.asyncio
async def test_list_pending_approvals_empty_queue() -> None:
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/decisions?state=awaiting_approval&limit=50").mock(
            return_value=httpx.Response(200, json=[])
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "list_pending_approvals", {})
    assert result.error is None
    assert "empty" in result.summary.lower()


@pytest.mark.asyncio
async def test_list_pending_approvals_single_item() -> None:
    canned = [
        {
            "id": "dec-aaaaaa",
            "model_id": "credit-v1",
            "severity": "HIGH",
            "state": "awaiting_approval",
        }
    ]
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/decisions?state=awaiting_approval&limit=50").mock(
            return_value=httpx.Response(200, json=canned)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "list_pending_approvals", {})
    assert result.error is None
    assert "1 pending" in result.summary
    assert "credit-v1" in result.summary
    assert "HIGH" in result.summary


@pytest.mark.asyncio
async def test_list_pending_approvals_multiple_items() -> None:
    canned = [{"id": f"dec-{i:08x}", "model_id": "credit-v1", "severity": "HIGH"} for i in range(7)]
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/decisions?state=awaiting_approval&limit=50").mock(
            return_value=httpx.Response(200, json=canned)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "list_pending_approvals", {})
    assert result.error is None
    assert "7 pending" in result.summary
