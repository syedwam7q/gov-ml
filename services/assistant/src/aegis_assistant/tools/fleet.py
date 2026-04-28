"""`get_fleet_status` — overview of all monitored models."""

from __future__ import annotations

from typing import Any, cast

import httpx

from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("get_fleet_status")
async def get_fleet_status(
    client: httpx.AsyncClient,
    args: dict[str, Any],  # noqa: ARG001
) -> ToolResult:
    settings = get_settings()
    base = settings.control_plane_url.rstrip("/")
    res = await client.get(f"{base}/api/cp/models", timeout=settings.tool_request_timeout_s)
    res.raise_for_status()
    models = cast("list[dict[str, Any]]", res.json())
    if not models:
        return ToolResult(summary="no models registered", payload=models)
    head = ", ".join(f"{m.get('id', '?')} (risk={m.get('risk_class', '?')})" for m in models[:5])
    summary = f"{len(models)} model(s): {head}"
    return ToolResult(summary=summary, payload=models)
