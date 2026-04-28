"""`explain_drift_signal` dispatcher tests."""

from __future__ import annotations

import httpx
import pytest
import respx
from aegis_assistant.tools import execute_tool


@pytest.mark.asyncio
async def test_explain_drift_signal_returns_top_cause_and_action() -> None:
    decisions = [
        {
            "id": "dec-1",
            "model_id": "credit-v1",
            "drift_signal": {"metric": "demographic_parity_gender"},
            "causal_attribution": {
                "method": "dowhy",
                "root_causes": [
                    {"node": "loan_amount", "contribution": 0.42},
                    {"node": "income", "contribution": 0.31},
                ],
                "recommended_action": "REWEIGH",
            },
        }
    ]
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/decisions?model_id=credit-v1&limit=20").mock(
            return_value=httpx.Response(200, json=decisions)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "explain_drift_signal", {"model_id": "credit-v1"})
    assert result.error is None
    assert "credit-v1" in result.summary
    assert "loan_amount" in result.summary
    assert "42%" in result.summary
    assert "REWEIGH" in result.summary
    # Payload now wraps both the resolved decision_id and the raw
    # attribution so the model can chain into get_audit_chain etc.
    # without fabricating a placeholder id.
    assert result.payload["decision_id"] == "dec-1"
    assert result.payload["attribution"] == decisions[0]["causal_attribution"]
    # Summary should also call out the decision_id so the model sees it
    # immediately on the tool_call_end frame.
    assert "dec-1" in result.summary


@pytest.mark.asyncio
async def test_explain_drift_signal_filters_by_metric() -> None:
    decisions = [
        {
            "id": "dec-1",
            "drift_signal": {"metric": "calibration_ece"},
            "causal_attribution": {
                "method": "dowhy",
                "root_causes": [{"node": "x1", "contribution": 0.50}],
                "recommended_action": "RECALIBRATE",
            },
        },
        {
            "id": "dec-2",
            "drift_signal": {"metric": "demographic_parity_gender"},
            "causal_attribution": {
                "method": "dbshap",
                "root_causes": [{"node": "x2", "contribution": 0.60}],
                "recommended_action": "REWEIGH",
            },
        },
    ]
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/decisions?model_id=credit-v1&limit=20").mock(
            return_value=httpx.Response(200, json=decisions)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(
                client,
                "explain_drift_signal",
                {"model_id": "credit-v1", "metric": "demographic_parity_gender"},
            )
    assert result.error is None
    assert "REWEIGH" in result.summary
    assert "x2" in result.summary


@pytest.mark.asyncio
async def test_explain_drift_signal_no_decisions() -> None:
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/decisions?model_id=ghost-v1&limit=20").mock(
            return_value=httpx.Response(200, json=[])
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "explain_drift_signal", {"model_id": "ghost-v1"})
    assert result.error is None
    assert "no decisions" in result.summary
    assert result.payload is None
