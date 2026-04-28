"""Tests for the tool-call orchestration loop.

We mock `groq_client.chat_completion` to replay scripted Groq responses
and `respx` to mock the live tool-backend HTTP calls. Each test walks
the resulting StreamFrame sequence.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
import respx
from aegis_assistant import groq_client
from aegis_assistant.chat_loop import StreamFrame, run_chat_loop


def _assistant_with_tool_call(call_id: str, name: str, args: dict[str, Any]) -> Any:
    """Build a minimal completion object that mimics Groq's shape."""
    tool_call = SimpleNamespace(
        id=call_id,
        type="function",
        function=SimpleNamespace(name=name, arguments=json.dumps(args)),
    )
    msg = SimpleNamespace(role="assistant", content=None, tool_calls=[tool_call])
    return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


def _assistant_final(text: str) -> Any:
    msg = SimpleNamespace(role="assistant", content=text, tool_calls=None)
    return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


def _scripted_groq(
    responses: list[Any],
) -> Callable[..., Awaitable[Any]]:
    """Return an awaitable that replays canned responses in order."""
    queue = list(responses)

    async def _fake(**_: Any) -> Any:
        return queue.pop(0)

    return _fake


def _scripted_groq_recording_phases(
    responses: list[Any],
    record: list[str],
) -> Callable[..., Awaitable[Any]]:
    """Like _scripted_groq but appends each call's `phase` kwarg to
    `record` so tests can lock the model-rotation policy."""
    queue = list(responses)

    async def _fake(**kwargs: Any) -> Any:
        phase = kwargs.get("phase", "<unset>")
        if isinstance(phase, str):
            record.append(phase)
        return queue.pop(0)

    return _fake


@pytest.mark.asyncio
async def test_loop_executes_tool_then_returns_final_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Model asks for get_fleet_status, loop runs it, model produces final."""
    monkeypatch.setattr(
        groq_client,
        "chat_completion",
        _scripted_groq(
            [
                _assistant_with_tool_call("call-1", "get_fleet_status", {}),
                _assistant_final("Three models online — all green."),
            ]
        ),
    )
    frames: list[StreamFrame] = []
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(
                200,
                json=[
                    {
                        "id": "credit-v1",
                        "risk_class": "HIGH",
                        "name": "C",
                        "family": "tabular",
                    }
                ],
            )
        )
        async for frame in run_chat_loop(
            messages=[{"role": "user", "content": "what's the fleet doing?"}],
            scope={},
        ):
            frames.append(frame)

    kinds = [f.kind for f in frames]
    assert "tool_call_start" in kinds
    assert "tool_call_end" in kinds
    assert "final_text" in kinds
    final = next(f for f in frames if f.kind == "final_text")
    assert "Three models" in final.text
    end_frame = next(f for f in frames if f.kind == "tool_call_end")
    assert end_frame.tool_name == "get_fleet_status"
    assert end_frame.tool_error is None
    assert isinstance(end_frame.tool_result_payload, list)


@pytest.mark.asyncio
async def test_loop_caps_iterations(monkeypatch: pytest.MonkeyPatch) -> None:
    """If the model keeps requesting tools, loop terminates at chat_max_iterations."""
    # Always return a tool call — never final.
    monkeypatch.setattr(
        groq_client,
        "chat_completion",
        _scripted_groq(
            [_assistant_with_tool_call(f"call-{i}", "get_fleet_status", {}) for i in range(20)]
        ),
    )
    frames: list[StreamFrame] = []
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(200, json=[])
        )
        async for frame in run_chat_loop(
            messages=[{"role": "user", "content": "loop forever"}],
            scope={},
        ):
            frames.append(frame)

    cap_frames = [f for f in frames if f.kind == "iteration_cap_hit"]
    assert len(cap_frames) == 1


@pytest.mark.asyncio
async def test_loop_surfaces_groq_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    """Groq errors → one error frame, no final, no crash."""

    async def _boom(**_: Any) -> Any:
        msg = "groq is on fire"
        raise RuntimeError(msg)

    monkeypatch.setattr(groq_client, "chat_completion", _boom)
    frames: list[StreamFrame] = []
    async for frame in run_chat_loop(messages=[{"role": "user", "content": "?"}], scope={}):
        frames.append(frame)
    assert len(frames) == 1
    assert frames[0].kind == "error"
    assert "groq is on fire" in frames[0].text


@pytest.mark.asyncio
async def test_loop_surfaces_groq_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    """GroqUnavailableError → error frame mentioning the missing key."""

    async def _no_key(**_: Any) -> Any:
        raise groq_client.GroqUnavailableError("GROQ_API_KEY is not configured")

    monkeypatch.setattr(groq_client, "chat_completion", _no_key)
    frames: list[StreamFrame] = []
    async for frame in run_chat_loop(messages=[{"role": "user", "content": "?"}], scope={}):
        frames.append(frame)
    assert len(frames) == 1
    assert frames[0].kind == "error"
    assert "GROQ_API_KEY" in frames[0].text


@pytest.mark.asyncio
async def test_loop_surfaces_tool_errors_to_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A 500 from a tool backend should flow through as a tool error
    frame; the next iteration sees `ERROR: ...` in the convo so the
    model can apologise rather than guessing the answer."""
    monkeypatch.setattr(
        groq_client,
        "chat_completion",
        _scripted_groq(
            [
                _assistant_with_tool_call("call-1", "get_fleet_status", {}),
                _assistant_final("Sorry — the fleet endpoint is failing right now."),
            ]
        ),
    )
    frames: list[StreamFrame] = []
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(return_value=httpx.Response(500))
        async for frame in run_chat_loop(
            messages=[{"role": "user", "content": "fleet status?"}], scope={}
        ):
            frames.append(frame)

    end_frame = next(f for f in frames if f.kind == "tool_call_end")
    assert end_frame.tool_error is not None
    final = next(f for f in frames if f.kind == "final_text")
    assert "failing" in final.text.lower() or "sorry" in final.text.lower()


@pytest.mark.asyncio
async def test_loop_uses_quality_model_for_every_turn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Llama 3.1 8B Instant emits malformed `<function=...>` blocks
    even on the FIRST turn (the 'should I call a tool?' decision),
    not just on tool-result synthesis — Groq rejects with 400
    tool_use_failed and the chat hangs on the user's first question.
    Regression guard: every turn must use the 70B quality model
    (phase='final')."""
    phases: list[str] = []
    monkeypatch.setattr(
        groq_client,
        "chat_completion",
        _scripted_groq_recording_phases(
            [
                _assistant_with_tool_call("call-1", "get_fleet_status", {}),
                _assistant_final("Three models online — all green."),
            ],
            phases,
        ),
    )
    import respx

    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(
                200,
                json=[
                    {
                        "id": "credit-v1",
                        "risk_class": "HIGH",
                        "name": "C",
                        "family": "tabular",
                    }
                ],
            )
        )
        async for _ in run_chat_loop(
            messages=[{"role": "user", "content": "fleet?"}],
            scope={},
        ):
            pass
    assert len(phases) == 2
    assert phases[0] == "final", (
        "first turn (tool-routing decision) must use the 70B model — "
        "8B emits malformed function-call XML"
    )
    assert phases[1] == "final", "synthesis turn after tool result must use the 70B model"
