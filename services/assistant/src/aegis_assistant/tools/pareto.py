"""`get_pareto_front` — Phase 7 action-selector output for one decision.

The action-selector persists the Pareto-front + chosen action into
`plan_evidence` on the decision row. We read that field rather than
re-running the bandit (re-running would shift the posterior).
"""

from __future__ import annotations

from typing import Any, cast

import httpx

from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("get_pareto_front")
async def get_pareto_front(client: httpx.AsyncClient, args: dict[str, Any]) -> ToolResult:
    decision_id = args["decision_id"]
    settings = get_settings()
    base = settings.control_plane_url.rstrip("/")
    res = await client.get(
        f"{base}/api/cp/decisions/{decision_id}",
        timeout=settings.tool_request_timeout_s,
    )
    res.raise_for_status()
    decision = cast("dict[str, Any]", res.json())
    plan = cast("dict[str, Any] | None", decision.get("plan_evidence"))
    if not plan:
        return ToolResult(
            summary=(
                f"decision {decision_id} has no plan_evidence yet "
                f"(state={decision.get('state', '?')})"
            ),
            payload=None,
        )
    chosen = plan.get("chosen_action") or plan.get("chosen") or "?"
    candidates = cast("list[dict[str, Any]]", plan.get("candidates") or [])
    pareto_count = sum(1 for c in candidates if c.get("on_pareto_front"))
    summary = (
        f"plan for {decision_id}: chose {chosen} of {len(candidates)} "
        f"candidate(s); {pareto_count} on the Pareto front"
    )
    return ToolResult(summary=summary, payload=plan)
