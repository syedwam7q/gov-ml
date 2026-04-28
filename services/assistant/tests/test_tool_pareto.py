"""`get_pareto_front` dispatcher tests — reads plan_evidence from a decision."""

from __future__ import annotations

import httpx
import pytest
import respx
from aegis_assistant.tools import execute_tool

_DECISION_ID = "dec-pareto-001"


@pytest.mark.asyncio
async def test_get_pareto_front_summarises_chosen_and_count() -> None:
    plan = {
        "chosen_action": "REWEIGH",
        "chosen_lower_ci": 0.18,
        "candidates": [
            {"action": "REWEIGH", "on_pareto_front": True},
            {"action": "RETRAIN", "on_pareto_front": True},
            {"action": "FEATURE_DROP", "on_pareto_front": False},
            {"action": "ESCALATE", "on_pareto_front": True},
        ],
        "lambda_dual": [0.3, 0.2, 0.4, 0.1],
    }
    canned = {
        "id": _DECISION_ID,
        "model_id": "credit-v1",
        "state": "planned",
        "plan_evidence": plan,
    }
    async with respx.mock() as mock:
        mock.get(f"http://localhost:8000/api/cp/decisions/{_DECISION_ID}").mock(
            return_value=httpx.Response(200, json=canned)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_pareto_front", {"decision_id": _DECISION_ID})
    assert result.error is None
    assert "REWEIGH" in result.summary
    assert "4 candidate" in result.summary
    assert "3 on the Pareto front" in result.summary
    assert result.payload == plan


@pytest.mark.asyncio
async def test_get_pareto_front_no_plan_evidence() -> None:
    canned = {
        "id": _DECISION_ID,
        "model_id": "credit-v1",
        "state": "analyzed",
        "plan_evidence": None,
    }
    async with respx.mock() as mock:
        mock.get(f"http://localhost:8000/api/cp/decisions/{_DECISION_ID}").mock(
            return_value=httpx.Response(200, json=canned)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_pareto_front", {"decision_id": _DECISION_ID})
    assert result.error is None
    assert "no plan_evidence" in result.summary
    assert result.payload is None
