"""SSE event stream — `/api/v1/stream`.

Each browser connection opens an SSE stream. The control plane broadcasts
events into every connected stream via `EventBus.broadcast(...)`. Other
services (`detect-tabular`, `causal-attrib`, etc.) trigger broadcasts by
calling `POST /api/v1/internal/broadcast` with an HMAC token — the
internal endpoint authenticates the source before fanning out.
"""

from __future__ import annotations

import asyncio
import hmac
import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sse_starlette.sse import EventSourceResponse

from aegis_control_plane.config import get_settings

router = APIRouter(prefix="/api/v1", tags=["stream"])


class StreamEvent(BaseModel):
    """One SSE event delivered to the dashboard."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    type: str = Field(min_length=1)
    """Event type — `decision_open`, `decision_state`, `metrics_degraded`, ..."""

    data: dict[str, object]
    """Free-form payload; the dashboard's TypeScript types validate per `type`."""


class EventBus:
    """In-process fan-out from the broadcast endpoint to every active stream.

    Each connection registers an `asyncio.Queue` here when it opens and
    removes it when the client disconnects. `broadcast()` enqueues the
    serialized event into every active queue.
    """

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()

    def subscribe(self) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=128)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[str]) -> None:
        self._subscribers.discard(q)

    async def broadcast(self, event: StreamEvent) -> int:
        """Fan-out one event. Returns the count of receivers it reached."""
        message = json.dumps({"type": event.type, "data": event.data})
        delivered = 0
        for q in tuple(self._subscribers):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                # Drop on slow consumers — better than blocking the broadcaster.
                continue
            delivered += 1
        return delivered

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


_bus = EventBus()


def get_bus() -> EventBus:
    """FastAPI dependency for accessing the singleton bus."""
    return _bus


@router.get("/stream")
async def stream(request: Request) -> EventSourceResponse:
    """Open one SSE connection. Receives every broadcast event."""
    queue = _bus.subscribe()

    async def _generator() -> AsyncIterator[dict[str, str]]:
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                except TimeoutError:
                    # Heartbeat keeps proxies from closing the connection.
                    yield {"event": "heartbeat", "data": ""}
                    continue
                yield {"event": "message", "data": message}
        finally:
            _bus.unsubscribe(queue)

    return EventSourceResponse(_generator())


@router.post("/internal/broadcast", status_code=status.HTTP_202_ACCEPTED)
async def broadcast_internal(
    event: StreamEvent,
    bus: Annotated[EventBus, Depends(get_bus)],
    x_aegis_token: Annotated[str | None, Header(alias="x-aegis-token")] = None,
) -> dict[str, int]:
    """Trigger a broadcast from another internal service.

    Authenticates with HMAC-SHA256 of the canonical-JSON event body using
    `INTER_SERVICE_HMAC_SECRET`. The header value is the hex digest.
    """
    secret = get_settings().inter_service_hmac_secret
    if not secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTER_SERVICE_HMAC_SECRET not configured",
        )
    if x_aegis_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="missing x-aegis-token")
    expected = _expected_token(event, secret)
    if not hmac.compare_digest(expected, x_aegis_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid x-aegis-token")
    delivered = await bus.broadcast(event)
    return {"delivered": delivered, "subscribers": bus.subscriber_count}


def _expected_token(event: StreamEvent, secret: str) -> str:
    body = json.dumps(
        {"type": event.type, "data": event.data},
        sort_keys=True,
        separators=(",", ":"),
    )
    import hashlib  # noqa: PLC0415

    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


__all__ = ["EventBus", "StreamEvent", "router"]
