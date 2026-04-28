"""Tests for `POST /select`."""

from __future__ import annotations

import pytest
from aegis_action_selector.app import build_app
from aegis_action_selector.persistence import reset
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _reset_bandits() -> None:
    """Each test starts with a fresh bandit registry."""
    reset()


def test_select_returns_chosen_action_and_pareto_front() -> None:
    body = {
        "model_id": "credit-v1",
        "decision_id": "test-decision-1",
        "context": [0.71, 0.94, 0.18, 0.5],
        "constraints": [5.0, 1.0, 100.0, 1.0],
        "horizon_remaining": 100,
    }
    res = TestClient(build_app()).post("/select", json=body)
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["method"].startswith("CB-Knapsacks")
    assert payload["chosen_action"] in {
        "REWEIGH",
        "RETRAIN",
        "RECALIBRATE",
        "FEATURE_DROP",
        "CALIBRATION_PATCH",
        "REJECT_OPTION",
        "ESCALATE",
        "SHADOW_DEPLOY",
    }
    assert isinstance(payload["candidates"], list)
    assert len(payload["candidates"]) == 8  # all 8 actions
    # Exactly one candidate is selected.
    selected = [c for c in payload["candidates"] if c["selected"]]
    assert len(selected) == 1
    assert selected[0]["action"] == payload["chosen_action"]
    # At least one candidate is on the Pareto front.
    on_front = [c for c in payload["candidates"] if c["on_pareto_front"]]
    assert len(on_front) >= 1
    # λ dual has 4 entries.
    assert len(payload["lambda_dual"]) == 4


def test_select_with_recommended_action_prior() -> None:
    """Phase 6 prior should be reflected in the rationale."""
    body = {
        "model_id": "credit-v1",
        "decision_id": "test-decision-2",
        "context": [0.71, 0.94, 0.18, 0.5],
        "constraints": [5.0, 1.0, 100.0, 1.0],
        "recommended_action": "REWEIGH",
        "horizon_remaining": 100,
    }
    res = TestClient(build_app()).post("/select", json=body)
    assert res.status_code == 200
    payload = res.json()
    assert "REWEIGH" in payload["rationale"]


def test_select_filters_to_available_actions() -> None:
    """When available_actions restricts the set, chosen must be in that set."""
    body = {
        "model_id": "credit-v1",
        "decision_id": "test-decision-3",
        "context": [0.71, 0.94, 0.18, 0.5],
        "constraints": [5.0, 1.0, 100.0, 1.0],
        "available_actions": ["REWEIGH", "ESCALATE"],
        "horizon_remaining": 100,
    }
    res = TestClient(build_app()).post("/select", json=body)
    assert res.status_code == 200
    payload = res.json()
    assert payload["chosen_action"] in {"REWEIGH", "ESCALATE"}


def test_select_extra_field_rejected() -> None:
    res = TestClient(build_app()).post(
        "/select",
        json={
            "model_id": "credit-v1",
            "decision_id": "x",
            "context": [0.0],
            "constraints": [0.0],
            "extra_garbage": "lol",
        },
    )
    assert res.status_code == 422


def test_select_missing_required_field_rejected() -> None:
    res = TestClient(build_app()).post(
        "/select",
        json={
            "model_id": "credit-v1",
            "decision_id": "x",
            # missing context, constraints
        },
    )
    assert res.status_code == 422
