"""Tests for the CB-Knapsack core algorithm."""

from __future__ import annotations

import numpy as np
from aegis_action_selector.actions import ACTION_SET, ActionKey
from aegis_action_selector.cb_knapsack import CBKnapsack


def test_cb_knapsack_picks_an_action() -> None:
    cb = CBKnapsack(action_set=ACTION_SET, n_features=4, beta=2.0)
    context = np.array([0.71, 0.94, 0.18, 0.5])
    chosen, scores = cb.choose_action(context)
    assert chosen in ACTION_SET
    assert isinstance(scores, dict)
    assert set(scores.keys()) == set(ACTION_SET.keys())


def test_lambda_dual_updates_toward_constraint_violation() -> None:
    """When observed cost exceeds budget, λ should increase."""
    cb = CBKnapsack(action_set=ACTION_SET, n_features=4, beta=2.0)
    initial_lambda = cb.lambda_dual.copy()
    cb.update(
        ActionKey.RETRAIN,
        context=np.array([0.5, 0.5, 0.5, 0.5]),
        reward_vector=np.array([0.001, 0.20, -2.0, -3.8]),
        observed_cost_vector=np.array([2.0, 5.0, 100.0, 0.7]),
        budget=np.array([5.0, 1.0, 100.0, 1.0]),
        horizon_remaining=10,
    )
    # λ for dollar_cost (dim 1) should grow because observed=5.0 >> budget/T=0.1.
    assert cb.lambda_dual[1] > initial_lambda[1]


def test_recommended_action_prior_boosts_score() -> None:
    """Phase 6's recommended_action biases the score upward."""
    cb = CBKnapsack(action_set=ACTION_SET, n_features=4, beta=2.0, prior_strength=0.5)
    context = np.array([0.71, 0.94, 0.18, 0.5])
    _, scores_no_prior = cb.choose_action(context)
    _, scores_with_prior = cb.choose_action(context, recommended_action=ActionKey.REWEIGH)
    # Scores for REWEIGH differ by exactly prior_strength.
    assert (scores_with_prior[ActionKey.REWEIGH] - scores_no_prior[ActionKey.REWEIGH] - 0.5) < 1e-9


def test_predicted_reward_returns_per_dim_array() -> None:
    cb = CBKnapsack(action_set=ACTION_SET, n_features=4, beta=2.0)
    pred = cb.predicted_reward(ActionKey.REWEIGH, np.array([0.5, 0.5, 0.5, 0.5]))
    assert pred.shape == (4,)


def test_predicted_reward_std_returns_per_dim_array() -> None:
    cb = CBKnapsack(action_set=ACTION_SET, n_features=4, beta=2.0)
    std = cb.predicted_reward_std(ActionKey.REWEIGH, np.array([0.5, 0.5, 0.5, 0.5]))
    assert std.shape == (4,)
    assert (std >= 0.0).all()
