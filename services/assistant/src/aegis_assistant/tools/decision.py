"""`get_decision` and `get_audit_chain` — read decisions and their audit rows."""

from __future__ import annotations

from typing import Any, cast

import httpx

from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("get_decision")
async def get_decision(client: httpx.AsyncClient, args: dict[str, Any]) -> ToolResult:
    decision_id = args["decision_id"]
    settings = get_settings()
    base = settings.control_plane_url.rstrip("/")
    res = await client.get(
        f"{base}/api/cp/decisions/{decision_id}",
        timeout=settings.tool_request_timeout_s,
    )
    res.raise_for_status()
    decision = cast("dict[str, Any]", res.json())
    summary = (
        f"decision {decision_id} · model {decision.get('model_id', '?')} · "
        f"state {decision.get('state', '?')} · severity {decision.get('severity', '?')}"
    )
    return ToolResult(summary=summary, payload=decision)


@register("get_audit_chain")
async def get_audit_chain(client: httpx.AsyncClient, args: dict[str, Any]) -> ToolResult:
    decision_id = args["decision_id"]
    settings = get_settings()
    base = settings.control_plane_url.rstrip("/")
    res = await client.get(
        f"{base}/api/cp/audit?decision_id={decision_id}&limit=20",
        timeout=settings.tool_request_timeout_s,
    )
    res.raise_for_status()
    page = cast("dict[str, Any]", res.json())
    rows = cast("list[dict[str, Any]]", page.get("rows") or [])
    actions = [r.get("action", "?") for r in rows]
    if actions:
        summary = f"audit chain for {decision_id}: {len(actions)} row(s) · {' → '.join(actions)}"
    else:
        summary = f"audit chain for {decision_id}: no rows yet"
    return ToolResult(summary=summary, payload=page)
