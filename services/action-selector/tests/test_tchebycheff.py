"""Tests for the Tchebycheff scalarization baseline."""

from __future__ import annotations

import numpy as np
import pytest
from aegis_action_selector.actions import ActionKey
from aegis_action_selector.tchebycheff import sweep_pareto_front, tchebycheff_choose


def test_tchebycheff_picks_dominant_action() -> None:
    candidates = {
        ActionKey.REWEIGH: np.array([0.10, 0.20, -0.05, -0.40]),
        ActionKey.RETRAIN: np.array([-1.0, -1.0, -1.0, -1.0]),
    }
    weights = np.array([0.25, 0.25, 0.25, 0.25])
    ideal = np.array([0.0, 0.0, 0.0, 0.0])
    chosen = tchebycheff_choose(candidates, weights, ideal)
    assert chosen == ActionKey.REWEIGH


def test_tchebycheff_rejects_non_simplex_weights() -> None:
    candidates = {ActionKey.REWEIGH: np.array([0.1, 0.2])}
    bad_weights = np.array([0.5, 0.6])  # sums to 1.1
    with pytest.raises(ValueError, match="weights must sum"):
        tchebycheff_choose(candidates, bad_weights, np.zeros(2))


def test_sweep_returns_pareto_front() -> None:
    candidates = {
        ActionKey.REWEIGH: np.array([0.10, 0.50, -0.05, -0.40]),
        ActionKey.RETRAIN: np.array([0.30, 0.05, -0.20, -3.80]),
    }
    ideal = np.array([0.4, 0.6, 0.0, 0.0])
    chosen = sweep_pareto_front(candidates, ideal, n_weight_samples=100)
    # At least one of the two should appear; both should be choosable
    # under different weight regions.
    assert chosen <= {ActionKey.REWEIGH, ActionKey.RETRAIN}
    assert len(chosen) >= 1
