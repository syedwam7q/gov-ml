"""Tests for the SSE event bus + internal broadcast endpoint."""

from __future__ import annotations

import asyncio
import hashlib
import hmac as hmac_lib
import json
import os

import pytest
import pytest_asyncio
from aegis_control_plane.routers.stream import EventBus, StreamEvent
from httpx import ASGITransport, AsyncClient


def _expected_token(event: StreamEvent, secret: str) -> str:
    body = json.dumps(
        {"type": event.type, "data": event.data},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hmac_lib.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_event_bus_subscribe_unsubscribe() -> None:
    bus = EventBus()
    assert bus.subscriber_count == 0
    q = bus.subscribe()
    assert bus.subscriber_count == 1
    bus.unsubscribe(q)
    assert bus.subscriber_count == 0


@pytest.mark.asyncio
async def test_event_bus_broadcasts_to_all_subscribers() -> None:
    bus = EventBus()
    q1 = bus.subscribe()
    q2 = bus.subscribe()
    delivered = await bus.broadcast(StreamEvent(type="test", data={"k": 1}))
    assert delivered == 2
    msg1 = await asyncio.wait_for(q1.get(), timeout=1.0)
    msg2 = await asyncio.wait_for(q2.get(), timeout=1.0)
    assert json.loads(msg1)["type"] == "test"
    assert json.loads(msg2)["type"] == "test"


@pytest.mark.asyncio
async def test_event_bus_broadcast_with_no_subscribers_is_noop() -> None:
    bus = EventBus()
    delivered = await bus.broadcast(StreamEvent(type="test", data={}))
    assert delivered == 0


@pytest_asyncio.fixture
async def app_with_secret() -> AsyncClient:
    """App + client with a known INTER_SERVICE_HMAC_SECRET set."""
    os.environ["INTER_SERVICE_HMAC_SECRET"] = "test-secret-do-not-use"
    from aegis_control_plane.app import build_app
    from aegis_control_plane.config import get_settings

    get_settings.cache_clear()
    app = build_app()
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_broadcast_endpoint_rejects_missing_token(
    app_with_secret: AsyncClient,
) -> None:
    async with app_with_secret as ac:
        resp = await ac.post(
            "/api/v1/internal/broadcast",
            json={"type": "test", "data": {"k": 1}},
        )
    assert resp.status_code == 401
    assert "missing" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_broadcast_endpoint_rejects_wrong_token(
    app_with_secret: AsyncClient,
) -> None:
    async with app_with_secret as ac:
        resp = await ac.post(
            "/api/v1/internal/broadcast",
            json={"type": "test", "data": {"k": 1}},
            headers={"x-aegis-token": "obviously-wrong"},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_broadcast_endpoint_accepts_correct_token(
    app_with_secret: AsyncClient,
) -> None:
    event = StreamEvent(type="test", data={"k": 1})
    token = _expected_token(event, "test-secret-do-not-use")
    async with app_with_secret as ac:
        resp = await ac.post(
            "/api/v1/internal/broadcast",
            json={"type": "test", "data": {"k": 1}},
            headers={"x-aegis-token": token},
        )
    assert resp.status_code == 202
    body = resp.json()
    assert "delivered" in body
    assert "subscribers" in body
