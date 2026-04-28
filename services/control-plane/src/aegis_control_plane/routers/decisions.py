"""REST API for governance decisions — `/api/v1/decisions`.

Decisions follow a strict 5-state lifecycle: `detected → analyzed → planned
→ awaiting_approval → executing → evaluated`. State transitions go through
`POST /{id}/transition` and only succeed if the requested transition is
valid given the current state.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.db import get_session
from aegis_control_plane.orm import GovernanceDecisionRow, ModelRow
from aegis_shared.schemas import GovernanceDecision
from aegis_shared.types import DecisionState, Severity

router = APIRouter(prefix="/api/cp/decisions", tags=["decisions"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


# Allowed transitions per design Section 5. Each state has a fixed set of
# successors. Anything outside this graph is rejected with 409.
ALLOWED_TRANSITIONS: dict[DecisionState, set[DecisionState]] = {
    DecisionState.DETECTED: {DecisionState.ANALYZED},
    DecisionState.ANALYZED: {DecisionState.PLANNED},
    DecisionState.PLANNED: {
        DecisionState.AWAITING_APPROVAL,
        DecisionState.EXECUTING,
    },
    DecisionState.AWAITING_APPROVAL: {DecisionState.EXECUTING},
    DecisionState.EXECUTING: {DecisionState.EVALUATED},
    DecisionState.EVALUATED: set(),  # terminal
}


class DecisionCreate(BaseModel):
    """Inbound payload to open a new decision (state always = DETECTED)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    model_id: str = Field(min_length=1)
    policy_id: str = Field(min_length=1)
    severity: Severity
    drift_signal: dict[str, object]
    observation_window_secs: int = Field(ge=1)


class DecisionTransition(BaseModel):
    """Request body for `POST /api/v1/decisions/{id}/transition`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    target_state: DecisionState
    payload: dict[str, object] | None = None
    """Optional payload merged into the matching evidence column."""


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


@router.get("", response_model=list[GovernanceDecision])
async def list_decisions(
    session: SessionDep,
    model_id: str | None = None,
    state: DecisionState | None = None,
) -> list[GovernanceDecision]:
    stmt = select(GovernanceDecisionRow).order_by(GovernanceDecisionRow.opened_at.desc())
    if model_id is not None:
        stmt = stmt.where(GovernanceDecisionRow.model_id == model_id)
    if state is not None:
        stmt = stmt.where(GovernanceDecisionRow.state == state.value)
    rows = (await session.execute(stmt)).scalars().all()
    return [_row_to_decision(r) for r in rows]


@router.get("/{decision_id}", response_model=GovernanceDecision)
async def get_decision(decision_id: str, session: SessionDep) -> GovernanceDecision:
    row = await session.get(GovernanceDecisionRow, decision_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"decision {decision_id!r} not found")
    return _row_to_decision(row)


@router.post("", response_model=GovernanceDecision, status_code=status.HTTP_201_CREATED)
async def open_decision(payload: DecisionCreate, session: SessionDep) -> GovernanceDecision:
    """Open a new GovernanceDecision in state=DETECTED.

    Audit-row-on-open is wired in Phase 3 alongside the detection services.
    """
    parent = await session.get(ModelRow, payload.model_id)
    if parent is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"model {payload.model_id!r} not found"
        )
    row = GovernanceDecisionRow(
        model_id=payload.model_id,
        policy_id=payload.policy_id,
        state=DecisionState.DETECTED.value,
        severity=payload.severity.value,
        drift_signal=payload.drift_signal,
        observation_window_secs=payload.observation_window_secs,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _row_to_decision(row)


@router.post("/{decision_id}/transition", response_model=GovernanceDecision)
async def transition_decision(
    decision_id: str, payload: DecisionTransition, session: SessionDep
) -> GovernanceDecision:
    row = await session.get(GovernanceDecisionRow, decision_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"decision {decision_id!r} not found")
    current = DecisionState(row.state)
    target = payload.target_state
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"invalid transition: {current.value} → {target.value}; "
                f"allowed = {sorted(s.value for s in allowed)}"
            ),
        )

    # Merge optional payload into the matching evidence column.
    if payload.payload is not None:
        if target == DecisionState.ANALYZED:
            row.causal_attribution = payload.payload
        elif target == DecisionState.PLANNED:
            row.plan_evidence = payload.payload
        elif target == DecisionState.EXECUTING:
            row.action_result = payload.payload
        elif target == DecisionState.EVALUATED:
            # Reward vectors are floats — coerce dict[str, object] to dict[str, float]
            row.reward_vector = {k: float(v) for k, v in payload.payload.items()}  # type: ignore[arg-type]

    row.state = target.value
    if target == DecisionState.EVALUATED:
        from datetime import UTC, datetime  # noqa: PLC0415

        row.evaluated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(row)
    return _row_to_decision(row)
