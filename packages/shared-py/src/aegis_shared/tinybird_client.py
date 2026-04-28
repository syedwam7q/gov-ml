"""Tiny HTTP client for the Tinybird Events API and Pipe endpoints.

One client used by every service that talks to Tinybird:
  • inference services append predictions
  • detect services append signals + subgroup_counters
  • the dashboard reads via /v0/pipes/<endpoint>.json (through the control
    plane's REST proxy when CORS would be a problem)

Auth via `TINYBIRD_TOKEN`. The client is async and accepts an injected
`httpx.AsyncClient` so tests can swap in a `MockTransport`.
"""

from __future__ import annotations

import json
from typing import Any, Final

import httpx

TINYBIRD_API_BASE: Final[str] = "https://api.tinybird.co"
"""Default API base. Override via `TINYBIRD_HOST` env var when constructing the client."""


class TinybirdError(RuntimeError):
    """Raised when a Tinybird API call fails or quarantines a row."""


class TinybirdClient:
    """Minimal Tinybird API wrapper.

    - `post_event(datasource, row)` appends one row to a datasource via the
      Events API (`/v0/events?name=<datasource>`). Rows are NDJSON.
    - `query_endpoint(name, params)` calls a published pipe endpoint
      (`/v0/pipes/<name>.json`) with query parameters and returns the
      `data` array.
    """

    def __init__(
        self,
        *,
        token: str,
        base_url: str = TINYBIRD_API_BASE,
        http: httpx.AsyncClient | None = None,
    ) -> None:
        if not token:
            msg = "TinybirdClient requires a non-empty token"
            raise ValueError(msg)
        self._token = token
        self._base_url = base_url.rstrip("/")
        self._http = http
        self._owns_http = http is None

    async def __aenter__(self) -> TinybirdClient:
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, *_: object) -> None:
        if self._owns_http and self._http is not None:
            await self._http.aclose()
            self._http = None

    @property
    def _client(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=30.0)
        return self._http

    @property
    def _auth_header(self) -> dict[str, str]:
        return {"authorization": f"Bearer {self._token}"}

    async def post_event(self, *, datasource: str, row: dict[str, Any]) -> dict[str, Any]:
        """Append one event row to `datasource`. Returns the API's response body."""
        url = f"{self._base_url}/v0/events"
        body = json.dumps(row, separators=(",", ":")) + "\n"
        resp = await self._client.post(
            url,
            params={"name": datasource},
            content=body,
            headers={**self._auth_header, "content-type": "application/x-ndjson"},
        )
        if resp.status_code >= 400:
            msg = f"Tinybird POST failed: HTTP {resp.status_code} — {resp.text}"
            raise TinybirdError(msg)
        payload: dict[str, Any] = resp.json()
        if payload.get("quarantined_rows", 0) > 0:
            msg = f"Tinybird quarantined a row: {payload!r}"
            raise TinybirdError(msg)
        return payload

    async def post_events(self, *, datasource: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
        """Append many rows in a single NDJSON request."""
        if not rows:
            return {"successful_rows": 0, "quarantined_rows": 0}
        url = f"{self._base_url}/v0/events"
        body = "".join(json.dumps(r, separators=(",", ":")) + "\n" for r in rows)
        resp = await self._client.post(
            url,
            params={"name": datasource},
            content=body,
            headers={**self._auth_header, "content-type": "application/x-ndjson"},
        )
        if resp.status_code >= 400:
            msg = f"Tinybird POST failed: HTTP {resp.status_code} — {resp.text}"
            raise TinybirdError(msg)
        payload: dict[str, Any] = resp.json()
        if payload.get("quarantined_rows", 0) > 0:
            msg = f"Tinybird quarantined {payload['quarantined_rows']} row(s): {payload!r}"
            raise TinybirdError(msg)
        return payload

    async def query_endpoint(
        self, name: str, *, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Call a published `.endpoint` and return the rows in `data`."""
        url = f"{self._base_url}/v0/pipes/{name}.json"
        resp = await self._client.get(
            url,
            params=params or {},
            headers=self._auth_header,
        )
        if resp.status_code >= 400:
            msg = f"Tinybird query failed: HTTP {resp.status_code} — {resp.text}"
            raise TinybirdError(msg)
        payload: dict[str, Any] = resp.json()
        rows: list[dict[str, Any]] = payload.get("data", [])
        return rows


__all__ = ["TINYBIRD_API_BASE", "TinybirdClient", "TinybirdError"]
