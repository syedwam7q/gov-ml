"""Conjugate-Gaussian Bayesian linear regression.

Posterior:  Λ_a = α · I + β · Σ_t x_t x_t^T   (precision matrix)
            μ_a = β · Σ_a · Σ_t x_t · r_t

Closed-form, per-action. UCB bonus is `β_ucb · √(x^T · Σ_a · x)` —
the predictive standard deviation, scaled by an exploration constant.

References:
  Bishop (2006) §3.3 — Bayesian linear regression.
  Abbasi-Yadkori et al. (2011) — "Improved algorithms for linear
    stochastic bandits" (UCB1-Lin).
  Russo & Van Roy (2014) — Posterior sampling alternative.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class BayesianLinearRegression:
    """Closed-form per-(action, reward dim) Gaussian regressor."""

    n_features: int
    alpha_prior: float = 1.0
    """Precision of the prior on weights — `α · I`. Higher → tighter prior."""

    beta_prior: float = 1.0
    """Precision of the noise model. Higher → trust observations more."""

    _precision: np.ndarray = field(init=False)
    _mean_times_precision: np.ndarray = field(init=False)

    def __post_init__(self) -> None:
        self._precision = self.alpha_prior * np.eye(self.n_features)
        self._mean_times_precision = np.zeros(self.n_features)

    @property
    def covariance(self) -> np.ndarray:
        return np.linalg.inv(self._precision)

    @property
    def mean(self) -> np.ndarray:
        return self.covariance @ self._mean_times_precision

    def update(self, x: np.ndarray, r: float) -> None:
        x = np.asarray(x, dtype=float)
        self._precision = self._precision + self.beta_prior * np.outer(x, x)
        self._mean_times_precision = self._mean_times_precision + self.beta_prior * r * x

    def predict_mean(self, x: np.ndarray) -> float:
        return float(np.asarray(x, dtype=float) @ self.mean)

    def predict_std(self, x: np.ndarray) -> float:
        x = np.asarray(x, dtype=float)
        var = float(x @ self.covariance @ x)
        return float(np.sqrt(max(0.0, var)))

    def ucb_bonus(self, x: np.ndarray, beta: float) -> float:
        """β × predictive std deviation. Spec §12.2."""
        return beta * self.predict_std(x)

    # ──────────── Persistence accessors ────────────
    #
    # The Phase 8 Redis-backed persistence module needs to round-trip
    # the posterior. Rather than crack open the leading-underscore
    # internals, we expose dedicated public accessors so the
    # `reportPrivateUsage` discipline holds elsewhere.

    @property
    def precision_matrix(self) -> np.ndarray:
        """Read the posterior precision matrix Λ (shape: n_features²)."""
        return self._precision

    @property
    def mean_x_precision(self) -> np.ndarray:
        """Read μᵀΛ (the unscaled mean-times-precision vector)."""
        return self._mean_times_precision

    def restore_state(self, *, precision: np.ndarray, mean_times_precision: np.ndarray) -> None:
        """Replace the posterior with externally-supplied state.

        Used by `persistence.py` after a Redis cache hit. Expects
        `precision` of shape (n_features, n_features) and
        `mean_times_precision` of shape (n_features,).
        """
        self._precision = np.asarray(precision, dtype=float)
        self._mean_times_precision = np.asarray(mean_times_precision, dtype=float)
