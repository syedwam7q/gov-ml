"""Groq client wrapper with two-model rotation (spec §11.1).

The chat loop calls `chat_completion(messages, tools, phase=...)` and
this module picks the right model:

  * `phase="tool_decision"` → `llama-3.1-8b-instant`  (fast + cheap;
    used for every tool-call decision step in the loop).
  * `phase="final"`         → `llama-3.3-70b-versatile`  (quality;
    used for the final synthesis turn that produces the operator's
    answer).

Why a wrapper rather than calling `groq` SDK directly: it keeps the
chat loop unaware of model IDs, makes the rotation policy testable in
one place, and gives us a single seam to inject failure modes
(GROQ_API_KEY unset → `GroqUnavailableError` → 503 from /chat/stream).
"""

from __future__ import annotations

from typing import Any, Literal, cast

from groq import AsyncGroq
from groq.types.chat.chat_completion import ChatCompletion

from aegis_assistant.config import get_settings


class GroqUnavailableError(RuntimeError):
    """Raised when GROQ_API_KEY is unset.

    The /chat/stream endpoint catches this and returns 503 so the
    dashboard can render a graceful fallback ("assistant unavailable —
    set GROQ_API_KEY"). The rest of the assistant surface — health
    probes, tool dispatchers — keeps working.
    """


def _client() -> AsyncGroq:
    api_key = get_settings().groq_api_key
    if not api_key:
        raise GroqUnavailableError("GROQ_API_KEY is not configured")
    return AsyncGroq(api_key=api_key)


async def chat_completion(
    *,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    phase: Literal["tool_decision", "final"] = "final",
    temperature: float = 0.2,
) -> ChatCompletion:
    """Call Groq with the appropriate model for the current loop phase.

    Returns the raw Groq SDK response so the chat loop can inspect
    `resp.choices[0].message.tool_calls` and dispatch accordingly.
    Errors propagate — the chat loop wraps the call in a try/except and
    yields an `error` StreamFrame so the dashboard surfaces the failure.
    """
    settings = get_settings()
    model = settings.groq_model_fast if phase == "tool_decision" else settings.groq_model_quality
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    async with _client() as client:
        # The SDK's `create()` signature is heavily overloaded; pyright
        # can't pick the overload through `**kwargs`. We cast explicitly
        # because we never request streaming here — a fully-formed
        # ChatCompletion is what comes back.
        return cast("ChatCompletion", await client.chat.completions.create(**kwargs))
