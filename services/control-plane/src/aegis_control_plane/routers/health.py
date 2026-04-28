"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from aegis_control_plane import __version__

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness probe: 200 whenever the process is reachable."""
    return {"status": "ok", "version": __version__, "service": "control-plane"}


@router.get("/readyz")
async def readyz() -> dict[str, object]:
    """Readiness probe: reports each dependency's state.

    Phase 2 wires only the database; Phase 3+ adds Tinybird and HF Spaces.
    Returns 200 with `deps` even when degraded — degradation isn't a reason
    for a process restart, just a signal to the dashboard.
    """
    return {
        "status": "ok",
        "deps": {
            "database": "not-configured",
            "tinybird": "not-applicable-phase-2",
        },
    }
