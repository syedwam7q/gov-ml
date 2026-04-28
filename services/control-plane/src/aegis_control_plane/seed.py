"""Apple-Card-2019 hero-scenario seeder.

Idempotently inserts the marquee demo into Postgres so the live
dashboard always walks end-to-end:

  • three models (credit / toxicity / readmission) — Spec Appendix A
  • one policy (credit-risk-fairness) per credit-v1
  • one GovernanceDecision (state=evaluated, severity=HIGH) modelling
    the Apple-Card 2019 fairness incident — NYDFS investigation 2021,
    CFPB fine 2024
  • the six-row audit chain that walks the decision through
    detect → analyze → plan → approval → execute → evaluate

The seeder is wired to the heartbeat cron (only when `AEGIS_SEED_HERO=true`)
and to the local-dev startup path. Running it twice is a no-op — it
checks for the hero decision's fixed UUID before inserting anything.

Spec §5.2 (hero scenario walk-through, second-by-second) and §6.1
(Postgres schema). The chain extends from the live head — never starts
a new chain — so verify_chain() succeeds across both seeded and
operator-generated rows.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any, Final

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.audit_writer import append_audit_row
from aegis_control_plane.orm import (
    GovernanceDecisionRow,
    ModelRow,
    PolicyRow,
)

logger = logging.getLogger(__name__)

# Fixed identifiers so the seeder is idempotent — re-running checks for
# these IDs and bails if they already exist.
HERO_DECISION_ID: Final[str] = "00000000-0000-4000-a000-000000000042"
HERO_POLICY_ID: Final[str] = "00000000-0000-4000-a000-000000000007"

# Anchor timestamp — second-by-second walk from spec §5.2. We keep the
# 12:03 UTC start so timestamps in the audit-log payloads match the
# narrative the dashboard renders on /incidents/0042.
_HERO_START: Final[datetime] = datetime(2026, 4, 28, 12, 3, 0, tzinfo=UTC)


# ──────────── Models registry ────────────

_MODELS: Final[tuple[dict[str, Any], ...]] = (
    {
        "id": "credit-v1",
        "name": "Credit Risk · HMDA",
        "family": "tabular",
        "risk_class": "HIGH",
        "active_version": "1.4.0",
        "owner_id": "system:bootstrap",
        "model_card_url": "blob://aegis/cards/credit-v1.md",
        "datasheet_url": "blob://aegis/sheets/hmda-2018.md",
        "causal_dag": {
            "source": "spec §12.1 + packages/shared-py/causal_dags/credit.json",
            "nodes_count": 11,
            "real_world_anchor": "Apple Card 2019 / NYDFS 2021 / CFPB 2024",
        },
    },
    {
        "id": "toxicity-v1",
        "name": "Toxicity · DistilBERT",
        "family": "text",
        "risk_class": "MEDIUM",
        "active_version": "0.9.2",
        "owner_id": "system:bootstrap",
        "model_card_url": "blob://aegis/cards/toxicity-v1.md",
        "datasheet_url": "blob://aegis/sheets/civil-comments.md",
        "causal_dag": None,
    },
    {
        "id": "readmission-v1",
        "name": "Hospital Readmission · UCI",
        "family": "tabular",
        "risk_class": "HIGH",
        "active_version": "1.0.1",
        "owner_id": "system:bootstrap",
        "model_card_url": "blob://aegis/cards/readmission-v1.md",
        "datasheet_url": "blob://aegis/sheets/diabetes-130-uci.md",
        "causal_dag": {"source": "spec §12.1", "nodes_count": 8},
    },
)


# ──────────── Policy + decision payloads ────────────

_HERO_POLICY_DSL: Final[str] = (
    "name: credit-risk-fairness\n"
    "model_id: credit-v1\n"
    "version: 7\n"
    "active: true\n"
    "mode: live\n"
    "triggers:\n"
    "  - signal: demographic_parity_gender\n"
    "    op: less_than\n"
    "    threshold: 0.80\n"
    "    severity: HIGH\n"
    "    window: 24h\n"
)

_HERO_POLICY_AST: Final[dict[str, Any]] = {
    "name": "credit-risk-fairness",
    "model_id": "credit-v1",
    "version": 7,
    "triggers": [
        {
            "signal": "demographic_parity_gender",
            "op": "less_than",
            "threshold": 0.80,
            "severity": "HIGH",
            "window": "24h",
        }
    ],
}

_HERO_DRIFT_SIGNAL: Final[dict[str, Any]] = {
    "metric": "demographic_parity_gender",
    "value": 0.71,
    "baseline": 0.94,
    "psi": 0.18,
    "subgroup": {"applicant_gender": "female"},
    "observed_at": _HERO_START.isoformat(),
}

_HERO_CAUSAL_ATTRIBUTION: Final[dict[str, Any]] = {
    "method": "DoWhy GCM (Budhathoki AISTATS 2021)",
    "target_metric": "demographic_parity_gender",
    "observed_value": 0.71,
    "counterfactual_value": 0.94,
    "root_causes": [
        {
            "node": "P(co_applicant_income | applicant_gender)",
            "contribution": 0.71,
            "explanation": (
                "Marketing campaign targeted single-applicant women — fewer "
                "co-applicants raises observed risk score."
            ),
        },
        {
            "node": "loan_purpose distribution",
            "contribution": 0.18,
            "explanation": "Shift toward small-business loans, which historically score higher.",
        },
        {
            "node": "credit_score binning",
            "contribution": 0.11,
            "explanation": (
                "Bucket boundaries at the lower end produced harsher rounding "
                "for the affected slice."
            ),
        },
    ],
    "confidence": 0.86,
}

_HERO_PLAN_EVIDENCE: Final[dict[str, Any]] = {
    "chosen": "REWEIGH",
    "rationale": (
        "Pareto-dominates RECAL on fairness; dominates RETRAIN on cost; "
        "SWAP rejected — no healthier challenger on this slice."
    ),
    "selector": "CB-Knapsacks (Agrawal-Devanur NeurIPS 2016)",
    "candidates": [
        {
            "key": "REWEIGH",
            "label": "Reweigh training set",
            "kind": "threshold_adjust",
            "selected": True,
            "pareto": True,
            "reward": {"utility": 0.001, "safety": 0.20, "cost": -0.4},
            "explanation": "Kamiran-Calders preprocessing on rolling 90-day window.",
        },
        {
            "key": "RECAL",
            "label": "Recalibrate threshold per subgroup",
            "kind": "threshold_adjust",
            "selected": False,
            "pareto": True,
            "reward": {"utility": -0.005, "safety": 0.12, "cost": -0.1},
            "explanation": "Subgroup-specific cutoffs; loses on fairness vs REWEIGH.",
        },
        {
            "key": "RETRAIN",
            "label": "Retrain from scratch",
            "kind": "retrain",
            "selected": False,
            "pareto": False,
            "reward": {"utility": 0.003, "safety": 0.21, "cost": -3.8},
            "explanation": "Costliest by far; only marginally better than REWEIGH.",
        },
        {
            "key": "SWAP",
            "label": "Swap to challenger model",
            "kind": "rollback",
            "selected": False,
            "pareto": False,
            "reward": {"utility": -0.04, "safety": 0.05, "cost": -0.2},
            "explanation": "No healthier challenger on this slice — rejected.",
        },
    ],
}

_HERO_ACTION_RESULT: Final[dict[str, Any]] = {
    "executed_action": "REWEIGH",
    "executed_at": (_HERO_START + timedelta(minutes=11, seconds=32)).isoformat(),
    "succeeded": True,
    "post_action_metric": 0.91,
    "canary_steps": ["5%", "25%", "50%", "100%"],
    "rollback_armed": True,
    "wall_clock_secs": 692,
}

_HERO_REWARD_VECTOR: Final[dict[str, float]] = {
    "acc": 0.001,
    "fairness": 0.20,
    "latency_ms": -2.0,
    "cost_usd": -0.4,
}


# ──────────── Public API ────────────


async def seed_hero_scenario(session: AsyncSession) -> bool:
    """Idempotently seed the Apple-Card-2019 hero scenario.

    Returns True if seeding ran (something was inserted), False if the
    scenario was already present and nothing changed.
    """
    existing = await session.get(GovernanceDecisionRow, HERO_DECISION_ID)
    if existing is not None:
        logger.debug("hero scenario already seeded; skipping")
        return False

    await _ensure_models(session)
    await _ensure_hero_policy(session)
    await _insert_hero_decision(session)
    await _append_hero_audit_chain(session)
    await session.commit()
    logger.info("seeded hero scenario · decision=%s · 6 audit rows appended", HERO_DECISION_ID)
    return True


# ──────────── Internals ────────────


async def _ensure_models(session: AsyncSession) -> None:
    existing_ids: set[str] = {row[0] for row in (await session.execute(select(ModelRow.id))).all()}
    for spec in _MODELS:
        if spec["id"] in existing_ids:
            continue
        session.add(ModelRow(**spec))
    await session.flush()


async def _ensure_hero_policy(session: AsyncSession) -> None:
    existing = await session.get(PolicyRow, HERO_POLICY_ID)
    if existing is not None:
        return
    session.add(
        PolicyRow(
            id=HERO_POLICY_ID,
            model_id="credit-v1",
            version=7,
            active=True,
            mode="live",
            dsl_yaml=_HERO_POLICY_DSL,
            parsed_ast=_HERO_POLICY_AST,
            created_by="system:bootstrap",
        )
    )
    await session.flush()


async def _insert_hero_decision(session: AsyncSession) -> None:
    decision = GovernanceDecisionRow(
        id=HERO_DECISION_ID,
        model_id="credit-v1",
        policy_id=HERO_POLICY_ID,
        state="evaluated",
        severity="HIGH",
        drift_signal=_HERO_DRIFT_SIGNAL,
        causal_attribution=_HERO_CAUSAL_ATTRIBUTION,
        plan_evidence=_HERO_PLAN_EVIDENCE,
        action_result=_HERO_ACTION_RESULT,
        reward_vector=_HERO_REWARD_VECTOR,
        observation_window_secs=3600,
        opened_at=_HERO_START,
        evaluated_at=_HERO_START + timedelta(hours=1, minutes=11, seconds=32),
    )
    session.add(decision)
    await session.flush()


async def _append_hero_audit_chain(session: AsyncSession) -> None:
    """Append the six rows that walk the decision through MAPE-K.

    Each call extends the chain from the current live head — the seeded
    chain is contiguous with whatever existed before (typically nothing
    on a fresh DB; possibly cron heartbeats on a longer-lived install).
    """
    steps: tuple[tuple[str, str, dict[str, Any], datetime], ...] = (
        (
            "system:detect-tabular",
            "detect",
            {
                "decision_id": HERO_DECISION_ID,
                "summary": "DP_gender drops 0.94 → 0.71 in 24h window — severity HIGH",
                "drift_signal": _HERO_DRIFT_SIGNAL,
            },
            _HERO_START,
        ),
        (
            "system:causal-attrib",
            "analyze",
            {
                "decision_id": HERO_DECISION_ID,
                "summary": (
                    "DoWhy GCM attributes 71% of drift to P(co_applicant_income | applicant_gender)"
                ),
                "attribution": _HERO_CAUSAL_ATTRIBUTION,
            },
            _HERO_START + timedelta(seconds=4),
        ),
        (
            "system:action-selector",
            "plan",
            {
                "decision_id": HERO_DECISION_ID,
                "summary": "CB-Knapsack chose REWEIGH (Pareto-dominant on fairness vs cost)",
                "plan": _HERO_PLAN_EVIDENCE,
            },
            _HERO_START + timedelta(seconds=7),
        ),
        (
            "user:demo-operator",
            "approval",
            {
                "decision_id": HERO_DECISION_ID,
                "summary": "REWEIGH risk_class=MEDIUM bypasses approval gate (auto-approved)",
                "decision": "approved",
                "decided_by": "system:auto",
                "justification": "MEDIUM risk class → auto-approval per policy v7",
            },
            _HERO_START + timedelta(seconds=9),
        ),
        (
            "system:wdk-canary",
            "execute",
            {
                "decision_id": HERO_DECISION_ID,
                "summary": "Canary 5% → 25% → 50% → 100%; auto-rollback armed throughout",
                "result": _HERO_ACTION_RESULT,
            },
            _HERO_START + timedelta(minutes=11, seconds=32),
        ),
        (
            "system:wdk-evaluator",
            "evaluate",
            {
                "decision_id": HERO_DECISION_ID,
                "summary": (
                    "Observation window closed; post-action DP_gender = 0.91; "
                    "CB-Knapsack posterior updated"
                ),
                "reward_vector": _HERO_REWARD_VECTOR,
            },
            _HERO_START + timedelta(hours=1, minutes=11, seconds=32),
        ),
    )

    for actor, action, payload, ts in steps:
        await append_audit_row(
            session,
            actor=actor,
            action=action,
            payload=payload,
            decision_id=HERO_DECISION_ID,
            ts=ts,
        )
