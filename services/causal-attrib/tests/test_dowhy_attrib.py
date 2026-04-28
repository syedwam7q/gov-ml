"""Tests for the DoWhy GCM wrapper.

Marked `slow` because DoWhy's auto-mechanism assignment + fit + Shapley
permutation takes 5–30 seconds depending on dataset shape. The default
test-suite excludes them; CI runs them on a separate target.
"""

from __future__ import annotations

import time
from pathlib import Path

import pandas as pd
import pytest
from aegis_causal_attrib.dag_loader import load_dag_for_model
from aegis_causal_attrib.dowhy_attrib import (
    AttributionTimeoutError,
    DoWhyAttributionResult,
    clear_cache,
    run_dowhy_attribution,
)

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture(autouse=True)
def _clear_cache_between_tests() -> None:
    clear_cache()


@pytest.mark.slow
def test_dowhy_returns_shapley_per_node(
    credit_reference_frame: pd.DataFrame,
    credit_current_frame_with_drift: pd.DataFrame,
) -> None:
    """Target the continuous `income` node — directly affected by the
    induced co_applicant_present | applicant_sex shift, with strong
    enough effect size for DoWhy's auto-assigned mechanisms to detect."""
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    res = run_dowhy_attribution(
        model_id="credit-v1",
        spec=spec,
        reference=credit_reference_frame.head(2_000),
        current=credit_current_frame_with_drift.head(2_000),
        target_node="income",
        timeout_s=120.0,
        num_samples=200,
    )
    assert isinstance(res, DoWhyAttributionResult)
    # DoWhy returns Shapley values for ancestors of the target node only —
    # downstream nodes can't have caused the upstream change. The target
    # itself is included (its own conditional mechanism may have shifted).
    nx_dag = spec.to_networkx()
    import networkx as nx  # noqa: PLC0415

    expected_nodes = set(nx.ancestors(nx_dag, "income")) | {"income"}
    assert set(res.shapley.keys()) == expected_nodes, (
        f"shapley keys={set(res.shapley.keys())} expected={expected_nodes}"
    )
    # The induced shift is on co_applicant_present (conditioned on sex)
    # which directly modulates income. Dominant cause should be one of
    # the upstream-of-income nodes whose distribution moved.
    assert res.dominant_cause in {
        "co_applicant_present",
        "applicant_sex",
        "income",  # if DoWhy attributes to the target's own conditional
    }, f"dominant cause={res.dominant_cause!r}; full shapley={res.shapley}"


@pytest.mark.slow
def test_dowhy_timeout_raises(
    credit_reference_frame: pd.DataFrame,
    credit_current_frame_with_drift: pd.DataFrame,
) -> None:
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    with pytest.raises(AttributionTimeoutError):
        run_dowhy_attribution(
            model_id="credit-v1",
            spec=spec,
            reference=credit_reference_frame.head(800),
            current=credit_current_frame_with_drift.head(800),
            target_node="approval",
            timeout_s=0.001,
            num_samples=10,
        )


@pytest.mark.slow
def test_dowhy_cache_hit_is_fast(
    credit_reference_frame: pd.DataFrame,
    credit_current_frame_with_drift: pd.DataFrame,
) -> None:
    """Identical inputs hit the cache; second call returns near-instantly."""
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    kwargs = {
        "model_id": "credit-v1",
        "spec": spec,
        "reference": credit_reference_frame.head(500),
        "current": credit_current_frame_with_drift.head(500),
        "target_node": "approval",
        "timeout_s": 120.0,
        "num_samples": 100,
    }
    t0 = time.perf_counter()
    a = run_dowhy_attribution(**kwargs)  # type: ignore[arg-type]
    t1 = time.perf_counter()
    b = run_dowhy_attribution(**kwargs)  # type: ignore[arg-type]
    t2 = time.perf_counter()
    assert a.shapley == b.shapley
    # Cache hit should be at least 5x faster than the cold run.
    assert (t2 - t1) * 5 < (t1 - t0), f"cold={t1 - t0:.3f}s warm={t2 - t1:.3f}s"
