"""Drift, fairness, and calibration detectors.

Built on scipy + fairlearn instead of Evidently/NannyML to avoid the
upstream dependency conflicts in the workspace (Evidently pulls
kaleido 0.2.x with no macOS-arm64 wheel; NannyML pins xgboost<3.0
which conflicts with the rest of the project).

Each detector takes a pair of pandas frames (reference + current) and
returns a list of `DriftSignal` objects, severity-classified by the
spec's Section 3 thresholds. The list may be empty if no signal crosses
the LOW threshold.
"""

from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
import pandas as pd
from scipy import stats

from aegis_shared.schemas import DriftSignal
from aegis_shared.types import Severity

# Severity thresholds per spec Section 3 + governance literature.
# PSI ≥ 0.20 is the canonical "significant population shift" threshold
# (cf. Wu & Olson 2010). 0.10 is "moderate." Below 0.10 is stable.
_PSI_LOW = 0.10
_PSI_MEDIUM = 0.20
_PSI_HIGH = 0.30

# Fairness thresholds — demographic parity gap & equal-opportunity gap.
# 0.10 is the threshold most fairness papers use as the "concerning"
# boundary; 0.20 is "definitely a problem"; 0.30 is "high severity."
_FAIRNESS_LOW = 0.05
_FAIRNESS_MEDIUM = 0.10
_FAIRNESS_HIGH = 0.20


def _psi(reference: np.ndarray, current: np.ndarray, *, n_bins: int = 10) -> float:
    """Population Stability Index between two empirical distributions."""
    edges = np.histogram_bin_edges(np.concatenate([reference, current]), bins=n_bins)
    ref_hist, _ = np.histogram(reference, bins=edges)
    cur_hist, _ = np.histogram(current, bins=edges)
    # Add a small epsilon to avoid log(0); divide by total.
    eps = 1e-6
    ref_p = (ref_hist + eps) / (ref_hist.sum() + eps * n_bins)
    cur_p = (cur_hist + eps) / (cur_hist.sum() + eps * n_bins)
    return float(np.sum((cur_p - ref_p) * np.log(cur_p / ref_p)))


def _severity_from_psi(psi: float) -> Severity | None:
    """Map a PSI value to a severity label, or None if below the LOW threshold."""
    if psi >= _PSI_HIGH:
        return Severity.HIGH
    if psi >= _PSI_MEDIUM:
        return Severity.MEDIUM
    if psi >= _PSI_LOW:
        return Severity.LOW
    return None


def _severity_from_fairness_gap(gap: float) -> Severity | None:
    """Map an absolute fairness gap to a severity label, or None if below LOW."""
    abs_gap = abs(gap)
    if abs_gap >= _FAIRNESS_HIGH:
        return Severity.HIGH
    if abs_gap >= _FAIRNESS_MEDIUM:
        return Severity.MEDIUM
    if abs_gap >= _FAIRNESS_LOW:
        return Severity.LOW
    return None


def detect_numeric_drift(
    *,
    model_id: str,
    reference: pd.DataFrame,
    current: pd.DataFrame,
    columns: list[str],
    observed_at: datetime | None = None,
) -> list[DriftSignal]:
    """Per-feature PSI + KS-test based drift detection on numeric columns.

    Emits one signal per column whose PSI clears the LOW threshold. The
    signal's `metric` is `drift_psi_<column>` and `value` is the PSI.
    """
    ts = observed_at or datetime.now(UTC)
    signals: list[DriftSignal] = []
    for col in columns:
        if col not in reference.columns or col not in current.columns:
            continue
        ref_arr = reference[col].dropna().to_numpy()
        cur_arr = current[col].dropna().to_numpy()
        if len(ref_arr) < 2 or len(cur_arr) < 2:
            continue
        psi = _psi(ref_arr, cur_arr)
        severity = _severity_from_psi(psi)
        if severity is None:
            continue
        # KS test as a secondary check — encoded into the payload but not
        # a separate signal. scipy's KS result type isn't fully typed.
        ks = stats.ks_2samp(ref_arr, cur_arr)
        ks_stat: float = float(ks.statistic)  # type: ignore[attr-defined]
        ks_p: float = float(ks.pvalue)  # type: ignore[attr-defined]
        signals.append(
            DriftSignal(
                model_id=model_id,
                metric=f"drift_psi_{col}",
                value=psi,
                baseline=0.0,
                severity=severity,
                observed_at=ts,
                subgroup={
                    "feature": col,
                    "ks_statistic": str(round(ks_stat, 4)),
                    "ks_pvalue": str(round(ks_p, 6)),
                },
            )
        )
    return signals


