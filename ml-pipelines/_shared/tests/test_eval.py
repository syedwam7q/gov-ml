"""Tests for fairness + calibration helpers."""

import numpy as np
from aegis_pipelines.eval import (
    binary_classification_metrics,
    demographic_parity_difference,
    equal_opportunity_difference,
    expected_calibration_error,
    subgroup_metrics,
)


def test_demographic_parity_difference_for_unequal_rates() -> None:
    y_pred = np.array([1, 0, 1, 0, 1, 0])
    sensitive = np.array(["a", "a", "a", "b", "b", "b"])
    out = demographic_parity_difference(y_pred=y_pred, sensitive=sensitive)
    assert abs(out - (2 / 3 - 1 / 3)) < 1e-9


def test_demographic_parity_zero_when_perfectly_equal() -> None:
    y_pred = np.array([1, 1, 0, 1, 1, 0])
    sensitive = np.array(["a", "a", "a", "b", "b", "b"])
    out = demographic_parity_difference(y_pred=y_pred, sensitive=sensitive)
    assert out == 0.0


def test_equal_opportunity_difference() -> None:
    y_true = np.array([1, 1, 0, 1, 1, 0])
    y_pred = np.array([1, 0, 0, 1, 1, 0])
    sensitive = np.array(["a", "a", "a", "b", "b", "b"])
    # Group a TPR = 1/2; Group b TPR = 2/2; Difference = 0.5.
    out = equal_opportunity_difference(y_true=y_true, y_pred=y_pred, sensitive=sensitive)
    assert abs(out - 0.5) < 1e-9


def test_expected_calibration_error_perfectly_calibrated() -> None:
    rng = np.random.default_rng(0)
    y_prob = rng.uniform(0, 1, size=10_000)
    y_true = (rng.uniform(0, 1, size=10_000) < y_prob).astype(int)
    ece = expected_calibration_error(y_true=y_true, y_prob=y_prob, n_bins=10)
    assert ece < 0.05


def test_expected_calibration_error_uncalibrated() -> None:
    y_prob = np.full(1000, 0.9)
    y_true = np.zeros(1000, dtype=int)
    ece = expected_calibration_error(y_true=y_true, y_prob=y_prob, n_bins=10)
    assert ece > 0.7


def test_binary_classification_metrics_returns_expected_keys() -> None:
    y_true = np.array([0, 1, 1, 0, 1])
    y_pred = np.array([0, 1, 0, 0, 1])
    y_prob = np.array([0.1, 0.9, 0.4, 0.2, 0.8])
    m = binary_classification_metrics(y_true=y_true, y_pred=y_pred, y_prob=y_prob)
    for key in ["accuracy", "precision", "recall", "f1", "auroc", "brier", "ece"]:
        assert key in m


def test_subgroup_metrics_returns_per_group_dict() -> None:
    y_true = np.array([0, 1, 1, 0, 1, 0])
    y_pred = np.array([0, 1, 0, 0, 1, 1])
    y_prob = np.array([0.1, 0.9, 0.4, 0.2, 0.8, 0.6])
    sensitive = np.array(["a", "a", "a", "b", "b", "b"])
    out = subgroup_metrics(y_true=y_true, y_pred=y_pred, y_prob=y_prob, sensitive=sensitive)
    assert "a" in out
    assert "b" in out
    assert "accuracy" in out["a"]
    assert "demographic_parity_difference" in out
    assert "equal_opportunity_difference" in out
