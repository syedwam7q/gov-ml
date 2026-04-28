"""Integration test for POST /chat/stream — walks the full SSE roundtrip."""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
import respx
from aegis_assistant import groq_client
from aegis_assistant.app import build_app
from aegis_assistant.config import Settings, get_settings
from fastapi.testclient import TestClient


def _final(text: str) -> Any:
    msg = SimpleNamespace(role="assistant", content=text, tool_calls=None)
    return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


def _tool_call(name: str, args: dict[str, Any]) -> Any:
    tc = SimpleNamespace(
        id="call-1",
        type="function",
        function=SimpleNamespace(name=name, arguments=json.dumps(args)),
    )
    msg = SimpleNamespace(role="assistant", content=None, tool_calls=[tc])
    return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


def _parse_sse_data(body: str) -> list[dict[str, Any]]:
    """Pull the JSON payloads out of an SSE response body."""
    out: list[dict[str, Any]] = []
    for raw_event in body.split("\n\n"):
        for line in raw_event.split("\n"):
            if line.startswith("data: "):
                out.append(json.loads(line[6:]))
    return out


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    get_settings.cache_clear()


def test_chat_stream_returns_503_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from aegis_assistant.routers import chat as chat_router

    monkeypatch.setattr(
        chat_router, "get_settings", lambda: Settings(_env_file=None, GROQ_API_KEY="")
    )
    res = TestClient(build_app()).post(
        "/chat/stream",
        json={"messages": [{"role": "user", "content": "hi"}], "scope": {}},
    )
    assert res.status_code == 503
    assert "GROQ_API_KEY" in res.json()["detail"]


def test_chat_stream_walks_tool_then_final(monkeypatch: pytest.MonkeyPatch) -> None:
    """Full roundtrip — model asks for a tool, dispatcher hits the
    mocked control plane, model produces a final answer, all four
    SSE frames stream out."""
    from aegis_assistant.routers import chat as chat_router

    monkeypatch.setattr(
        chat_router,
        "get_settings",
        lambda: Settings(_env_file=None, GROQ_API_KEY="test-key"),
    )

    queue = [
        _tool_call("get_fleet_status", {}),
        _final("Three models live."),
    ]

    async def _scripted(**_: Any) -> Any:
        return queue.pop(0)

    monkeypatch.setattr(groq_client, "chat_completion", _scripted)

    with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(
                200,
                json=[
                    {
                        "id": "credit-v1",
                        "risk_class": "HIGH",
                        "name": "Credit",
                        "family": "tabular",
                    }
                ],
            )
        )
        with TestClient(build_app()) as client:
            res = client.post(
                "/chat/stream",
                json={
                    "messages": [{"role": "user", "content": "fleet status?"}],
                    "scope": {},
                },
            )

    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    frames = _parse_sse_data(res.text)
    kinds = [f["kind"] for f in frames]
    assert "tool_call_start" in kinds
    assert "tool_call_end" in kinds
    assert "final_text" in kinds
    final = next(f for f in frames if f["kind"] == "final_text")
    assert final["text"] == "Three models live."
    end = next(f for f in frames if f["kind"] == "tool_call_end")
    assert end["tool_name"] == "get_fleet_status"
    assert end["tool_error"] is None


def test_chat_stream_rejects_empty_messages() -> None:
    res = TestClient(build_app()).post("/chat/stream", json={"messages": [], "scope": {}})
    assert res.status_code == 422


def test_chat_stream_rejects_extra_fields() -> None:
    res = TestClient(build_app()).post(
        "/chat/stream",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "scope": {},
            "evil": "drop tables",
        },
    )
    assert res.status_code == 422
