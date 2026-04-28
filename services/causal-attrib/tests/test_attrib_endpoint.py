"""Tests for `POST /attrib/run`."""

from __future__ import annotations

import pandas as pd
import pytest
from aegis_causal_attrib.app import build_app
from fastapi.testclient import TestClient


def _frame_to_payload(df: pd.DataFrame) -> list[dict[str, float]]:
    return df.to_dict(orient="records")  # type: ignore[return-value]


@pytest.mark.slow
def test_attrib_run_returns_causal_attribution(
    credit_reference_frame: pd.DataFrame,
    credit_current_frame_with_drift: pd.DataFrame,
) -> None:
    """Live roundtrip — DoWhy primary path, /attrib/run returns
    a complete CausalAttribution-shaped payload."""
    body = {
        "model_id": "credit-v1",
        "target_node": "income",
        "reference_rows": _frame_to_payload(credit_reference_frame.head(800)),
        "current_rows": _frame_to_payload(credit_current_frame_with_drift.head(800)),
        "num_samples": 100,
    }
    res = TestClient(build_app()).post("/attrib/run", json=body)
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["method"] in {"DoWhy GCM", "DBShap"}
    assert isinstance(payload["root_causes"], list)
    assert payload["root_causes"]
    # Every root cause carries node + contribution.
    for rc in payload["root_causes"]:
        assert "node" in rc
        assert 0.0 <= rc["contribution"] <= 1.0
    assert payload["recommended_action"] in {
        "REWEIGH",
        "RETRAIN",
        "RECALIBRATE",
        "FEATURE_DROP",
        "CALIBRATION_PATCH",
        "REJECT_OPTION",
        "ESCALATE",
    }
    assert payload["attribution_quality"] in {"high", "degraded"}


def test_attrib_run_unknown_model_returns_404() -> None:
    """No DAG registered for the model → 404."""
    res = TestClient(build_app()).post(
        "/attrib/run",
        json={
            "model_id": "no-such-model",
            "target_node": "y",
            "reference_rows": [{"x": 1.0, "y": 0.0}],
            "current_rows": [{"x": 1.0, "y": 0.0}],
        },
    )
    assert res.status_code == 404


def test_attrib_run_target_not_in_frame_returns_400() -> None:
    """target_node missing from the reference frame → 400."""
    res = TestClient(build_app()).post(
        "/attrib/run",
        json={
            "model_id": "credit-v1",
            "target_node": "missing_column",
            "reference_rows": [{"applicant_sex": 0, "income": 50_000}],
            "current_rows": [{"applicant_sex": 1, "income": 60_000}],
        },
    )
    assert res.status_code == 400
    assert "missing_column" in res.json()["detail"]


def test_attrib_run_extra_field_rejected() -> None:
    """Pydantic strict mode — extra fields are rejected with 422."""
    res = TestClient(build_app()).post(
        "/attrib/run",
        json={
            "model_id": "credit-v1",
            "target_node": "income",
            "reference_rows": [{"a": 1.0}],
            "current_rows": [{"a": 1.0}],
            "extra_garbage": "lol",
        },
    )
    assert res.status_code == 422
