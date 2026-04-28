"""POST /chat/stream — SSE-streamed tool-call loop output.

The endpoint owns the `Server-Sent Events` framing; the chat loop owns
the orchestration. Each StreamFrame the loop yields becomes one SSE
`data:` event the dashboard consumes via `EventSource`.

When `GROQ_API_KEY` is unset, the endpoint returns 503 — the dashboard
renders a graceful fallback rather than hanging.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sse_starlette.sse import EventSourceResponse

from aegis_assistant.chat_loop import StreamFrame, run_chat_loop
from aegis_assistant.config import get_settings


class ChatStreamRequest(BaseModel):
    """Request body for `POST /chat/stream`.

    Mirrors `aegis_shared.schemas.ChatRequest` but we keep it as a
    local Pydantic model so the assistant service can evolve its
    request shape without dragging the wire-type lock list with it.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    messages: list[dict[str, Any]] = Field(min_length=1)
    """Conversation history as Groq-shaped messages. The user's current
    turn is the last entry."""
    scope: dict[str, Any] = Field(default_factory=dict)
    """Free-form context — typically `{"decision_id": "..."}` when the
    Cmd+K drawer opens scoped to a decision."""


router = APIRouter()


def _frame_to_sse_payload(frame: StreamFrame) -> str:
    """Serialize a StreamFrame as the JSON the dashboard parses."""
    return json.dumps(
        {
            "kind": frame.kind,
            "text": frame.text,
            "tool_name": frame.tool_name,
            "tool_args": frame.tool_args,
            "tool_result_summary": frame.tool_result_summary,
            "tool_result_payload": frame.tool_result_payload,
            "tool_error": frame.tool_error,
        },
        default=str,
    )


@router.post("/chat/stream")
async def chat_stream(payload: ChatStreamRequest) -> EventSourceResponse:
    if not get_settings().groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GROQ_API_KEY is not configured; assistant is unavailable.",
        )

    async def _frames() -> AsyncIterator[dict[str, str]]:
        async for frame in run_chat_loop(messages=payload.messages, scope=payload.scope):
            yield {"event": "message", "data": _frame_to_sse_payload(frame)}

    return EventSourceResponse(_frames())
