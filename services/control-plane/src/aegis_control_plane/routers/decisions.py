"""REST API for governance decisions — `/api/v1/decisions`.

Decisions follow a strict 5-state lifecycle: `detected → analyzed → planned
→ awaiting_approval → executing → evaluated`. State transitions go through
`POST /{id}/transition` and only succeed if the requested transition is
valid given the current state.
"""

from __future__ import annotations

from typing import Annotated, Any, cast

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


async def _maybe_call_causal_attrib(row: GovernanceDecisionRow) -> None:
    """Phase 6 auto-attribution. Best-effort — failures leave the row
    untouched and the operator-driven path can fill in the payload later.

    Reads `reference_rows` and `current_rows` off the decision's
    drift_signal payload — the detection services attach them when
    they open the decision. If absent, attribution is skipped.
    """
    import logging  # noqa: PLC0415

    import httpx  # noqa: PLC0415

    from aegis_control_plane.config import get_settings  # noqa: PLC0415

    drift: dict[str, Any] = row.drift_signal or {}
    ref_rows_raw: object = drift.get("reference_rows") or []
    cur_rows_raw: object = drift.get("current_rows") or []
    if not isinstance(ref_rows_raw, list) or not isinstance(cur_rows_raw, list):
        return
    ref_rows = cast("list[dict[str, Any]]", ref_rows_raw)
    cur_rows = cast("list[dict[str, Any]]", cur_rows_raw)
    target_metric_raw = drift.get("metric", "approval")
    target_metric = target_metric_raw if isinstance(target_metric_raw, str) else "approval"
    if not ref_rows or not cur_rows:
        return

    settings = get_settings()
    attrib_url = f"{settings.causal_attrib_url.rstrip('/')}/attrib/run"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                attrib_url,
                json={
                    "model_id": row.model_id,
                    "target_node": target_metric,
                    "reference_rows": ref_rows,
                    "current_rows": cur_rows,
                },
            )
            resp.raise_for_status()
            row.causal_attribution = resp.json()
    except (httpx.HTTPError, httpx.RequestError):
        logging.getLogger(__name__).warning(
            "causal-attrib unavailable; analyze-state proceeds without attribution"
        )


async def _maybe_call_action_selector(row: GovernanceDecisionRow) -> None:
    """Phase 7 plan-state hook.

    Builds a 4-dim context from the decision's drift signal + severity,
    reads the Phase 6 `recommended_action` as the Bayesian prior, and
    calls /select. The response lands in `row.plan_evidence`.

    Best-effort — failures leave the row's plan_evidence untouched and
    operator-driven planning can fill it in later.
    """
    import logging  # noqa: PLC0415

    import httpx  # noqa: PLC0415

    from aegis_control_plane.config import get_settings  # noqa: PLC0415

    drift: dict[str, Any] = row.drift_signal or {}
    attribution: dict[str, Any] = row.causal_attribution or {}

    # Build a 4-dim context from drift signature.
    severity_to_float: dict[str, float] = {
        "LOW": 0.25,
        "MEDIUM": 0.50,
        "HIGH": 0.75,
        "CRITICAL": 1.0,
    }
    raw_value = drift.get("value")
    raw_baseline = drift.get("baseline")
    raw_psi = drift.get("psi")
    context = [
        severity_to_float.get(row.severity, 0.5),
        float(raw_value) if isinstance(raw_value, (int, float)) else 0.5,
        float(raw_baseline) if isinstance(raw_baseline, (int, float)) else 0.5,
        float(raw_psi) if isinstance(raw_psi, (int, float)) else 0.0,
    ]
    recommended = attribution.get("recommended_action")
    recommended_str = recommended if isinstance(recommended, str) else None

    settings = get_settings()
    select_url = f"{settings.action_selector_url.rstrip('/')}/select"
    body: dict[str, Any] = {
        "model_id": row.model_id,
        "decision_id": str(row.id),
        "context": context,
        "constraints": [5.0, 1.0, 100.0, 1.0],
        "horizon_remaining": 100,
    }
    if recommended_str is not None:
        body["recommended_action"] = recommended_str

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(select_url, json=body)
            resp.raise_for_status()
            row.plan_evidence = resp.json()
    except (httpx.HTTPError, httpx.RequestError):
        logging.getLogger(__name__).warning(
            "action-selector unavailable; plan-state proceeds without plan_evidence"
        )


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

    # Phase 7 — auto-action-selection via services/action-selector.
    # Fires when state advances to PLANNED *and* the caller didn't
    # supply an explicit payload. Reads recommended_action from the
    # Phase 6 causal_attribution and feeds it as a Bayesian prior
    # to the bandit.
    if target == DecisionState.PLANNED and payload.payload is None:
        await _maybe_call_action_selector(row)

    # Phase 6 — auto-attribution via services/causal-attrib.
    # Fires when state advances to ANALYZED *and* the caller didn't
    # supply an explicit payload (explicit payloads bypass causal-attrib;
    # used by tests + the seeder + future operator-driven flows).
    if target == DecisionState.ANALYZED and payload.payload is None:
        await _maybe_call_causal_attrib(row)

    row.state = target.value
    if target == DecisionState.EVALUATED:
        from datetime import UTC, datetime  # noqa: PLC0415

        row.evaluated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(row)

    # Broadcast over SSE so the dashboard's activity feed updates live.
    # Failures here are intentionally non-fatal — the transition itself
    # is durable in Postgres; a missed broadcast just means a slightly
    # stale UI until the next read picks up the row.
    import contextlib  # noqa: PLC0415
    import logging  # noqa: PLC0415

    from aegis_control_plane.routers.stream import StreamEvent, get_bus  # noqa: PLC0415

    with contextlib.suppress(Exception):  # broadcast best-effort
        try:
            await get_bus().broadcast(
                StreamEvent(
                    type="state_transition",
                    data={
                        "id": str(row.id),
                        "decision_id": str(row.id),
                        "model_id": row.model_id,
                        "from_state": current.value,
                        "to_state": target.value,
                        "severity": row.severity,
                        "kind": "decision_advanced",
                        "summary": f"{row.model_id} · {current.value} → {target.value}",
                    },
                )
            )
        except Exception:  # noqa: BLE001
            logging.getLogger(__name__).debug("SSE broadcast failed; transition still durable")
            raise

    return _row_to_decision(row)
