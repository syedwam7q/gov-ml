"""Maximum Mean Discrepancy (MMD) drift detector for text embeddings.

Pure-numpy implementation of MMD² with an RBF kernel and a permutation
test for the p-value. We use this instead of `alibi-detect` because the
latter pulls heavy transitive deps and the math is simple.

Reference: Gretton et al. 2012, "A Kernel Two-Sample Test."
"""

from __future__ import annotations

from datetime import UTC, datetime

import numpy as np

from aegis_shared.schemas import DriftSignal
from aegis_shared.types import Severity

# Severity thresholds on the MMD p-value. Per the kernel two-sample test
# convention, p < 0.01 is "definitely drifted", < 0.05 is "moderate",
# < 0.10 is "weak signal."
_MMD_LOW_PVAL = 0.10
_MMD_MEDIUM_PVAL = 0.05
_MMD_HIGH_PVAL = 0.01


def _rbf_kernel(x: np.ndarray, y: np.ndarray, *, sigma: float) -> np.ndarray:
    """Compute the RBF kernel matrix K(i,j) = exp(-||x_i - y_j||^2 / (2 σ²))."""
    # Squared pairwise distances via the (a-b)² = a² - 2ab + b² identity.
    x2 = np.sum(x * x, axis=1)[:, np.newaxis]
    y2 = np.sum(y * y, axis=1)[np.newaxis, :]
    sq = x2 + y2 - 2.0 * (x @ y.T)
    sq = np.maximum(sq, 0.0)  # numerical floor
    return np.exp(-sq / (2.0 * sigma * sigma))


def _median_heuristic_sigma(combined: np.ndarray) -> float:
    """Median of pairwise distances — a robust default kernel bandwidth."""
    n = len(combined)
    if n < 2:
        return 1.0
    # Sample pairwise distances on a subset for speed.
    sample = combined[: min(n, 256)]
    diffs = sample[:, np.newaxis, :] - sample[np.newaxis, :, :]
    dists = np.sqrt(np.sum(diffs * diffs, axis=2))
    upper = dists[np.triu_indices_from(dists, k=1)]
    median = float(np.median(upper))
    return median if median > 0 else 1.0


def mmd_squared(
    reference: np.ndarray, current: np.ndarray, *, sigma: float | None = None
) -> tuple[float, float]:
    """Return (mmd², sigma_used). Both arrays are (n, d)."""
    combined = np.vstack([reference, current])
    s = sigma or _median_heuristic_sigma(combined)
    k_rr = _rbf_kernel(reference, reference, sigma=s)
    k_cc = _rbf_kernel(current, current, sigma=s)
    k_rc = _rbf_kernel(reference, current, sigma=s)
    mmd2 = float(k_rr.mean() - 2.0 * k_rc.mean() + k_cc.mean())
    return max(mmd2, 0.0), s


def mmd_pvalue(
    reference: np.ndarray,
    current: np.ndarray,
    *,
    n_permutations: int = 100,
    sigma: float | None = None,
    rng: np.random.Generator | None = None,
) -> tuple[float, float]:
    """Permutation-test p-value for MMD². Returns (mmd², p-value).

    Under the null (same distribution), permuting the labels should give
    a similar MMD². The p-value is the fraction of permuted MMDs that
    meet or exceed the observed MMD.
    """
    rng = rng or np.random.default_rng(1729)
    observed_mmd, s = mmd_squared(reference, current, sigma=sigma)
    combined = np.vstack([reference, current])
    n_ref = len(reference)
    extreme = 0
    for _ in range(n_permutations):
        idx = rng.permutation(len(combined))
        a = combined[idx[:n_ref]]
        b = combined[idx[n_ref:]]
        m, _ = mmd_squared(a, b, sigma=s)
        if m >= observed_mmd:
            extreme += 1
    p_value = (extreme + 1.0) / (n_permutations + 1.0)
    return observed_mmd, p_value


def _severity_from_pvalue(p_value: float) -> Severity | None:
    if p_value < _MMD_HIGH_PVAL:
        return Severity.HIGH
    if p_value < _MMD_MEDIUM_PVAL:
        return Severity.MEDIUM
    if p_value < _MMD_LOW_PVAL:
        return Severity.LOW
    return None


def detect_text_drift(
    *,
    model_id: str,
    reference_embeddings: np.ndarray,
    current_embeddings: np.ndarray,
    n_permutations: int = 100,
    observed_at: datetime | None = None,
) -> list[DriftSignal]:
    """MMD-based text drift detection on pre-computed embeddings.

    Embedding shape: (n_examples, embedding_dim). The detector emits a
    single signal whose severity comes from the permutation-test p-value.
    """
    ts = observed_at or datetime.now(UTC)
    if reference_embeddings.shape[0] < 2 or current_embeddings.shape[0] < 2:
        return []
    if reference_embeddings.shape[1] != current_embeddings.shape[1]:
        msg = (
            "reference and current embeddings must share dim — got "
            f"{reference_embeddings.shape[1]} vs {current_embeddings.shape[1]}"
        )
        raise ValueError(msg)
    mmd2, p = mmd_pvalue(reference_embeddings, current_embeddings, n_permutations=n_permutations)
    severity = _severity_from_pvalue(p)
    if severity is None:
        return []
    return [
        DriftSignal(
            model_id=model_id,
            metric="text_drift_mmd",
            value=mmd2,
            baseline=0.0,
            severity=severity,
            observed_at=ts,
            subgroup={"p_value": str(round(p, 6))},
        )
    ]
