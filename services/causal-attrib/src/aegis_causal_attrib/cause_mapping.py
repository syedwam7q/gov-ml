"""Cause → remediation action mapping.

This is the **novel paper contribution** of Phase 6. Spec §12.1.

The dominant Shapley contributor's `CauseKind` deterministically maps
to a remediation action. Hand-curated from:

  • Kamiran & Calders (2012) — reweighing for upstream covariate shift
  • Zafar et al. (2017) — retraining when conditional mechanisms move
  • Pleiss et al. (2017) — calibration patches for label-prior shift
  • Friedler et al. (2019) — feature drop for proxy-attribute shift
  • Chow (1970) — reject option for high uncertainty / near-tied causes

Phase 7's action-selector reads `recommended_action` as a Bayesian
prior on the action posterior — this mapping is *not* a hard policy,
just a strong prior that the bandit can override with regret guarantees
when its reward estimates disagree.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from aegis_causal_attrib.dag_loader import CauseKind


class ActionKey(StrEnum):
    """Remediation actions Phase 7's policy will choose between."""

    REWEIGH = "REWEIGH"
    RETRAIN = "RETRAIN"
    RECALIBRATE = "RECALIBRATE"
    FEATURE_DROP = "FEATURE_DROP"
    CALIBRATION_PATCH = "CALIBRATION_PATCH"
    REJECT_OPTION = "REJECT_OPTION"
    ESCALATE = "ESCALATE"


# The spec §12.1 table — every CauseKind has exactly one target action
# that's the cheapest viable remediation for that mechanism shift.
CAUSE_TO_ACTION: dict[CauseKind, ActionKey] = {
    CauseKind.UPSTREAM_COVARIATE: ActionKey.REWEIGH,
    CauseKind.CONDITIONAL_MECHANISM: ActionKey.RETRAIN,
    CauseKind.PROXY_ATTRIBUTE: ActionKey.FEATURE_DROP,
    CauseKind.CALIBRATION_MECHANISM: ActionKey.CALIBRATION_PATCH,
}


@dataclass(frozen=True)
class AttributionEvidence:
    """Slim view of an attribution result, fed into `recommend_action`."""

    dominant_cause_node: str
    dominant_cause_kind: CauseKind
    shapley: dict[str, float]
    confidence: float


def recommend_action(
    evidence: AttributionEvidence,
    *,
    confidence_floor: float = 0.50,
    tie_threshold: float = 0.05,
) -> ActionKey:
    """Map a CauseKind to a recommended remediation action.

    Three branches:

      1. Confidence below `confidence_floor` → ESCALATE (route to human).
      2. Top-2 Shapley values within `tie_threshold` relative gap →
         REJECT_OPTION (abstain — Chow 1970).
      3. Otherwise dispatch via CAUSE_TO_ACTION.

    The thresholds default to the values from spec §12.1 (50% confidence
    floor, 5% relative gap for the tie). Both are tunable per call so the
    test suite can exercise edge cases.
    """
    if evidence.confidence < confidence_floor:
        return ActionKey.ESCALATE

    top = sorted(evidence.shapley.items(), key=lambda kv: abs(kv[1]), reverse=True)
    if len(top) >= 2:
        first, second = abs(top[0][1]), abs(top[1][1])
        if first > 0 and (first - second) / first < tie_threshold:
            return ActionKey.REJECT_OPTION

    return CAUSE_TO_ACTION.get(evidence.dominant_cause_kind, ActionKey.ESCALATE)
