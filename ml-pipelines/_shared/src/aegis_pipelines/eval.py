"""Fairness and calibration metrics shared across model pipelines.

Computes Expected Calibration Error (ECE) and group-fairness deltas directly
so downstream services have one canonical implementation. Every metric
documented in a model card is computed here.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def demographic_parity_difference(*, y_pred: np.ndarray, sensitive: np.ndarray) -> float:
    """max P(Y=1 | A=g) − min P(Y=1 | A=g) across groups g of `sensitive`."""
    rates = []
    for g in np.unique(sensitive):
        mask = sensitive == g
        rates.append(float(y_pred[mask].mean()) if mask.sum() > 0 else 0.0)
    return max(rates) - min(rates)


def equal_opportunity_difference(
    *, y_true: np.ndarray, y_pred: np.ndarray, sensitive: np.ndarray
) -> float:
    """max TPR(g) − min TPR(g) across groups g of `sensitive`."""
    tprs = []
    for g in np.unique(sensitive):
        mask = (sensitive == g) & (y_true == 1)
        if mask.sum() == 0:
            continue
        tprs.append(float(y_pred[mask].mean()))
    if not tprs:
        return 0.0
    return max(tprs) - min(tprs)


def expected_calibration_error(
    *, y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10
) -> float:
    """ECE — average |confidence − accuracy| over equal-width probability bins."""
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    n = len(y_true)
    ece = 0.0
    for lo, hi in zip(bin_edges[:-1], bin_edges[1:], strict=True):
        in_bin = (y_prob > lo) & (y_prob <= hi) if lo > 0 else (y_prob >= lo) & (y_prob <= hi)
        bin_size = int(in_bin.sum())
        if bin_size == 0:
            continue
        acc = float(y_true[in_bin].mean())
        conf = float(y_prob[in_bin].mean())
        ece += (bin_size / n) * abs(conf - acc)
    return ece


def binary_classification_metrics(
    *, y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray
) -> dict[str, float]:
    """Standard binary-classification metrics + Brier + ECE.

    `zero_division=0` is well-supported by sklearn at runtime even though its
    type stubs only declare `str`; we silence pyright on those three lines.
    """
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),  # type: ignore[arg-type]
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),  # type: ignore[arg-type]
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),  # type: ignore[arg-type]
        "auroc": float(roc_auc_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 0.0,
        "brier": float(brier_score_loss(y_true, y_prob)),
        "ece": expected_calibration_error(y_true=y_true, y_prob=y_prob),
    }


def subgroup_metrics(
    *, y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray, sensitive: np.ndarray
) -> dict[str, Any]:
    """Per-group classification metrics + cross-group fairness deltas."""
    out: dict[str, Any] = {}
    for g in np.unique(sensitive):
        mask = sensitive == g
        if mask.sum() == 0:
            continue
        out[str(g)] = binary_classification_metrics(
            y_true=y_true[mask], y_pred=y_pred[mask], y_prob=y_prob[mask]
        )
    out["demographic_parity_difference"] = demographic_parity_difference(
        y_pred=y_pred, sensitive=sensitive
    )
    out["equal_opportunity_difference"] = equal_opportunity_difference(
        y_true=y_true, y_pred=y_pred, sensitive=sensitive
    )
    return out


# -- Borkan 2019 metrics (Jigsaw Unintended Bias) --------------------------------


def subgroup_auc(*, y_true: np.ndarray, y_prob: np.ndarray, subgroup_mask: np.ndarray) -> float:
    """AUROC restricted to the rows in `subgroup_mask`. Per Borkan et al. 2019.

    Quantifies how well the model separates positives from negatives *within*
    a single identity subgroup. Low score = model is bad at distinguishing
    toxic vs non-toxic for this group specifically.
    """
    y_true_sub = y_true[subgroup_mask]
    y_prob_sub = y_prob[subgroup_mask]
    if len(np.unique(y_true_sub)) < 2:
        return 0.0
    return float(roc_auc_score(y_true_sub, y_prob_sub))


def bpsn_auc(*, y_true: np.ndarray, y_prob: np.ndarray, subgroup_mask: np.ndarray) -> float:
    """Background Positive, Subgroup Negative AUROC (Borkan 2019).

    AUROC over (background-positive ∪ subgroup-negative) — captures the rate at
    which the model false-positively flags non-toxic comments mentioning the
    subgroup, relative to its true positives outside the subgroup. Low score =
    the model is biased TOWARD flagging the subgroup.
    """
    bg_pos = (~subgroup_mask) & (y_true == 1)
    sub_neg = subgroup_mask & (y_true == 0)
    sel = bg_pos | sub_neg
    if not sel.any():
        return 0.0
    y_true_sel = y_true[sel]
    if len(np.unique(y_true_sel)) < 2:
        return 0.0
    return float(roc_auc_score(y_true_sel, y_prob[sel]))


def bnsp_auc(*, y_true: np.ndarray, y_prob: np.ndarray, subgroup_mask: np.ndarray) -> float:
    """Background Negative, Subgroup Positive AUROC (Borkan 2019).

    AUROC over (background-negative ∪ subgroup-positive) — captures the rate at
    which the model misses toxic comments mentioning the subgroup, relative to
    its true negatives outside the subgroup. Low score = the model is biased
    AGAINST flagging the subgroup (false negatives concentrated there).
    """
    bg_neg = (~subgroup_mask) & (y_true == 0)
    sub_pos = subgroup_mask & (y_true == 1)
    sel = bg_neg | sub_pos
    if not sel.any():
        return 0.0
    y_true_sel = y_true[sel]
    if len(np.unique(y_true_sel)) < 2:
        return 0.0
    return float(roc_auc_score(y_true_sel, y_prob[sel]))


def borkan_subgroup_report(
    *, y_true: np.ndarray, y_prob: np.ndarray, identities: dict[str, np.ndarray]
) -> dict[str, dict[str, float]]:
    """Compute (subgroup_AUC, BPSN_AUC, BNSP_AUC) per identity. Borkan et al. 2019.

    `identities` maps an identity name (e.g., "black", "muslim", "female") to a
    boolean array indicating which rows mention that identity.
    """
    report: dict[str, dict[str, float]] = {}
    for name, mask in identities.items():
        report[name] = {
            "subgroup_auc": subgroup_auc(y_true=y_true, y_prob=y_prob, subgroup_mask=mask),
            "bpsn_auc": bpsn_auc(y_true=y_true, y_prob=y_prob, subgroup_mask=mask),
            "bnsp_auc": bnsp_auc(y_true=y_true, y_prob=y_prob, subgroup_mask=mask),
        }
    return report
