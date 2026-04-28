"""Tests for the cause→action mapping table — spec §12.1 paper artifact."""

from __future__ import annotations

import pytest
from aegis_causal_attrib.cause_mapping import (
    CAUSE_TO_ACTION,
    ActionKey,
    AttributionEvidence,
    recommend_action,
)
from aegis_causal_attrib.dag_loader import CauseKind


def test_every_cause_kind_has_a_target_action() -> None:
    """Adding a new CauseKind requires updating the mapping table — locked here."""
    for kind in CauseKind:
        assert kind in CAUSE_TO_ACTION, f"missing action mapping for {kind}"
        assert isinstance(CAUSE_TO_ACTION[kind], ActionKey)


def test_recommend_action_for_upstream_covariate_is_reweigh() -> None:
    ev = AttributionEvidence(
        dominant_cause_node="co_applicant_present",
        dominant_cause_kind=CauseKind.UPSTREAM_COVARIATE,
        shapley={"co_applicant_present": 0.71, "loan_purpose": 0.18},
        confidence=0.86,
    )
    assert recommend_action(ev) is ActionKey.REWEIGH


def test_recommend_action_for_conditional_mechanism_is_retrain() -> None:
    ev = AttributionEvidence(
        dominant_cause_node="approval",
        dominant_cause_kind=CauseKind.CONDITIONAL_MECHANISM,
        shapley={"approval": 0.65, "income": 0.10},
        confidence=0.86,
    )
    assert recommend_action(ev) is ActionKey.RETRAIN


def test_recommend_action_for_proxy_attribute_is_feature_drop() -> None:
    ev = AttributionEvidence(
        dominant_cause_node="applicant_race",
        dominant_cause_kind=CauseKind.PROXY_ATTRIBUTE,
        shapley={"applicant_race": 0.65, "income": 0.10},
        confidence=0.86,
    )
    assert recommend_action(ev) is ActionKey.FEATURE_DROP


def test_recommend_action_for_calibration_mechanism_is_patch() -> None:
    ev = AttributionEvidence(
        dominant_cause_node="a1c_test_received",
        dominant_cause_kind=CauseKind.CALIBRATION_MECHANISM,
        shapley={"a1c_test_received": 0.55, "comorbidity_severity": 0.12},
        confidence=0.86,
    )
    assert recommend_action(ev) is ActionKey.CALIBRATION_PATCH


def test_low_confidence_routes_to_escalate() -> None:
    ev = AttributionEvidence(
        dominant_cause_node="x",
        dominant_cause_kind=CauseKind.CONDITIONAL_MECHANISM,
        shapley={"x": 0.1, "y": 0.05, "z": 0.04},
        confidence=0.30,
    )
    assert recommend_action(ev, confidence_floor=0.50) is ActionKey.ESCALATE


def test_top_two_within_tie_threshold_routes_to_reject_option() -> None:
    """Top-2 Shapley values within 5% relative gap → abstain (Chow 1970)."""
    ev = AttributionEvidence(
        dominant_cause_node="x",
        dominant_cause_kind=CauseKind.UPSTREAM_COVARIATE,
        shapley={"x": 0.50, "y": 0.49, "z": 0.10},  # x and y are tied
        confidence=0.86,
    )
    assert recommend_action(ev) is ActionKey.REJECT_OPTION


def test_action_keys_match_spec_table_entries() -> None:
    expected = {
        "REWEIGH",
        "RETRAIN",
        "RECALIBRATE",
        "FEATURE_DROP",
        "CALIBRATION_PATCH",
        "REJECT_OPTION",
        "ESCALATE",
    }
    assert {a.value for a in ActionKey} >= expected


@pytest.mark.parametrize(
    ("kind", "expected_action"),
    [
        (CauseKind.UPSTREAM_COVARIATE, ActionKey.REWEIGH),
        (CauseKind.CONDITIONAL_MECHANISM, ActionKey.RETRAIN),
        (CauseKind.PROXY_ATTRIBUTE, ActionKey.FEATURE_DROP),
        (CauseKind.CALIBRATION_MECHANISM, ActionKey.CALIBRATION_PATCH),
    ],
)
def test_cause_to_action_table_is_complete(kind: CauseKind, expected_action: ActionKey) -> None:
    assert CAUSE_TO_ACTION[kind] is expected_action
