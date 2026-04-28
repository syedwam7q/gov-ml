"""Spec §12.1 efficiency identity — the load-bearing paper claim.

For DBShap with a model-based target metric:

    Σ_i φ_i ≈ v(N) − v(∅) = mean(model.predict(D_cur)) − mean(model.predict(D_ref))

Within a Monte-Carlo tolerance set by the permutation budget. This is
CI-merge-blocking: the paper claim and the code must stay in sync.

We test efficiency against the **model-prediction delta**, not the raw
target_delta (which is mean(Y_cur) − mean(Y_ref)). Model-prediction
delta is what DBShap's coalition-value function actually decomposes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from aegis_causal_attrib.dbshap import run_dbshap
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from sklearn.linear_model import Ridge


def _model_prediction_delta(reference: pd.DataFrame, current: pd.DataFrame, target: str) -> float:
    """Compute v(N) − v(∅) under the same model DBShap uses internally."""
    features = [c for c in reference.columns if c != target]
    x_ref = reference[features].to_numpy().astype(float)
    y_ref = reference[target].to_numpy().astype(float)
    model = Ridge(alpha=1.0)
    model.fit(x_ref, y_ref)
    v_full = float(model.predict(current[features].to_numpy().astype(float)).mean())
    v_empty = float(model.predict(x_ref).mean())
    return v_full - v_empty


@settings(
    deadline=None,
    max_examples=8,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture],
)
@given(
    seed=st.integers(min_value=0, max_value=10_000),
    drift_strength=st.floats(min_value=0.3, max_value=2.0),
)
def test_dbshap_satisfies_efficiency_identity(seed: int, drift_strength: float) -> None:
    """Σ φ_i ≈ v(N) − v(∅) within Monte-Carlo tolerance."""
    rng = np.random.default_rng(seed)
    n = 1_500
    a_ref = rng.normal(0.0, 1.0, n)
    b_ref = rng.normal(0.0, 1.0, n)
    y_ref = 0.5 * a_ref + 0.3 * b_ref + rng.normal(0.0, 0.1, n)
    ref = pd.DataFrame({"a": a_ref, "b": b_ref, "y": y_ref})
    a_cur = rng.normal(drift_strength, 1.0, n)
    y_cur = 0.5 * a_cur + 0.3 * b_ref + rng.normal(0.0, 0.1, n)
    cur = pd.DataFrame({"a": a_cur, "b": b_ref, "y": y_cur})

    res = run_dbshap(reference=ref, current=cur, target_column="y", num_samples=512)
    summed = sum(res.shapley.values())
    expected = _model_prediction_delta(ref, cur, "y")

    # Monte-Carlo tolerance: 15% of |expected| or 0.05 absolute, whichever larger.
    tol = max(0.05, 0.15 * abs(expected))
    assert abs(summed - expected) < tol, (
        f"Σφ={summed:.4f} vs expected v(N)-v(∅)={expected:.4f} (tol {tol:.4f}); "
        f"shapley={res.shapley}"
    )
