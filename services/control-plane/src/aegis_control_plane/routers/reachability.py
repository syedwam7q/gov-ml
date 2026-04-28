"""Reachability probe — `/api/cp/reachability`.

Pure function: no DB hit, no Tinybird call, no auth. Returns 200 with a
small JSON body if the FastAPI app is reachable. The dashboard's server
component probes this on first render with a 500 ms timeout — when it
fails or times out the dashboard renders a friendly degraded-mode
banner instead of a noisy SWR error wall.

Not part of the platform-level `/healthz` / `/readyz` set because those
intentionally exercise downstream dependencies (DB, Tinybird) and are
slower. This endpoint is the "the wire is up" signal — nothing more.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from aegis_control_plane import __version__

router = APIRouter(prefix="/api/cp/reachability", tags=["reachability"])


@router.get("")
async def reachability() -> dict[str, object]:  # noqa: RUF029
    return {
        "ok": True,
        "version": __version__,
        "ts": datetime.now(UTC).isoformat(),
    }
