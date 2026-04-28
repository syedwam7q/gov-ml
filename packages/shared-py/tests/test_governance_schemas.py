"""Tests for the governance Pydantic schemas."""

from datetime import UTC, datetime

import pytest

from aegis_shared.schemas import (
    DriftSignal,
    GovernanceDecision,
    Model,
    ModelVersion,
    Policy,
)
from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Severity


def _now() -> datetime:
    return datetime(2026, 4, 28, 12, 0, 0, tzinfo=UTC)


def test_model_minimal_fields() -> None:
    m = Model(
        id="credit-v1",
        name="Credit risk classifier",
        family=ModelFamily.TABULAR,
        risk_class=RiskClass.HIGH,
        active_version="0.1.0",
        owner_id="user_test",
        model_card_url="https://example.com/card.json",
        created_at=_now(),
    )
    assert m.id == "credit-v1"
    assert m.family == ModelFamily.TABULAR


def test_model_version_round_trip() -> None:
    v = ModelVersion(
        id="00000000-0000-0000-0000-000000000001",
        model_id="credit-v1",
        version="0.1.0",
        artifact_url="blob://models/credit/0.1.0/model.json",
        training_data_snapshot_url="blob://snapshots/hmda-2017-ca.parquet",
        qc_metrics={"accuracy": 0.872, "auroc": 0.91},
        status="active",
        created_at=_now(),
    )
    j = v.model_dump_json()
    v2 = ModelVersion.model_validate_json(j)
    assert v2 == v


def test_drift_signal_severity_typed() -> None:
    s = DriftSignal(
        model_id="credit-v1",
        metric="demographic_parity_gender",
        value=0.71,
        baseline=0.94,
        severity=Severity.HIGH,
        observed_at=_now(),
    )
    assert s.severity == Severity.HIGH


def test_governance_decision_lifecycle_states() -> None:
    d = GovernanceDecision(
        id="00000000-0000-0000-0000-000000000042",
        model_id="credit-v1",
        policy_id="00000000-0000-0000-0000-000000000099",
        state=DecisionState.DETECTED,
        severity=Severity.HIGH,
        drift_signal={"metric": "DP_gender", "value": 0.71},
        observation_window_secs=3600,
        opened_at=_now(),
    )
    assert d.state == DecisionState.DETECTED
    d2 = d.model_copy(update={"state": DecisionState.ANALYZED})
    assert d2.state == DecisionState.ANALYZED
    assert d.state == DecisionState.DETECTED


def test_policy_dsl_string_round_trip() -> None:
    p = Policy(
        id="00000000-0000-0000-0000-000000000099",
        model_id="credit-v1",
        version=7,
        active=True,
        mode="dry_run",
        dsl_yaml="name: credit-fairness\ntriggers: []",
        parsed_ast={"name": "credit-fairness", "triggers": []},
        created_at=_now(),
        created_by="user_test",
    )
    j = p.model_dump_json()
    p2 = Policy.model_validate_json(j)
    assert p2 == p


def test_governance_decision_rejects_invalid_window() -> None:
    with pytest.raises(ValueError, match="observation_window_secs"):
        GovernanceDecision(
            id="00000000-0000-0000-0000-000000000042",
            model_id="credit-v1",
            policy_id="00000000-0000-0000-0000-000000000099",
            state=DecisionState.DETECTED,
            severity=Severity.HIGH,
            drift_signal={},
            observation_window_secs=-1,
            opened_at=_now(),
        )
