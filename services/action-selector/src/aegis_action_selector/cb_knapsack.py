"""Contextual bandits with knapsacks (CB-Knapsack).

Reference: Slivkins, Sankararaman & Foster, JMLR vol 25 paper 24-1220
(2024). Spec §12.2.

Per-step decision:
    a* = argmax_a { r̂(x, a) − λᵀ ĉ(x, a) + UCB_bonus(x, a) + α·1{a == prior} }

Dual update (after observing reward + cost):
    λ ← max(0, λ + η · (ĉ_t − budget / horizon_remaining))

We maintain one BLR per (action, reward dim) — 8 actions × 4 reward
dims = 32 oracles. Cost regressors are likewise per (action, cost dim).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from aegis_action_selector.actions import ActionKey, CostVector
from aegis_action_selector.blr import BayesianLinearRegression


@dataclass
class CBKnapsack:
    """Stateful CB-Knapsack policy. Persisted via `persistence.py`."""

    action_set: dict[ActionKey, CostVector]
    n_features: int
    beta: float = 2.0
    """UCB exploration constant. Spec §12.2."""

    eta: float = 0.05
    """Dual-update step size."""

    prior_strength: float = 0.5
    """Boost added to the recommended_action's score (Phase 6 → Phase 7 prior)."""

    n_reward_dims: int = 4  # (Δacc, Δfair, −Δlatency, −Δcost)
    n_cost_dims: int = 4  # (latency, dollar, traffic, risk)

    reward_oracles: dict[ActionKey, list[BayesianLinearRegression]] = field(
        default_factory=lambda: {}
    )
    cost_oracles: dict[ActionKey, list[BayesianLinearRegression]] = field(
        default_factory=lambda: {}
    )
    lambda_dual: np.ndarray = field(default_factory=lambda: np.zeros(4))

    def __post_init__(self) -> None:
        for action in self.action_set:
            self.reward_oracles[action] = [
                BayesianLinearRegression(self.n_features) for _ in range(self.n_reward_dims)
            ]
            self.cost_oracles[action] = [
                BayesianLinearRegression(self.n_features) for _ in range(self.n_cost_dims)
            ]

    # ──────────── Decision ────────────

    def choose_action(
        self,
        context: np.ndarray,
        *,
        recommended_action: ActionKey | None = None,
    ) -> tuple[ActionKey, dict[ActionKey, float]]:
        """Pick the action that maximises (UCB-augmented Lagrangian + prior)."""
        scores: dict[ActionKey, float] = {}
        for action in self.action_set:
            r_hat = sum(oracle.predict_mean(context) for oracle in self.reward_oracles[action])
            c_hat = np.array([oracle.predict_mean(context) for oracle in self.cost_oracles[action]])
            ucb = sum(
                oracle.ucb_bonus(context, self.beta) for oracle in self.reward_oracles[action]
            )
            score = r_hat - float(self.lambda_dual @ c_hat) + ucb
            if recommended_action is not None and action == recommended_action:
                score += self.prior_strength
            scores[action] = score
        chosen = max(scores, key=scores.__getitem__)
        return chosen, scores

    def predicted_reward(self, action: ActionKey, context: np.ndarray) -> np.ndarray:
        """Per-dim mean reward — shape (n_reward_dims,)."""
        return np.array([oracle.predict_mean(context) for oracle in self.reward_oracles[action]])

    def predicted_reward_std(self, action: ActionKey, context: np.ndarray) -> np.ndarray:
        """Per-dim posterior std — shape (n_reward_dims,)."""
        return np.array([oracle.predict_std(context) for oracle in self.reward_oracles[action]])

    # ──────────── Update ────────────

    def update(
        self,
        action: ActionKey,
        *,
        context: np.ndarray,
        reward_vector: np.ndarray,
        observed_cost_vector: np.ndarray,
        budget: np.ndarray,
        horizon_remaining: int,
    ) -> None:
        """Update reward + cost oracles, then update Lagrangian dual."""
        for i, r in enumerate(reward_vector):
            self.reward_oracles[action][i].update(context, float(r))
        for i, c in enumerate(observed_cost_vector):
            self.cost_oracles[action][i].update(context, float(c))
        # Projected-gradient dual update (spec §12.2).
        diff = observed_cost_vector - budget / max(1, horizon_remaining)
        self.lambda_dual = np.maximum(0.0, self.lambda_dual + self.eta * diff)
