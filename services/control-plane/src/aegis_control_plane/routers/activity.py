"""Activity feed — `/api/cp/activity`.

Reads the most recent N audit-log rows, enriched with the parent
`GovernanceDecision`'s severity and model_id when available. Maps the
audit `action` verb onto the dashboard's `ActivityKind` union so the
feed UI can render the right icon + colour per row.

Spec §10.2 (persistent activity bell — SSE-driven; the Phase 5 SSE
broadcaster lives in `routers/decisions.py` + `routers/signals.py`).
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.db import get_session
from aegis_control_plane.orm import AuditLogRow, GovernanceDecisionRow

router = APIRouter(prefix="/api/cp/activity", tags=["activity"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


# Map audit-log `action` to the dashboard's `ActivityKind` string union.
# Anything outside this set falls through to the "decision_advanced"
# generic bucket — the feed still renders, just without specialised styling.
ACTION_TO_KIND: dict[str, str] = {
    "detect": "signal_detected",
    "analyze": "decision_advanced",
    "plan": "decision_advanced",
    "approval": "approval_decided",
    "execute": "action_executed",
    "evaluate": "decision_evaluated",
    "policy_change": "policy_changed",
    "deployment": "deployment",
}


def _summary_for(action: str, payload: dict[str, Any], model_id: str | None) -> str:
    """One-line natural-language summary for the activity row."""
    summary = payload.get("summary")
    if isinstance(summary, str) and summary.strip():
        return summary
    if model_id:
        return f"{action} · {model_id}"
    return action


@router.get("")
async def list_activity(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[dict[str, Any]]:
    """Newest-first list of activity events. Each row corresponds to one audit-log row."""
    stmt = (
        select(AuditLogRow, GovernanceDecisionRow)
        .join(
            GovernanceDecisionRow,
            AuditLogRow.decision_id == GovernanceDecisionRow.id,
            isouter=True,
        )
        .order_by(AuditLogRow.sequence_n.desc())
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()

    out: list[dict[str, Any]] = []
    for audit, decision in rows:
        decision_id = str(decision.id) if decision is not None else None
        model_id = decision.model_id if decision is not None else None
        severity = decision.severity if decision is not None else None
        out.append(
            {
                "id": str(audit.sequence_n),
                "ts": audit.ts.isoformat(),
                "kind": ACTION_TO_KIND.get(audit.action, "decision_advanced"),
                "model_id": model_id,
                "decision_id": decision_id,
                "severity": severity,
                "summary": _summary_for(audit.action, audit.payload, model_id),
                "actor": audit.actor,
            }
        )
    return out