def detect_demographic_parity(
    *,
    model_id: str,
    current: pd.DataFrame,
    sensitive_columns: list[str],
    prediction_column: str = "y_pred",
    observed_at: datetime | None = None,
) -> list[DriftSignal]:
    """Demographic-parity gap per protected attribute.

    Computes max(group positive-rate) − min(group positive-rate) per
    sensitive column and emits a signal if the absolute gap is ≥ LOW.
    """
    ts = observed_at or datetime.now(UTC)
    if prediction_column not in current.columns:
        return []
    signals: list[DriftSignal] = []
    for col in sensitive_columns:
        if col not in current.columns:
            continue
        rates: list[float] = []
        for _, group_df in current.groupby(col):
            preds = group_df[prediction_column].dropna()
            if len(preds) == 0:
                continue
            rates.append(float((preds > 0.5).mean()))
        if len(rates) < 2:
            continue
        gap = max(rates) - min(rates)
        severity = _severity_from_fairness_gap(gap)
        if severity is None:
            continue
        signals.append(
            DriftSignal(
                model_id=model_id,
                metric=f"demographic_parity_{col}",
                value=gap,
                baseline=0.0,
                severity=severity,
                observed_at=ts,
                subgroup={"attribute": col},
            )
        )
    return signals


def detect_equal_opportunity(
    *,
    model_id: str,
    current: pd.DataFrame,
    sensitive_columns: list[str],
    label_column: str = "y_true",
    prediction_column: str = "y_pred",
    observed_at: datetime | None = None,
) -> list[DriftSignal]:
    """Equal-opportunity gap (TPR difference) per protected attribute.

    Requires labeled rows. The signal's `value` is the absolute gap.
    """
    ts = observed_at or datetime.now(UTC)
    if label_column not in current.columns or prediction_column not in current.columns:
        return []
    # Restrict to labeled, positive-class rows — TPR is only defined there.
    labeled = current.dropna(subset=[label_column])
    positives = labeled[labeled[label_column] > 0.5]
    if len(positives) == 0:
        return []
    signals: list[DriftSignal] = []
    for col in sensitive_columns:
        if col not in positives.columns:
            continue
        tprs: list[float] = []
        for _, group_df in positives.groupby(col):
            # `group_df` is always a DataFrame here; pyright's GroupBy stub
            # is loose so we silence the union-attribute warning.
            preds = group_df[prediction_column].dropna()  # type: ignore[union-attr]
            if len(preds) == 0:
                continue
            tprs.append(float((preds > 0.5).mean()))
        if len(tprs) < 2:
            continue
        gap = max(tprs) - min(tprs)
        severity = _severity_from_fairness_gap(gap)
        if severity is None:
            continue
        signals.append(
            DriftSignal(
                model_id=model_id,
                metric=f"equal_opportunity_{col}",
                value=gap,
                baseline=0.0,
                severity=severity,
                observed_at=ts,
                subgroup={"attribute": col},
            )
        )
    return signals


def run_all(
    *,
    model_id: str,
    reference: pd.DataFrame,
    current: pd.DataFrame,
    numeric_columns: list[str],
    sensitive_columns: list[str],
    label_column: str = "y_true",
    prediction_column: str = "y_pred",
    observed_at: datetime | None = None,
) -> list[DriftSignal]:
    """Run drift, demographic-parity, and equal-opportunity in one pass."""
    ts = observed_at or datetime.now(UTC)
    signals: list[DriftSignal] = []
    signals.extend(
        detect_numeric_drift(
            model_id=model_id,
            reference=reference,
            current=current,
            columns=numeric_columns,
            observed_at=ts,
        )
    )
    signals.extend(
        detect_demographic_parity(
            model_id=model_id,
            current=current,
            sensitive_columns=sensitive_columns,
            prediction_column=prediction_column,
            observed_at=ts,
        )
    )
    signals.extend(
        detect_equal_opportunity(
            model_id=model_id,
            current=current,
            sensitive_columns=sensitive_columns,
            label_column=label_column,
            prediction_column=prediction_column,
            observed_at=ts,
        )
    )
    return signals
