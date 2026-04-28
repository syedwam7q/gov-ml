"""`explain_drift_signal` — Phase 6 causal attribution for a model's drift signal.

We surface the most recent decision for `model_id` (optionally filtered
by `metric`) and return its `causal_attribution` field, which the
control plane populated from the causal-attrib worker.
"""

from __future__ import annotations

from typing import Any, cast

import httpx

from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("explain_drift_signal")
async def explain_drift_signal(client: httpx.AsyncClient, args: dict[str, Any]) -> ToolResult:
    model_id = args["model_id"]
    metric = args.get("metric")
    settings = get_settings()
    base = settings.control_plane_url.rstrip("/")
    res = await client.get(
        f"{base}/api/cp/decisions?model_id={model_id}&limit=20",
        timeout=settings.tool_request_timeout_s,
    )
    res.raise_for_status()
    decisions = cast("list[dict[str, Any]]", res.json())
    if metric:
        matching = [
            d
            for d in decisions
            if cast("dict[str, Any]", d.get("drift_signal") or {}).get("metric") == metric
        ]
        if matching:
            decisions = matching
    if not decisions:
        return ToolResult(
            summary=f"no decisions found for {model_id}",
            payload=None,
        )
    decision = decisions[0]
    attribution = cast("dict[str, Any] | None", decision.get("causal_attribution"))
    if not attribution:
        return ToolResult(
            summary=(f"decision {decision.get('id', '?')} has no causal attribution yet"),
            payload=None,
        )
    root_causes = cast("list[dict[str, Any]]", attribution.get("root_causes") or [])
    top = root_causes[0] if root_causes else {}
    contribution = top.get("contribution", 0)
    contribution_pct = contribution * 100 if isinstance(contribution, (int, float)) else 0
    summary = (
        f"{model_id} {attribution.get('method', '?')}: top cause "
        f"{top.get('node', '?')} ({contribution_pct:.0f}%); "
        f"recommended action = {attribution.get('recommended_action', '?')}"
    )
    return ToolResult(summary=summary, payload=attribution)
