"""Lock the action set + cost vectors. Spec §12.2 + Phase 6 cause→action."""

from __future__ import annotations

from aegis_action_selector.actions import ACTION_SET, ActionKey, CostVector


def test_action_set_has_eight_canonical_actions() -> None:
    expected = {
        "REWEIGH",
        "RETRAIN",
        "RECALIBRATE",
        "FEATURE_DROP",
        "CALIBRATION_PATCH",
        "REJECT_OPTION",
        "ESCALATE",
        "SHADOW_DEPLOY",
    }
    assert {a.value for a in ActionKey} == expected
    assert len(ACTION_SET) == 8


def test_phase_7_action_set_extends_phase_6_with_shadow_deploy() -> None:
    """Phase 6's 7 actions are a subset of Phase 7's 8."""
    phase_6_set = {
        "REWEIGH",
        "RETRAIN",
        "RECALIBRATE",
        "FEATURE_DROP",
        "CALIBRATION_PATCH",
        "REJECT_OPTION",
        "ESCALATE",
    }
    phase_7_set = {a.value for a in ActionKey}
    assert phase_6_set < phase_7_set
    assert phase_7_set - phase_6_set == {"SHADOW_DEPLOY"}


def test_every_action_has_a_finite_cost_vector() -> None:
    for cost in ACTION_SET.values():
        assert isinstance(cost, CostVector)
        assert cost.latency_ms_added >= 0.0
        assert cost.dollar_cost >= 0.0
        assert 0.0 <= cost.user_visible_traffic_pct <= 100.0
        assert cost.risk_class in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_shadow_deploy_has_zero_user_visible_traffic() -> None:
    assert ACTION_SET[ActionKey.SHADOW_DEPLOY].user_visible_traffic_pct == 0.0


def test_escalate_has_zero_dollar_cost() -> None:
    """ESCALATE just routes to a human — no compute cost."""
    assert ACTION_SET[ActionKey.ESCALATE].dollar_cost == 0.0


def test_cost_vector_as_array_returns_4_dim() -> None:
    arr = ACTION_SET[ActionKey.RETRAIN].as_array()
    assert len(arr) == 4
    assert all(isinstance(x, float) for x in arr)
