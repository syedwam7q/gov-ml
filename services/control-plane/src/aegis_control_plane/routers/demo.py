"""Demo theater — `/api/cp/internal/demo/*`.

Powers the dashboard's "Replay Apple Card 2019" button. The endpoint
spawns a background coroutine that broadcasts a choreographed sequence
of `demo_*` SSE events to every connected dashboard. The events carry
rich, fully-populated payloads — the dashboard renders them as
animated panels (Shapley waterfall, Pareto chart, audit chain ticker)
without touching the database.

Why ephemeral (not DB-persisted): the demo is *theater* — a 7-second
choreographed walkthrough of the MAPE-K loop intended for panel
audiences. Persisting would pollute the audit chain and make the demo
unsafe to repeat. The dashboard's bespoke `<DemoTheater />` overlay
consumes the events directly.

Spec §11.3 (operator-facing surface) — this is the WoW counterpart to
the grounded chat: a **visual** narrative of how Aegis self-heals.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status

from aegis_control_plane.routers.stream import EventBus, StreamEvent, get_bus

router = APIRouter(prefix="/api/cp/internal/demo", tags=["demo"])

_log = logging.getLogger(__name__)


# Apple Card 2019 — the textbook governance failure.
#
# In November 2019, applicants reported gender-based credit-limit
# disparities on the Apple-branded Goldman Sachs card. The investigation
# attributed the divergence to features acting as proxies for income,
# whose joint distribution had shifted between the policy reference
# window and the live evaluation window.
#
# This payload encodes the same shape Aegis would produce in production:
# a drift signal on `demographic_parity_gender`, a causal attribution
# that flags `income_proxy` as the dominant cause, a Pareto front of
# four remediation actions, and the chosen action's reward vector.
#
# Numbers are realistic but synthetic — they're chosen to illustrate
# the loop, not to recreate the real Goldman Sachs underwriting model.
APPLE_CARD_SCENARIO: dict[str, Any] = {
    "model_id": "credit-v1",
    "drift_signal": {
        "metric": "demographic_parity_gender",
        "value": 0.71,
        "baseline": 0.83,
        "floor": 0.80,
        "psi": 0.31,
        "severity": "HIGH",
        "window": "24h",
    },
    "causal_attribution": {
        "method": "dowhy_gcm",
        "target_node": "approval",
        "root_causes": [
            {
                "node": "income_proxy",
                "contribution": 0.68,
                "shift_direction": "positive",
                "kind": "feature_distribution",
                "narrative": (
                    "Joint distribution of features acting as income proxies "
                    "shifted vs. the reference window."
                ),
            },
            {
                "node": "region",
                "contribution": 0.21,
                "shift_direction": "positive",
                "kind": "feature_distribution",
                "narrative": "Regional volume mix tilted toward urban segments.",
            },
            {
                "node": "age_band",
                "contribution": 0.11,
                "shift_direction": "neutral",
                "kind": "feature_distribution",
                "narrative": "Age-band distribution drifted within tolerance.",
            },
        ],
        "recommended_action": "REWEIGH",
        "shapley_sum_check": 1.00,
        "quality": "high",
    },
    "plan_evidence": {
        "method": "cb_knapsacks",
        "chosen_action": "REWEIGH",
        "lambda_dual": [0.32, 0.18, 0.41, 0.09],
        "candidates": [
            {
                "action": "REWEIGH",
                "reward_vector": [0.182, 0.220, -1.85, -0.31],
                "lower_ci": [0.158, 0.195, -2.10, -0.42],
                "upper_ci": [0.205, 0.244, -1.61, -0.21],
                "on_pareto_front": True,
                "selected": True,
                "narrative": "Reweigh income-proxy feature; minimal latency cost.",
            },
            {
                "action": "RETRAIN",
                "reward_vector": [0.198, 0.242, -45.0, -0.66],
                "lower_ci": [0.171, 0.219, -52.4, -0.78],
                "upper_ci": [0.226, 0.266, -38.1, -0.55],
                "on_pareto_front": True,
                "selected": False,
                "narrative": "Higher fairness gain at 24× compute cost.",
            },
            {
                "action": "FEATURE_DROP",
                "reward_vector": [0.140, 0.148, -0.92, -0.24],
                "lower_ci": [0.120, 0.124, -1.18, -0.36],
                "upper_ci": [0.161, 0.171, -0.66, -0.13],
                "on_pareto_front": True,
                "selected": False,
                "narrative": "Drop income_proxy entirely; loses calibration headroom.",
            },
            {
                "action": "ESCALATE",
                "reward_vector": [0.000, 0.000, 0.0, -0.05],
                "lower_ci": [0.000, 0.000, 0.0, -0.10],
                "upper_ci": [0.000, 0.000, 0.0, 0.00],
                "on_pareto_front": False,
                "selected": False,
                "narrative": "Punt to operator queue; no auto-remediation.",
            },
        ],
    },
    "action_result": {
        "action": "REWEIGH",
        "applied_at": None,
        "post_mitigation": {
            "demographic_parity_gender": 0.83,
            "approval_rate_delta": -0.014,
            "p95_latency_ms_delta": 6.2,
        },
    },
    "audit_chain_summary": {
        "rows_appended": 6,
        "head_hash": "0x" + "a" * 8 + "..." + "b" * 4,
        "anchor": "github://syedwam7q/gov-ml@anchor-2026-04-29",
    },
}


# Choreography timing — total elapsed ≈ 7.5 seconds. Tuned for panel
# delivery: long enough that judges read each scene, short enough that
# the punchline lands before attention drifts.
_CHOREOGRAPHY: tuple[tuple[str, float], ...] = (
    ("demo_started", 0.0),
    ("demo_drift_signal", 0.6),
    ("demo_causal_attribution", 1.6),
    ("demo_pareto_front", 1.6),
    ("demo_action_executed", 1.5),
    ("demo_audit_extended", 1.0),
    ("demo_complete", 0.6),
)


def _build_event(*, kind: str, demo_id: str, scenario: dict[str, Any]) -> StreamEvent:
    """Build the StreamEvent for one scene.

    The dashboard's `<DemoTheater />` listens on `type` to pick which
    scene to render and pulls the rich payload from `data`.
    """
    base: dict[str, Any] = {
        "demo_id": demo_id,
        "model_id": scenario["model_id"],
        "scenario": "apple_card_2019",
    }
    if kind == "demo_started":
        return StreamEvent(
            type=kind,
            data={
                **base,
                "title": "Apple Card 2019 — fairness drift",
                "summary": "Replaying a textbook governance failure on credit-v1.",
            },
        )
    if kind == "demo_drift_signal":
        return StreamEvent(
            type=kind,
            data={**base, "drift_signal": scenario["drift_signal"]},
        )
    if kind == "demo_causal_attribution":
        return StreamEvent(
            type=kind,
            data={**base, "causal_attribution": scenario["causal_attribution"]},
        )
    if kind == "demo_pareto_front":
        return StreamEvent(
            type=kind,
            data={**base, "plan_evidence": scenario["plan_evidence"]},
        )
    if kind == "demo_action_executed":
        return StreamEvent(
            type=kind,
            data={**base, "action_result": scenario["action_result"]},
        )
    if kind == "demo_audit_extended":
        return StreamEvent(
            type=kind,
            data={**base, "audit_chain": scenario["audit_chain_summary"]},
        )
    if kind == "demo_complete":
        return StreamEvent(
            type=kind,
            data={
                **base,
                "elapsed_s": sum(d for _, d in _CHOREOGRAPHY),
                "summary": (
                    "Self-healed in 7.5s — audit chain extended, ask the assistant for details."
                ),
            },
        )
    msg = f"unknown demo event {kind!r}"
    raise ValueError(msg)


async def _run_choreography(*, demo_id: str, bus: EventBus) -> None:
    """Walk the scripted timeline. Sleeps + broadcasts. Logs failures
    rather than letting them surface in the spawning HTTP handler."""
    try:
        for kind, delay in _CHOREOGRAPHY:
            await asyncio.sleep(delay)
            event = _build_event(kind=kind, demo_id=demo_id, scenario=APPLE_CARD_SCENARIO)
            await bus.broadcast(event)
    except Exception:  # noqa: BLE001
        _log.exception("demo choreography failed for demo_id=%s", demo_id)


@router.post("/apple-card", status_code=status.HTTP_202_ACCEPTED)
async def replay_apple_card(
    bus: Annotated[EventBus, Depends(get_bus)],
) -> dict[str, str]:
    """Kick off the Apple Card 2019 demo.

    Returns immediately with a `demo_id` the dashboard correlates
    incoming `demo_*` events against. The choreography runs in the
    background — disconnecting the HTTP request does not abort it.
    """
    demo_id = uuid.uuid4().hex
    asyncio.create_task(_run_choreography(demo_id=demo_id, bus=bus))
    return {
        "demo_id": demo_id,
        "scenario": "apple_card_2019",
        "expected_duration_s": str(sum(d for _, d in _CHOREOGRAPHY)),
    }


__all__ = ["APPLE_CARD_SCENARIO", "router"]
