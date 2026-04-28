"""DBShap — distribution-Shapley fallback.

Reference: Edakunni et al., arXiv:2401.09756 (2024).

For each feature i:

    φ_i = (1/|N|!) · Σ_π [v(S_π,i ∪ {i}) − v(S_π,i)]

where v(S) is the target metric obtained by *swapping* the marginal
distribution of features in S from D_ref to D_cur (others held at
D_ref).

**Metric.** The target metric on a coalition's swapped frame is the
prediction of a *reference* model trained once on (X_ref → Y_ref).
This is the right notion of "what does Y look like under this X
distribution?" because mean(Y) on a feature-swapped frame is constant
when Y is fixed (Y doesn't get swapped). Following Edakunni et al. §4.2
we fit a fast Ridge regressor on the reference and evaluate
`mean(predict(X_swapped))` — this responds correctly to feature shifts.

Used by `services/causal-attrib` as the fallback when DoWhy GCM
times out, fails, or no DAG is available for the model.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.stats import wasserstein_distance
from sklearn.linear_model import Ridge


@dataclass(frozen=True)
class DBShapResult:
    """The output of one DBShap run."""

    shapley: dict[str, float]
    dominant_cause: str
    target_column: str
    target_delta: float


def _swap_marginal(
    base: pd.DataFrame,
    donor: pd.DataFrame,
    columns: list[str],
    rng: np.random.Generator,
) -> pd.DataFrame:
    """Return a copy of `base` with `columns` resampled from `donor`'s marginals."""
    out = base.copy()
    n = len(out)
    donor_n = len(donor)
    for col in columns:
        idx = rng.integers(0, donor_n, size=n)
        out[col] = donor[col].to_numpy()[idx]
    return out


def _fit_reference_model(reference: pd.DataFrame, target: str) -> tuple[Ridge, list[str]]:
    """Fit a Ridge regressor on (X_ref, Y_ref). Returns (model, feature_order)."""
    features = [c for c in reference.columns if c != target]
    x_matrix = reference[features].to_numpy().astype(float)
    y_vector = reference[target].to_numpy().astype(float)
    model = Ridge(alpha=1.0)
    model.fit(x_matrix, y_vector)
    return model, features


def _model_metric(model: Ridge, features: list[str], frame: pd.DataFrame) -> float:
    """Mean of the reference-model's prediction on `frame[features]`."""
    x_matrix = frame[features].to_numpy().astype(float)
    return float(model.predict(x_matrix).mean())


def run_dbshap(
    *,
    reference: pd.DataFrame,
    current: pd.DataFrame,
    target_column: str,
    num_samples: int = 2_048,
    rng: np.random.Generator | None = None,
) -> DBShapResult:
    """Compute distribution-Shapley contributions over the feature set.

    The Shapley sum is approximated by Monte-Carlo permutation sampling
    (`num_samples` permutations). Target metric is the **reference model's
    mean prediction** on the swapped frame — see module docstring.
    """
    rng = rng or np.random.default_rng(0)
    features = [c for c in reference.columns if c != target_column]
    if len(features) == 0:
        raise ValueError("at least one non-target column required")

    model, feature_order = _fit_reference_model(reference, target_column)

    n_features = len(features)
    contributions: dict[str, float] = dict.fromkeys(features, 0.0)

    # The actual change in mean(Y) we observe between current and reference.
    target_delta = float(current[target_column].mean() - reference[target_column].mean())

    # Reference-model prediction on the reference frame — the v(∅) baseline.
    v_empty = _model_metric(model, feature_order, reference)

    for _ in range(num_samples):
        perm = list(rng.permutation(n_features))
        prefix: list[str] = []
        prev_value = v_empty
        for idx in perm:
            feature = features[idx]
            prefix.append(feature)
            swapped = _swap_marginal(reference, current, prefix, rng)
            new_value = _model_metric(model, feature_order, swapped)
            contributions[feature] += new_value - prev_value
            prev_value = new_value

    for feature in features:
        contributions[feature] /= num_samples

    dominant = max(contributions.items(), key=lambda kv: abs(kv[1]))[0]
    return DBShapResult(
        shapley=contributions,
        dominant_cause=dominant,
        target_column=target_column,
        target_delta=target_delta,
    )


def feature_wasserstein(reference: pd.DataFrame, current: pd.DataFrame) -> dict[str, float]:
    """Per-feature Wasserstein-1 between reference and current marginals."""
    out: dict[str, float] = {}
    for col in reference.columns:
        if not math.isfinite(reference[col].mean()):
            continue
        out[col] = float(wasserstein_distance(reference[col].to_numpy(), current[col].to_numpy()))
    return out
