"""Tests for the DBShap fallback (Edakunni 2024)."""

from __future__ import annotations

import time

import numpy as np
import pandas as pd
from aegis_causal_attrib.dbshap import DBShapResult, feature_wasserstein, run_dbshap


def test_dbshap_attributes_drifted_feature() -> None:
    rng = np.random.default_rng(0)
    n = 1_500
    a_ref = rng.normal(0.0, 1.0, n)
    b_ref = rng.normal(0.0, 1.0, n)
    y_ref = (0.5 * a_ref + 0.3 * b_ref + rng.normal(0.0, 0.1, n) > 0).astype(int)
    ref = pd.DataFrame({"a": a_ref, "b": b_ref, "y": y_ref})
    a_cur = rng.normal(1.0, 1.0, n)
    y_cur = (0.5 * a_cur + 0.3 * b_ref + rng.normal(0.0, 0.1, n) > 0).astype(int)
    cur = pd.DataFrame({"a": a_cur, "b": b_ref, "y": y_cur})

    res = run_dbshap(reference=ref, current=cur, target_column="y", num_samples=512)
    assert isinstance(res, DBShapResult)
    assert set(res.shapley.keys()) == {"a", "b"}
    assert abs(res.shapley["a"]) > abs(res.shapley["b"]), "feature a drifted, b did not"
    assert res.dominant_cause == "a"


def test_dbshap_runs_under_5_seconds() -> None:
    """Spec §12.1: DBShap is the cheap fallback. Stay under 5 s for ~5,000 rows."""
    rng = np.random.default_rng(1)
    n = 5_000
    df = pd.DataFrame(
        {"a": rng.normal(0.0, 1.0, n), "b": rng.normal(0.0, 1.0, n), "y": rng.integers(0, 2, n)}
    )
    df2 = df.copy()
    df2["a"] = rng.normal(1.0, 1.0, n)
    t0 = time.perf_counter()
    run_dbshap(reference=df, current=df2, target_column="y", num_samples=1_024)
    elapsed = time.perf_counter() - t0
    assert elapsed < 5.0, f"DBShap took {elapsed:.2f}s; budget 5s"


def test_dbshap_target_delta_matches_metric_difference() -> None:
    rng = np.random.default_rng(2)
    n = 1_000
    ref = pd.DataFrame({"a": rng.normal(0, 1, n), "y": rng.integers(0, 2, n)})
    cur = pd.DataFrame({"a": rng.normal(0, 1, n), "y": np.ones(n, dtype=int)})

    res = run_dbshap(reference=ref, current=cur, target_column="y", num_samples=64)
    assert abs(res.target_delta - (1.0 - ref["y"].mean())) < 1e-9


def test_dbshap_raises_with_no_features() -> None:
    import pytest

    df = pd.DataFrame({"y": [0, 1, 0, 1]})
    with pytest.raises(ValueError, match="at least one non-target column"):
        run_dbshap(reference=df, current=df, target_column="y", num_samples=10)


def test_feature_wasserstein_zero_when_distributions_match() -> None:
    rng = np.random.default_rng(3)
    n = 500
    df = pd.DataFrame({"a": rng.normal(0, 1, n), "b": rng.normal(0, 1, n)})
    distances = feature_wasserstein(df, df.copy())
    assert distances["a"] < 1e-9
    assert distances["b"] < 1e-9


def test_feature_wasserstein_positive_when_distributions_shift() -> None:
    rng = np.random.default_rng(4)
    n = 500
    ref = pd.DataFrame({"a": rng.normal(0, 1, n)})
    cur = pd.DataFrame({"a": rng.normal(2, 1, n)})  # mean shift
    distances = feature_wasserstein(ref, cur)
    assert distances["a"] > 1.0
