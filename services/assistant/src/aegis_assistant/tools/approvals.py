"""`list_pending_approvals` — operator queue."""

from __future__ import annotations

from typing import Any, cast

import httpx

from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("list_pending_approvals")
async def list_pending_approvals(
    client: httpx.AsyncClient,
    args: dict[str, Any],  # noqa: ARG001
) -> ToolResult:
    settings = get_settings()
    base = settings.control_plane_url.rstrip("/")
    res = await client.get(
        f"{base}/api/cp/decisions?state=awaiting_approval&limit=50",
        timeout=settings.tool_request_timeout_s,
    )
    res.raise_for_status()
    decisions = cast("list[dict[str, Any]]", res.json())
    if not decisions:
        summary = "approval queue is empty"
    elif len(decisions) == 1:
        d = decisions[0]
        summary = (
            f"1 pending approval: {d.get('id', '?')} on {d.get('model_id', '?')} "
            f"(severity {d.get('severity', '?')})"
        )
    else:
        head = ", ".join(
            f"{str(d.get('id', '?'))[:8]}…/{d.get('severity', '?')}" for d in decisions[:3]
        )
        summary = f"{len(decisions)} pending approvals — top: {head}"
    return ToolResult(summary=summary, payload=decisions)
