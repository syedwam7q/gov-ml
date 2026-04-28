"""Dispatcher routing — every tool name in the schema must have a registered dispatcher."""

from __future__ import annotations

import httpx
import pytest
from aegis_assistant.tools import TOOL_SPECS, execute_tool, registered_tools


def test_all_seven_tools_registered() -> None:
    assert registered_tools() == {
        "get_fleet_status",
        "get_model_metrics",
        "get_decision",
        "get_audit_chain",
        "list_pending_approvals",
        "get_pareto_front",
        "explain_drift_signal",
    }


def test_every_schema_tool_has_a_dispatcher() -> None:
    """No drift between TOOL_SPECS and the dispatcher registry."""
    schema_names = {t["function"]["name"] for t in TOOL_SPECS}
    assert schema_names == registered_tools()


@pytest.mark.asyncio
async def test_unknown_tool_returns_error_result() -> None:
    async with httpx.AsyncClient() as client:
        result = await execute_tool(client, "no_such_tool", {})
    assert result.error is not None
    assert "no_such_tool" in result.error
    assert result.payload is None
