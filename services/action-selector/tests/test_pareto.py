"""Tests for the Pareto-front extraction."""

from __future__ import annotations

import numpy as np
from aegis_action_selector.actions import ActionKey
from aegis_action_selector.pareto import pareto_front


def test_single_action_is_on_its_own_pareto_front() -> None:
    front = pareto_front({ActionKey.REWEIGH: np.array([0.1, 0.2])})
    assert front == {ActionKey.REWEIGH}


def test_strict_dominator_kicks_competitor_off() -> None:
    """RETRAIN strictly dominates ESCALATE on every dim → ESCALATE excluded."""
    candidates = {
        ActionKey.RETRAIN: np.array([0.30, 0.50, -0.10, -1.0]),
        ActionKey.ESCALATE: np.array([0.10, 0.30, -0.20, -1.5]),
    }
    front = pareto_front(candidates)
    assert front == {ActionKey.RETRAIN}


def test_two_non_dominated_actions_both_on_front() -> None:
    """Each action wins on a different dim → both Pareto-optimal."""
    candidates = {
        ActionKey.REWEIGH: np.array([0.10, 0.50, -0.05, -0.40]),  # high fairness
        ActionKey.RETRAIN: np.array([0.30, 0.05, -0.20, -3.80]),  # high accuracy
    }
    front = pareto_front(candidates)
    assert front == {ActionKey.REWEIGH, ActionKey.RETRAIN}
