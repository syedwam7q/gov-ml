"""POST /select — choose the action that maximises (UCB-Lagrangian + prior).

Returns:
  {
    "chosen_action":     str,
    "rationale":         str,
    "scores":            {action: score},
    "pareto_front":      [{action, reward_vector, posterior_low, posterior_high}],
    "exploration_bonus": {action: float},
    "lambda_dual":       [4 floats],
    "method":            "CB-Knapsacks (Slivkins et al. JMLR 2024)",
  }
"""

from __future__ import annotations

from typing import Any

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from aegis_action_selector.actions import ACTION_SET, ActionKey
from aegis_action_selector.pareto import pareto_front
from aegis_action_selector.persistence import get_or_create_bandit

router = APIRouter()


class SelectRequest(BaseModel):
    """Body of `POST /select`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    model_id: str = Field(min_length=1)
    decision_id: str = Field(min_length=1)
    context: list[float] = Field(min_length=1)
    """4-dim context vector — typically (severity, observed, baseline, psi)."""

    constraints: list[float] = Field(min_length=1)
    """4-dim budget vector. λ updates project against (constraint / horizon)."""

    available_actions: list[str] = Field(default_factory=list)
    """Subset of ActionKey values. Empty list = all 8."""

    recommended_action: str | None = None
    """Phase 6 cause-mapping prior; boosts that action's score."""

    horizon_remaining: int = Field(default=100, ge=1)
    """Bandit horizon — used in the dual update normalisation."""


@router.post("/select")
def select(payload: SelectRequest) -> dict[str, Any]:
    bandit = get_or_create_bandit(payload.model_id, n_features=len(payload.context))
    context = np.asarray(payload.context, dtype=float)

    # Filter the action set if the caller restricted available actions.
    valid_action_values = {a.value for a in ActionKey}
    if payload.available_actions:
        available = {ActionKey(a) for a in payload.available_actions if a in valid_action_values}
        if not available:
            available = set(ACTION_SET.keys())
    else:
        available = set(ACTION_SET.keys())

    # Choose under the prior. We compute scores over ALL 8 actions, then
    # filter to available — keeps the score response complete for the UI.
    prior: ActionKey | None = (
        ActionKey(payload.recommended_action)
        if payload.recommended_action in valid_action_values
        else None
    )
    chosen, scores = bandit.choose_action(context, recommended_action=prior)
    if chosen not in available:
        # Re-pick from the available subset.
        chosen = max(available, key=lambda a: scores[a])

    # Per-action predicted reward + posterior std for the Pareto-front rendering.
    pareto_candidates: dict[ActionKey, np.ndarray] = {
        action: bandit.predicted_reward(action, context) for action in available
    }
    pareto = pareto_front(pareto_candidates)

    # Posterior intervals (μ ± 1.96·σ).
    intervals: list[dict[str, Any]] = []
    for action in available:
        reward_mean = bandit.predicted_reward(action, context)
        reward_std = bandit.predicted_reward_std(action, context)
        intervals.append(
            {
                "action": action.value,
                "selected": action == chosen,
                "on_pareto_front": action in pareto,
                "reward_mean": reward_mean.tolist(),
                "posterior_low": (reward_mean - 1.96 * reward_std).tolist(),
                "posterior_high": (reward_mean + 1.96 * reward_std).tolist(),
                "score": float(scores[action]),
            }
        )

    rationale = _build_rationale(chosen, prior, scores, pareto)

    return {
        "method": "CB-Knapsacks (Slivkins-Sankararaman-Foster JMLR 2024)",
        "chosen_action": chosen.value,
        "rationale": rationale,
        "candidates": intervals,
        "lambda_dual": bandit.lambda_dual.tolist(),
        "horizon_remaining": payload.horizon_remaining,
    }


def _build_rationale(
    chosen: ActionKey,
    prior: ActionKey | None,
    scores: dict[ActionKey, float],
    pareto: set[ActionKey],
) -> str:
    sorted_actions = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    runner_up = sorted_actions[1][0] if len(sorted_actions) > 1 else None
    parts = [f"Chose {chosen.value}"]
    if chosen in pareto:
        parts.append("(on the Pareto front)")
    if runner_up is not None:
        parts.append(
            f"; runner-up was {runner_up.value} "
            f"(score gap {scores[chosen] - scores[runner_up]:.3f})"
        )
    if prior is not None:
        parts.append(f". Phase 6 prior recommended {prior.value}.")
    return "".join(parts)
