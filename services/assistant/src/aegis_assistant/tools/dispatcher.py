"""Dispatcher — name → coroutine. Returns a ToolResult.

Per-tool dispatchers live in `tools/<name>.py` and self-register via
the `@register("...")` decorator at import time. `tools/__init__.py`
imports each module, populating `_REGISTRY`.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class ToolResult:
    """One tool invocation outcome.

    `summary` is what the model sees — short, one-line, human-readable.
    `payload` is the full JSON the dashboard renders as an expandable
    chip. `error` is set when the dispatcher couldn't reach the
    backend; the assistant surfaces this rather than guessing.
    """

    summary: str
    payload: Any
    error: str | None = None


Dispatcher = Callable[[httpx.AsyncClient, dict[str, Any]], Awaitable[ToolResult]]
"""A dispatcher is `async def(client, args) -> ToolResult`."""


_REGISTRY: dict[str, Dispatcher] = {}


def register(name: str) -> Callable[[Dispatcher], Dispatcher]:
    """Decorator that registers a dispatcher under its tool name."""

    def _wrap(fn: Dispatcher) -> Dispatcher:
        _REGISTRY[name] = fn
        return fn

    return _wrap


async def execute_tool(client: httpx.AsyncClient, name: str, args: dict[str, Any]) -> ToolResult:
    """Run the dispatcher registered under `name`. Network errors and
    non-2xx responses are caught here so the chat loop can surface them
    to the model as `tool_error` rather than crashing the request."""
    fn = _REGISTRY.get(name)
    if fn is None:
        return ToolResult(
            summary=f"unknown tool {name!r}",
            payload=None,
            error=f"tool {name!r} is not registered",
        )
    try:
        return await fn(client, args)
    except httpx.HTTPError as exc:
        return ToolResult(
            summary=f"{name} failed: {exc.__class__.__name__}",
            payload=None,
            error=str(exc),
        )
    except KeyError as exc:
        return ToolResult(
            summary=f"{name} missing argument {exc.args[0]!r}",
            payload=None,
            error=f"missing required argument {exc.args[0]!r}",
        )


def registered_tools() -> set[str]:
    """Return the set of currently-registered tool names. Used by tests
    to lock the surface."""
    return set(_REGISTRY.keys())
