"""REST API for inbound detection signals — `/api/v1/signals`.

Detection workers post `DriftSignal` rows here. Severity-≥-MEDIUM signals
open a `GovernanceDecision` in `state=detected` and the matching audit
row is appended atomically. Severity-LOW signals are recorded as
`audit_log` actions (`signal_below_threshold`) for observability but do
not open a decision.

Idempotency. Detection runs are scheduled and may retry — we use the
tuple `(model_id, metric, observed_at)` as the idempotency key. If a
decision with that key already exists in `state=detected` we return it
unchanged.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.audit_writer import append_audit_row
from aegis_control_plane.db import get_session
from aegis_control_plane.orm import GovernanceDecisionRow
from aegis_shared.schemas import DriftSignal, GovernanceDecision
from aegis_shared.types import DecisionState, Severity

router = APIRouter(prefix="/api/v1/signals", tags=["signals"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Severities that open decisions. LOW is recorded for observability only.
_DECISION_OPENING = {Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL}

# Default observation window for newly opened decisions. Phase 7 makes
# this configurable per policy; Phase 3 just uses the spec default.
_DEFAULT_OBSERVATION_WINDOW_SECS = 3600


@router.post(
    "",
    response_model=GovernanceDecision | None,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_signal(
    signal: DriftSignal,
    session: SessionDep,
) -> GovernanceDecision | None:
    """Ingest one detection signal. Returns the GovernanceDecision (if opened)."""
    if signal.severity not in _DECISION_OPENING:
        # Below-threshold signal: record an audit action and return None.
        await append_audit_row(
            session,
            actor="system:detect",
            action="signal_below_threshold",
            payload=_signal_payload(signal),
            decision_id=None,
        )
        await session.commit()
        return None

    # Idempotency: same signal observed at the same instant for the same
    # metric is a retried POST — return the existing decision.
    existing_stmt = select(GovernanceDecisionRow).where(
        and_(
            GovernanceDecisionRow.model_id == signal.model_id,
            GovernanceDecisionRow.state == DecisionState.DETECTED.value,
        )
    )
    existing = (await session.execute(existing_stmt)).scalars().all()
    for row in existing:
        ds = row.drift_signal  # already typed as dict[str, Any] in the ORM
        if (
            ds.get("metric") == signal.metric
            and ds.get("observed_at") == signal.observed_at.isoformat()
        ):
            return _row_to_decision(row)

    # Open a new decision in state=detected and write the matching audit row.
    decision = GovernanceDecisionRow(
        model_id=signal.model_id,
        # Phase 3 doesn't yet attach to a specific policy — the cron handler
        # will pass the active policy id once the cron is wired in Task 6.
        policy_id="00000000-0000-0000-0000-000000000000",
        state=DecisionState.DETECTED.value,
        severity=signal.severity.value,
        drift_signal=_signal_payload(signal),
        observation_window_secs=_DEFAULT_OBSERVATION_WINDOW_SECS,
    )
    session.add(decision)
    await session.flush()  # populate decision.id from gen_random_uuid()

    await append_audit_row(
        session,
        actor="system:detect",
        action="detect",
        payload=_signal_payload(signal),
        decision_id=str(decision.id),
    )

    await session.commit()
    await session.refresh(decision)
    return _row_to_decision(decision)


def _signal_payload(signal: DriftSignal) -> dict[str, object]:
    return {
        "model_id": signal.model_id,
        "metric": signal.metric,
        "value": signal.value,
        "baseline": signal.baseline,
        "severity": signal.severity.value,
        "observed_at": signal.observed_at.isoformat(),
        "subgroup": signal.subgroup,
    }


def _row_to_decision(row: GovernanceDecisionRow) -> GovernanceDecision:
    return GovernanceDecision.model_validate(
        {
            "id": str(row.id),
            "model_id": row.model_id,
            "policy_id": str(row.policy_id),
            "state": row.state,
            "severity": row.severity,
            "drift_signal": row.drift_signal,
            "causal_attribution": row.causal_attribution,
            "plan_evidence": row.plan_evidence,
            "action_result": row.action_result,
            "reward_vector": row.reward_vector,
            "observation_window_secs": row.observation_window_secs,
            "opened_at": row.opened_at,
            "evaluated_at": row.evaluated_at,
        }
    )
