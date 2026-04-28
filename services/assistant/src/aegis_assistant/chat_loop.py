"""Tool-call orchestration loop (spec §11.2).

Drives the model through up to N iterations of:

  1. Send conversation + tool specs to Groq.
  2. If the model returns `tool_calls`, execute each one against the
     dispatcher registry, append the results as `role=tool` messages,
     and loop.
  3. If the model returns a final assistant message, yield its text
     and stop.

The loop yields `StreamFrame` events to the caller (the SSE endpoint
relays them to the dashboard), so each tool call surfaces in real-time
as a chip in the chat UI.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx

from aegis_assistant import groq_client
from aegis_assistant.config import get_settings
from aegis_assistant.system_prompt import build_system_prompt
from aegis_assistant.tools import TOOL_SPECS, execute_tool

StreamKind = Literal[
    "tool_call_start",
    "tool_call_end",
    "final_text",
    "iteration_cap_hit",
    "error",
]


def _empty_tool_args() -> dict[str, Any]:
    return {}


@dataclass(frozen=True)
class StreamFrame:
    """One event the SSE endpoint relays to the dashboard."""

    kind: StreamKind
    text: str = ""
    tool_name: str | None = None
    tool_args: dict[str, Any] = field(default_factory=_empty_tool_args)
    tool_result_summary: str | None = None
    tool_result_payload: Any = None
    tool_error: str | None = None


async def run_chat_loop(
    *,
    messages: list[dict[str, Any]],
    scope: dict[str, Any],
) -> AsyncIterator[StreamFrame]:
    """Run the tool-call loop and yield StreamFrames.

    `messages` is the conversation history (no system message — this
    function prepends one from `scope`). The user's current turn is
    the last entry.

    Yields one `tool_call_start` + one `tool_call_end` per dispatched
    tool, one `final_text` when the model produces a final answer, or
    one `iteration_cap_hit` if the loop exhausts `chat_max_iterations`
    without a final answer. On any error from Groq, yields one `error`
    frame and returns.
    """
    settings = get_settings()
    system_msg: dict[str, Any] = {
        "role": "system",
        "content": build_system_prompt(scope=scope),
    }
    convo: list[dict[str, Any]] = [system_msg, *messages]

    # Model selection: every turn uses the quality model (70B). The
    # original two-model rotation aimed to save tokens by routing
    # tool-decision turns to Llama 3.1 8B Instant, but in practice
    # 8B emits malformed `<function=...>` XML blocks instead of valid
    # OpenAI-shaped tool calls — Groq rejects those with 400
    # tool_use_failed and the chat surfaces an error. Llama 3.3 70B
    # Versatile is reliable for both tool routing and synthesis, and
    # the cost difference per chat is negligible at the dev tier we
    # run on. The `phase` parameter is preserved (the wrapper still
    # honours it) so a future caller could opt back into rotation
    # without touching this loop.

    async with httpx.AsyncClient() as http:
        for _iteration in range(settings.chat_max_iterations):
            phase: Literal["tool_decision", "final"] = "final"
            try:
                resp = await groq_client.chat_completion(
                    messages=convo, tools=TOOL_SPECS, phase=phase
                )
            except groq_client.GroqUnavailableError as exc:
                yield StreamFrame(kind="error", text=str(exc))
                return
            except Exception as exc:  # noqa: BLE001 — Groq SDK can raise broadly
                yield StreamFrame(
                    kind="error",
                    text=f"Groq call failed: {exc.__class__.__name__}: {exc}",
                )
                return

            if not resp.choices:
                yield StreamFrame(kind="error", text="Groq returned an empty choices list")
                return

            message = resp.choices[0].message
            tool_calls = list(getattr(message, "tool_calls", None) or [])

            if not tool_calls:
                yield StreamFrame(kind="final_text", text=message.content or "")
                return

            # Append the assistant's tool-call request to the convo so
            # subsequent turns can see what tools were already requested.
            convo.append(
                {
                    "role": "assistant",
                    "content": message.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in tool_calls
                    ],
                }
            )

            # Execute each requested tool and stream the results.
            for tc in tool_calls:
                name = tc.function.name
                try:
                    args: dict[str, Any] = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                yield StreamFrame(kind="tool_call_start", tool_name=name, tool_args=args)
                result = await execute_tool(http, name, args)
                yield StreamFrame(
                    kind="tool_call_end",
                    tool_name=name,
                    tool_args=args,
                    tool_result_summary=result.summary,
                    tool_result_payload=result.payload,
                    tool_error=result.error,
                )
                # Append the tool result for the model's next iteration.
                convo.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result.summary
                        if result.error is None
                        else f"ERROR: {result.error}",
                    }
                )

        yield StreamFrame(kind="iteration_cap_hit")
