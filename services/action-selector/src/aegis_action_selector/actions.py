"""The 8-action set Phase 7's bandit chooses between.

Spec §12.2. Each action carries a cost vector that the Knapsack
constraint reads — the bandit's Lagrangian penalty is `λᵀ · cost`.

Action semantics:
  • REWEIGH           — Kamiran-Calders preprocessing on rolling window
  • RETRAIN           — full retrain from scratch
  • RECALIBRATE       — subgroup-specific threshold adjustment
  • FEATURE_DROP      — remove a proxy attribute from the feature set
  • CALIBRATION_PATCH — Pleiss-style calibration patch on existing model
  • REJECT_OPTION     — abstain on near-tied predictions (Chow 1970)
  • ESCALATE          — route to human approval queue (no compute)
  • SHADOW_DEPLOY     — train candidate, run against live traffic, no
                        user-visible decisions emitted (exploration only)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final


class ActionKey(StrEnum):
    REWEIGH = "REWEIGH"
    RETRAIN = "RETRAIN"
    RECALIBRATE = "RECALIBRATE"
    FEATURE_DROP = "FEATURE_DROP"
    CALIBRATION_PATCH = "CALIBRATION_PATCH"
    REJECT_OPTION = "REJECT_OPTION"
    ESCALATE = "ESCALATE"
    SHADOW_DEPLOY = "SHADOW_DEPLOY"


@dataclass(frozen=True)
class CostVector:
    """Per-action constraint vector — fed to the Knapsack penalty."""

    latency_ms_added: float
    dollar_cost: float
    user_visible_traffic_pct: float
    risk_class: str

    def as_array(self) -> list[float]:
        """Project to the 4-dim numeric vector λ multiplies against."""
        risk_to_float: dict[str, float] = {
            "LOW": 0.1,
            "MEDIUM": 0.3,
            "HIGH": 0.7,
            "CRITICAL": 1.0,
        }
        return [
            self.latency_ms_added,
            self.dollar_cost,
            self.user_visible_traffic_pct,
            risk_to_float.get(self.risk_class, 1.0),
        ]


ACTION_SET: Final[dict[ActionKey, CostVector]] = {
    ActionKey.REWEIGH: CostVector(
        latency_ms_added=2.0, dollar_cost=0.4, user_visible_traffic_pct=100.0, risk_class="MEDIUM"
    ),
    ActionKey.RETRAIN: CostVector(
        latency_ms_added=3.0, dollar_cost=3.8, user_visible_traffic_pct=100.0, risk_class="HIGH"
    ),
    ActionKey.RECALIBRATE: CostVector(
        latency_ms_added=0.5, dollar_cost=0.1, user_visible_traffic_pct=100.0, risk_class="LOW"
    ),
    ActionKey.FEATURE_DROP: CostVector(
        latency_ms_added=0.0, dollar_cost=0.05, user_visible_traffic_pct=100.0, risk_class="MEDIUM"
    ),
    ActionKey.CALIBRATION_PATCH: CostVector(
        latency_ms_added=0.2, dollar_cost=0.08, user_visible_traffic_pct=100.0, risk_class="LOW"
    ),
    ActionKey.REJECT_OPTION: CostVector(
        latency_ms_added=0.0, dollar_cost=0.0, user_visible_traffic_pct=10.0, risk_class="LOW"
    ),
    ActionKey.ESCALATE: CostVector(
        latency_ms_added=0.0, dollar_cost=0.0, user_visible_traffic_pct=0.0, risk_class="LOW"
    ),
    ActionKey.SHADOW_DEPLOY: CostVector(
        latency_ms_added=0.0, dollar_cost=0.6, user_visible_traffic_pct=0.0, risk_class="LOW"
    ),
}
