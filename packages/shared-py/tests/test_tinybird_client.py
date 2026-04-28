"""Tests for the shared Tinybird HTTP client."""

from __future__ import annotations

import pytest
from httpx import AsyncClient, MockTransport, Request, Response

from aegis_shared.tinybird_client import (
    TINYBIRD_API_BASE,
    TinybirdClient,
    TinybirdError,
)


def _mock(handler: object) -> AsyncClient:
    return AsyncClient(transport=MockTransport(handler))  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_post_event_serializes_row_as_jsonl_with_token() -> None:
    captured: dict[str, object] = {}

    def handler(request: Request) -> Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["body"] = request.content.decode()
        return Response(202, json={"successful_rows": 1, "quarantined_rows": 0})

    async with _mock(handler) as http:
        client = TinybirdClient(token="t-test", http=http)
        result = await client.post_event(
            datasource="predictions", row={"model_id": "credit-v1", "y": 0.71}
        )
    assert captured["method"] == "POST"
    assert "v0/events?name=predictions" in str(captured["url"])
    assert captured["auth"] == "Bearer t-test"
    # Body must be NDJSON (one line per event, compact JSON).
    assert captured["body"] == '{"model_id":"credit-v1","y":0.71}\n'
    assert result["successful_rows"] == 1


@pytest.mark.asyncio
async def test_post_event_raises_on_4xx() -> None:
    def handler(_: Request) -> Response:
        return Response(401, json={"error": "invalid_token"})

    async with _mock(handler) as http:
        client = TinybirdClient(token="t-bad", http=http)
        with pytest.raises(TinybirdError, match="401"):
            await client.post_event(datasource="predictions", row={})


@pytest.mark.asyncio
async def test_post_event_raises_on_quarantined_rows() -> None:
    def handler(_: Request) -> Response:
        return Response(202, json={"successful_rows": 0, "quarantined_rows": 1})

    async with _mock(handler) as http:
        client = TinybirdClient(token="t-test", http=http)
        with pytest.raises(TinybirdError, match="quarantined"):
            await client.post_event(datasource="predictions", row={"bad": "row"})


@pytest.mark.asyncio
async def test_query_endpoint_returns_data_array() -> None:
    def handler(request: Request) -> Response:
        # Endpoint paths look like /v0/pipes/<endpoint>.json
        assert request.url.path.endswith("/drift_window.json")
        return Response(
            200,
            json={
                "data": [
                    {"bucket": "2026-04-28T12:00:00Z", "value": 0.71, "model_id": "credit"},
                ],
                "rows": 1,
            },
        )

    async with _mock(handler) as http:
        client = TinybirdClient(token="t-read", http=http)
        rows = await client.query_endpoint("drift_window", params={"model_id": "credit-v1"})
    assert len(rows) == 1
    assert rows[0]["value"] == 0.71


def test_default_base_url_constant() -> None:
    assert TINYBIRD_API_BASE.startswith("https://")
    assert "tinybird" in TINYBIRD_API_BASE


@pytest.mark.asyncio
async def test_client_rejects_empty_token() -> None:
    with pytest.raises(ValueError, match="token"):
        TinybirdClient(token="")
