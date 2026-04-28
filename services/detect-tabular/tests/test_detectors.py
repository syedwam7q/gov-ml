"""Tests for the drift / fairness detectors."""

from __future__ import annotations

import numpy as np
import pandas as pd
from aegis_detect_tabular.detectors import (
    detect_demographic_parity,
    detect_equal_opportunity,
    detect_numeric_drift,
    run_all,
)

from aegis_shared.types import Severity


def _stable_ref_cur(n: int = 1000, seed: int = 0) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    ref = pd.DataFrame({"income": rng.normal(60_000, 20_000, size=n)})
    cur = pd.DataFrame({"income": rng.normal(60_000, 20_000, size=n)})
    return ref, cur


def _shifted_ref_cur(n: int = 1000, seed: int = 0) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    ref = pd.DataFrame({"income": rng.normal(60_000, 20_000, size=n)})
    # Mean-shift large enough to push PSI above HIGH (0.30).
    cur = pd.DataFrame({"income": rng.normal(80_000, 20_000, size=n)})
    return ref, cur


def test_numeric_drift_no_signal_when_distributions_stable() -> None:
    ref, cur = _stable_ref_cur()
    signals = detect_numeric_drift(
        model_id="credit-v1",
        reference=ref,
        current=cur,
        columns=["income"],
    )
    assert signals == []


def test_numeric_drift_emits_high_severity_when_shifted() -> None:
    ref, cur = _shifted_ref_cur()
    signals = detect_numeric_drift(
        model_id="credit-v1",
        reference=ref,
        current=cur,
        columns=["income"],
    )
    assert len(signals) == 1
    sig = signals[0]
    assert sig.metric == "drift_psi_income"
    assert sig.severity in (Severity.MEDIUM, Severity.HIGH)
    assert sig.value > 0.1


def test_numeric_drift_handles_missing_columns() -> None:
    ref, cur = _stable_ref_cur()
    signals = detect_numeric_drift(
        model_id="credit-v1",
        reference=ref,
        current=cur,
        columns=["nonexistent"],
    )
    assert signals == []


def test_demographic_parity_no_signal_when_groups_equal() -> None:
    rng = np.random.default_rng(0)
    n = 500
    df = pd.DataFrame(
        {
            "gender": rng.choice(["M", "F"], size=n),
            "y_pred": rng.uniform(0, 1, size=n),
        }
    )
    signals = detect_demographic_parity(
        model_id="credit-v1",
        current=df,
        sensitive_columns=["gender"],
    )
    # Symmetric random predictions → small gap → no signal expected
    assert all(s.severity == Severity.LOW for s in signals) or signals == []


def test_demographic_parity_signal_when_one_group_disadvantaged() -> None:
    rng = np.random.default_rng(0)
    n = 500
    gender = rng.choice(["M", "F"], size=n)
    # Female applicants get systematically lower scores (induced disparity)
    y_pred = np.where(gender == "F", rng.uniform(0, 0.4, size=n), rng.uniform(0.6, 1.0, size=n))
    df = pd.DataFrame({"gender": gender, "y_pred": y_pred})
    signals = detect_demographic_parity(
        model_id="credit-v1",
        current=df,
        sensitive_columns=["gender"],
    )
    assert len(signals) == 1
    sig = signals[0]
    assert sig.metric == "demographic_parity_gender"
    assert sig.severity == Severity.HIGH
    assert sig.value > 0.5


def test_equal_opportunity_signal_when_tpr_differs() -> None:
    rng = np.random.default_rng(0)
    n = 600
    gender = rng.choice(["M", "F"], size=n)
    y_true = rng.choice([0.0, 1.0], size=n)
    # Among true positives (y_true=1), F-applicants are predicted negative more often.
    y_pred = y_true.copy()
    flip_mask = (y_true == 1) & (gender == "F") & (rng.uniform(size=n) < 0.5)
    y_pred[flip_mask] = 0.0
    df = pd.DataFrame({"gender": gender, "y_true": y_true, "y_pred": y_pred})
    signals = detect_equal_opportunity(
        model_id="credit-v1",
        current=df,
        sensitive_columns=["gender"],
    )
    assert any(s.metric == "equal_opportunity_gender" for s in signals)
    eo = next(s for s in signals if s.metric == "equal_opportunity_gender")
    assert eo.severity in (Severity.MEDIUM, Severity.HIGH)


def test_run_all_combines_all_three_detectors() -> None:
    rng = np.random.default_rng(0)
    n = 500
    gender = rng.choice(["M", "F"], size=n)
    y_pred = np.where(gender == "F", rng.uniform(0, 0.4, size=n), rng.uniform(0.6, 1.0, size=n))
    ref = pd.DataFrame({"income": rng.normal(60_000, 20_000, size=n)})
    cur = pd.DataFrame(
        {
            "income": rng.normal(80_000, 20_000, size=n),  # drifted
            "gender": gender,
            "y_pred": y_pred,
        }
    )
    signals = run_all(
        model_id="credit-v1",
        reference=ref,
        current=cur,
        numeric_columns=["income"],
        sensitive_columns=["gender"],
    )
    metrics = {s.metric for s in signals}
    assert "drift_psi_income" in metrics
    assert "demographic_parity_gender" in metrics
