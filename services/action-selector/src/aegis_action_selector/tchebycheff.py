"""Tchebycheff scalarization baseline (Miettinen 1999).

For weight vector w over the 4 reward dimensions:
    a* = argmax_a min_i w_i · (r_i(a) − r_i*)

where r_i* is the ideal point per dimension. Sweeping w through the
weight simplex traces the Pareto front. No online adaptation — pure
offline scalarization. This is the paper's baseline reference.
"""

from __future__ import annotations

import numpy as np

from aegis_action_selector.actions import ActionKey


def tchebycheff_choose(
    candidates: dict[ActionKey, np.ndarray],
    weights: np.ndarray,
    ideal_point: np.ndarray,
) -> ActionKey:
    """Choose the action that maximises the min-weighted distance from
    the ideal point in the 4-dim reward space."""
    if abs(weights.sum() - 1.0) > 1e-9:
        msg = f"weights must sum to 1.0, got {weights.sum()}"
        raise ValueError(msg)
    best_action: ActionKey | None = None
    best_value = -np.inf
    for action, reward in candidates.items():
        value = float(np.min(weights * (reward - ideal_point)))
        if value > best_value:
            best_value = value
            best_action = action
    if best_action is None:
        msg = "no candidates provided"
        raise ValueError(msg)
    return best_action


def sweep_pareto_front(
    candidates: dict[ActionKey, np.ndarray],
    ideal_point: np.ndarray,
    n_weight_samples: int = 50,
    rng: np.random.Generator | None = None,
) -> set[ActionKey]:
    """Sweep weight simplex via Dirichlet samples; return set of chosen actions."""
    rng = rng or np.random.default_rng(0)
    chosen: set[ActionKey] = set()
    n_dim = len(ideal_point)
    for _ in range(n_weight_samples):
        weights = rng.dirichlet(np.ones(n_dim))
        chosen.add(tchebycheff_choose(candidates, weights, ideal_point))
    return chosen
