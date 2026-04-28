"""DoWhy GCM wrapper with hard timeout + content-hashed cache.

The cache keys on a SHA-256 fingerprint of (model_id, target_node,
num_samples, sorted column names, and the byte-content of each column
array). DoWhy is imported lazily so the cold-start path stays fast —
booting the FastAPI app doesn't pull in pgmpy / statsmodels / numba.

Cache values are the structured `DoWhyAttributionResult` dataclass —
frozen, no serialization round-trip required.
"""

from __future__ import annotations

import concurrent.futures
import hashlib
from dataclasses import dataclass

import numpy as np
import pandas as pd

from aegis_causal_attrib.dag_loader import DAGSpec


class AttributionTimeoutError(TimeoutError):
    """Raised when DoWhy GCM exceeds the configured timeout."""


class AttributionRuntimeError(RuntimeError):
    """Raised when DoWhy GCM throws (e.g. degenerate variance)."""


@dataclass(frozen=True)
class DoWhyAttributionResult:
    """The output of one `distribution_change` call."""

    shapley: dict[str, float]
    dominant_cause: str
    target_node: str
    target_delta: float


def _frame_fingerprint(frame: pd.DataFrame) -> str:
    """Order-independent SHA-256 fingerprint of a frame's contents."""
    h = hashlib.sha256()
    for col in sorted(frame.columns):
        arr = frame[col].to_numpy()
        h.update(col.encode("utf-8"))
        h.update(np.ascontiguousarray(arr).tobytes())
    return h.hexdigest()


# Module-level cache. We accept the simplicity of a dict for an 8–9
# month research project; if memory becomes an issue, swap for
# `cachetools.LRUCache(maxsize=settings.cache_size)`.
_CACHE: dict[str, DoWhyAttributionResult] = {}


def _cache_key(
    model_id: str,
    target_node: str,
    num_samples: int,
    ref_fp: str,
    cur_fp: str,
) -> str:
    return f"{model_id}|{target_node}|{num_samples}|{ref_fp}|{cur_fp}"


def _compute_dowhy(
    spec: DAGSpec,
    reference: pd.DataFrame,
    current: pd.DataFrame,
    target_node: str,
    num_samples: int,
) -> DoWhyAttributionResult:
    """Inner compute — imported lazily so cold-start stays fast."""
    import dowhy.gcm as gcm  # noqa: PLC0415

    model = gcm.StructuralCausalModel(spec.to_networkx())
    gcm.auto.assign_causal_mechanisms(model, reference)
    gcm.fit(model, reference)

    contributions = gcm.distribution_change(
        model,
        old_data=reference,
        new_data=current,
        target_node=target_node,
        num_samples=num_samples,
    )
    shapley = {str(k): float(v) for k, v in contributions.items()}
    dominant = max(shapley.items(), key=lambda kv: abs(kv[1]))[0]
    target_delta = float(current[target_node].mean() - reference[target_node].mean())
    return DoWhyAttributionResult(
        shapley=shapley,
        dominant_cause=dominant,
        target_node=target_node,
        target_delta=target_delta,
    )


def run_dowhy_attribution(
    *,
    model_id: str,
    spec: DAGSpec,
    reference: pd.DataFrame,
    current: pd.DataFrame,
    target_node: str,
    timeout_s: float,
    num_samples: int = 1_000,
) -> DoWhyAttributionResult:
    """Run DoWhy GCM `distribution_change` with timeout + cache.

    Raises:
      AttributionTimeoutError if the run exceeds `timeout_s`.
      AttributionRuntimeError on DoWhy errors.
    """
    ref_fp = _frame_fingerprint(reference)
    cur_fp = _frame_fingerprint(current)
    key = _cache_key(model_id, target_node, num_samples, ref_fp, cur_fp)
    if key in _CACHE:
        return _CACHE[key]

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(_compute_dowhy, spec, reference, current, target_node, num_samples)
        try:
            result = fut.result(timeout=timeout_s)
        except concurrent.futures.TimeoutError as exc:
            raise AttributionTimeoutError(
                f"DoWhy GCM exceeded timeout_s={timeout_s} for model_id={model_id}"
            ) from exc
        except Exception as exc:
            raise AttributionRuntimeError(f"DoWhy GCM failed: {exc!r}") from exc

    _CACHE[key] = result
    return result


def clear_cache() -> None:
    """Drop the in-process cache. Used by tests + ops scripts."""
    _CACHE.clear()
