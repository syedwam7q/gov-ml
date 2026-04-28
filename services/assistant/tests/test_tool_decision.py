"""`get_decision` and `get_audit_chain` dispatcher tests."""

from __future__ import annotations

import httpx
import pytest
import respx
from aegis_assistant.tools import execute_tool

_DECISION_ID = "dec-7f3c1b2e-0a47-4c1d-9d8e-3a2bcd1f7ee4"


@pytest.mark.asyncio
async def test_get_decision_returns_state_and_severity() -> None:
    canned = {
        "id": _DECISION_ID,
        "model_id": "credit-v1",
        "state": "awaiting_approval",
        "severity": "HIGH",
        "drift_signal": {"metric": "demographic_parity_gender", "psi": 0.31},
    }
    async with respx.mock() as mock:
        mock.get(f"http://localhost:8000/api/cp/decisions/{_DECISION_ID}").mock(
            return_value=httpx.Response(200, json=canned)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_decision", {"decision_id": _DECISION_ID})
    assert result.error is None
    assert _DECISION_ID in result.summary
    assert "credit-v1" in result.summary
    assert "awaiting_approval" in result.summary
    assert "HIGH" in result.summary
    assert result.payload == canned


@pytest.mark.asyncio
async def test_get_audit_chain_summarises_action_sequence() -> None:
    rows = [
        {"action": "detect", "sequence_n": 1, "ts": "..."},
        {"action": "analyze", "sequence_n": 2, "ts": "..."},
        {"action": "plan", "sequence_n": 3, "ts": "..."},
    ]
    canned = {"rows": rows, "next_page": None}
    async with respx.mock() as mock:
        mock.get(f"http://localhost:8000/api/cp/audit?decision_id={_DECISION_ID}&limit=20").mock(
            return_value=httpx.Response(200, json=canned)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_audit_chain", {"decision_id": _DECISION_ID})
    assert result.error is None
    assert "3 row" in result.summary
    assert "detect → analyze → plan" in result.summary
    assert result.payload == canned


@pytest.mark.asyncio
async def test_get_audit_chain_empty() -> None:
    async with respx.mock() as mock:
        mock.get(f"http://localhost:8000/api/cp/audit?decision_id={_DECISION_ID}&limit=20").mock(
            return_value=httpx.Response(200, json={"rows": [], "next_page": None})
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_audit_chain", {"decision_id": _DECISION_ID})
    assert result.error is None
    assert "no rows" in result.summary
