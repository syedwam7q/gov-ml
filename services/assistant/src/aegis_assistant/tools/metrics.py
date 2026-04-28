"""`get_model_metrics` — KPI rollups for one model over a time window."""

from __future__ import annotations

from typing import Any, cast

import httpx

from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("get_model_metrics")
async def get_model_metrics(client: httpx.AsyncClient, args: dict[str, Any]) -> ToolResult:
    model_id = args["model_id"]
    window = args.get("window", "24h")
    settings = get_settings()
    base = settings.control_plane_url.rstrip("/")
    url = f"{base}/api/cp/models/{model_id}/kpi?window={window}"
    res = await client.get(url, timeout=settings.tool_request_timeout_s)
    res.raise_for_status()
    kpi = cast("dict[str, Any]", res.json())
    headline = cast("dict[str, Any]", kpi.get("headline_metric") or {})
    headline_key = headline.get("key", "?")
    headline_value = headline.get("value")
    headline_floor = headline.get("floor")
    p95 = kpi.get("p95_latency_ms", "?")

    if isinstance(headline_value, (int, float)):
        headline_str = f"{headline_key}={headline_value:.2f}"
    else:
        headline_str = f"{headline_key}={headline_value!r}"

    if isinstance(headline_floor, (int, float)):
        floor_str = f" (floor {headline_floor:.2f})"
    elif headline_floor is not None:
        floor_str = f" (floor {headline_floor!r})"
    else:
        floor_str = ""

    summary = f"{model_id} {window}: {headline_str}{floor_str}. p95 latency {p95}ms."
    return ToolResult(summary=summary, payload=kpi)
