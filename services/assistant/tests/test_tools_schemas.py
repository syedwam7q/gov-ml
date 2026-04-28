"""Lock the tool surface — the 7 tools from spec §11.2 must always be present.

If anyone adds, removes, or renames a tool in `tools/schemas.py` they
must update this test in lock-step. That keeps the dashboard's
expectations in sync with what the model actually has access to.
"""

from __future__ import annotations

from aegis_assistant.tools.schemas import TOOL_SPECS


def test_seven_tools_present() -> None:
    expected = {
        "get_fleet_status",
        "get_model_metrics",
        "get_decision",
        "get_audit_chain",
        "list_pending_approvals",
        "get_pareto_front",
        "explain_drift_signal",
    }
    assert {t["function"]["name"] for t in TOOL_SPECS} == expected


def test_each_spec_has_openai_function_shape() -> None:
    for spec in TOOL_SPECS:
        assert spec["type"] == "function"
        fn = spec["function"]
        assert "name" in fn
        assert "description" in fn
        assert "parameters" in fn
        params = fn["parameters"]
        assert params["type"] == "object"
        assert "properties" in params
        assert "required" in params


def test_each_description_is_substantive() -> None:
    """No-arg tools shouldn't ship with a one-word description — Groq
    routes on description, so terse specs cause poor tool selection."""
    for spec in TOOL_SPECS:
        desc = spec["function"]["description"]
        assert len(desc) > 50, f"description too short for {spec['function']['name']}"


def test_get_decision_requires_decision_id() -> None:
    spec = next(t for t in TOOL_SPECS if t["function"]["name"] == "get_decision")
    assert "decision_id" in spec["function"]["parameters"]["required"]


def test_get_audit_chain_requires_decision_id() -> None:
    spec = next(t for t in TOOL_SPECS if t["function"]["name"] == "get_audit_chain")
    assert "decision_id" in spec["function"]["parameters"]["required"]


def test_get_pareto_front_requires_decision_id() -> None:
    spec = next(t for t in TOOL_SPECS if t["function"]["name"] == "get_pareto_front")
    assert "decision_id" in spec["function"]["parameters"]["required"]


def test_get_model_metrics_window_is_enum() -> None:
    spec = next(t for t in TOOL_SPECS if t["function"]["name"] == "get_model_metrics")
    window = spec["function"]["parameters"]["properties"]["window"]
    assert set(window["enum"]) == {"24h", "7d", "30d"}


def test_get_model_metrics_requires_model_id() -> None:
    spec = next(t for t in TOOL_SPECS if t["function"]["name"] == "get_model_metrics")
    assert "model_id" in spec["function"]["parameters"]["required"]


def test_explain_drift_signal_requires_model_id_only() -> None:
    """metric is optional — model can ask for top cause without
    naming the metric."""
    spec = next(t for t in TOOL_SPECS if t["function"]["name"] == "explain_drift_signal")
    required = spec["function"]["parameters"]["required"]
    assert required == ["model_id"]


def test_no_arg_tools_have_empty_required() -> None:
    for name in ("get_fleet_status", "list_pending_approvals"):
        spec = next(t for t in TOOL_SPECS if t["function"]["name"] == name)
        assert spec["function"]["parameters"]["required"] == []
