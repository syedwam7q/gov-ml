"""Tests for the MMD drift detector."""

from __future__ import annotations

import numpy as np
from aegis_detect_text.mmd import (
    detect_text_drift,
    mmd_pvalue,
    mmd_squared,
)

from aegis_shared.types import Severity


def _gaussian(n: int, dim: int, mean: float = 0.0, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.normal(mean, 1.0, size=(n, dim)).astype(np.float32)


def test_mmd_squared_is_zero_for_same_distribution() -> None:
    a = _gaussian(200, 16, mean=0.0, seed=0)
    b = _gaussian(200, 16, mean=0.0, seed=1)
    mmd2, _sigma = mmd_squared(a, b)
    assert mmd2 < 0.05


def test_mmd_squared_is_positive_for_different_distributions() -> None:
    a = _gaussian(200, 16, mean=0.0, seed=0)
    b = _gaussian(200, 16, mean=3.0, seed=1)
    mmd2, _sigma = mmd_squared(a, b)
    assert mmd2 > 0.1


def test_mmd_pvalue_high_under_null() -> None:
    a = _gaussian(150, 8, mean=0.0, seed=0)
    b = _gaussian(150, 8, mean=0.0, seed=1)
    _mmd2, p = mmd_pvalue(a, b, n_permutations=100)
    # Under the null, p should be roughly uniform; we're permissive — > 0.05 is fine.
    assert p > 0.05


def test_mmd_pvalue_low_under_alternative() -> None:
    a = _gaussian(150, 8, mean=0.0, seed=0)
    b = _gaussian(150, 8, mean=2.5, seed=1)
    _mmd2, p = mmd_pvalue(a, b, n_permutations=100)
    assert p < 0.05


def test_detect_text_drift_no_signal_under_null() -> None:
    a = _gaussian(150, 16, mean=0.0, seed=0)
    b = _gaussian(150, 16, mean=0.0, seed=1)
    signals = detect_text_drift(
        model_id="toxicity-v3",
        reference_embeddings=a,
        current_embeddings=b,
        n_permutations=100,
    )
    assert signals == []


def test_detect_text_drift_emits_high_severity_under_alternative() -> None:
    a = _gaussian(150, 16, mean=0.0, seed=0)
    b = _gaussian(150, 16, mean=3.0, seed=1)
    signals = detect_text_drift(
        model_id="toxicity-v3",
        reference_embeddings=a,
        current_embeddings=b,
        n_permutations=100,
    )
    assert len(signals) == 1
    sig = signals[0]
    assert sig.metric == "text_drift_mmd"
    assert sig.severity == Severity.HIGH
    assert "p_value" in (sig.subgroup or {})


def test_detect_text_drift_handles_dim_mismatch() -> None:
    a = _gaussian(50, 16, seed=0)
    b = _gaussian(50, 32, seed=1)
    import pytest

    with pytest.raises(ValueError, match="dim"):
        detect_text_drift(
            model_id="toxicity-v3",
            reference_embeddings=a,
            current_embeddings=b,
        )


def test_detect_text_drift_returns_empty_on_tiny_input() -> None:
    a = _gaussian(1, 8, seed=0)
    b = _gaussian(1, 8, seed=1)
    signals = detect_text_drift(
        model_id="toxicity-v3",
        reference_embeddings=a,
        current_embeddings=b,
    )
    assert signals == []
