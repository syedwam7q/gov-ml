"""Tests for the per-action Bayesian linear regression oracle."""

from __future__ import annotations

import numpy as np
from aegis_action_selector.blr import BayesianLinearRegression


def test_blr_with_no_data_predicts_zero() -> None:
    blr = BayesianLinearRegression(n_features=3, alpha_prior=1.0, beta_prior=1.0)
    pred = blr.predict_mean(np.array([1.0, 0.5, -0.3]))
    assert abs(pred) < 1e-9


def test_blr_ucb_bonus_shrinks_with_data() -> None:
    """Adding observations shrinks the posterior variance."""
    rng = np.random.default_rng(0)
    blr = BayesianLinearRegression(n_features=3, alpha_prior=1.0, beta_prior=1.0)
    x = np.array([1.0, 0.5, -0.3])
    bonus_empty = blr.ucb_bonus(x, beta=2.0)
    for _ in range(50):
        xi = rng.normal(0.0, 1.0, 3)
        ri = float(xi @ np.array([0.5, -0.2, 0.1])) + rng.normal(0.0, 0.1)
        blr.update(xi, ri)
    bonus_full = blr.ucb_bonus(x, beta=2.0)
    assert bonus_full < bonus_empty


def test_blr_predicts_close_to_truth_after_many_observations() -> None:
    rng = np.random.default_rng(1)
    blr = BayesianLinearRegression(n_features=3, alpha_prior=1.0, beta_prior=10.0)
    true_w = np.array([0.5, -0.2, 0.1])
    for _ in range(500):
        xi = rng.normal(0.0, 1.0, 3)
        ri = float(xi @ true_w) + rng.normal(0.0, 0.05)
        blr.update(xi, ri)
    x = np.array([1.0, 0.5, -0.3])
    pred = blr.predict_mean(x)
    truth = float(x @ true_w)
    assert abs(pred - truth) < 0.05


def test_blr_predict_std_is_nonneg() -> None:
    blr = BayesianLinearRegression(n_features=3, alpha_prior=1.0, beta_prior=1.0)
    rng = np.random.default_rng(2)
    for _ in range(20):
        blr.update(rng.normal(0, 1, 3), float(rng.normal(0, 1)))
    std = blr.predict_std(np.array([1.0, 0.0, 0.0]))
    assert std >= 0.0
