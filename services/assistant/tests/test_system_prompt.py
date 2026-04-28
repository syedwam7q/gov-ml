"""Lock the system-prompt invariants.

The prompt is the assistant's safety contract. Accidental edits should
fail this test before they ship to production.
"""

from __future__ import annotations

from aegis_assistant.system_prompt import build_system_prompt


def test_prompt_mentions_grounding_requirement() -> None:
    """The prompt must require tool-call grounding for every claim."""
    prompt = build_system_prompt(scope={})
    lower = prompt.lower()
    assert "tool" in lower
    assert "ground" in lower or "grounded" in lower or "cite" in lower


def test_prompt_mentions_refusal_pattern() -> None:
    """Off-topic queries that would require hallucination → refuse."""
    prompt = build_system_prompt(scope={})
    lower = prompt.lower()
    assert "refuse" in lower or "decline" in lower


def test_prompt_lists_all_seven_tools_by_name() -> None:
    prompt = build_system_prompt(scope={})
    expected = (
        "get_fleet_status",
        "get_model_metrics",
        "get_decision",
        "get_audit_chain",
        "list_pending_approvals",
        "get_pareto_front",
        "explain_drift_signal",
    )
    for name in expected:
        assert name in prompt, f"prompt missing tool {name!r}"


def test_scope_decision_id_is_threaded_into_prompt() -> None:
    """When the dashboard opens the drawer scoped to a decision, the
    prompt should mention that decision so the model uses it."""
    prompt = build_system_prompt(scope={"decision_id": "abc-123"})
    assert "abc-123" in prompt


def test_no_scope_produces_clean_prompt() -> None:
    """Empty scope = no scope section, no leaked values from prior calls."""
    prompt = build_system_prompt(scope={})
    assert "abc-123" not in prompt
    assert "Current scope" not in prompt


def test_three_models_named_for_grounding_context() -> None:
    """Operators ask about credit-v1 / toxicity-v1 / readmission-v1 — the
    prompt should name them so the model picks the right tool args."""
    prompt = build_system_prompt(scope={})
    for model_id in ("credit-v1", "toxicity-v1", "readmission-v1"):
        assert model_id in prompt, f"prompt missing model {model_id!r}"
