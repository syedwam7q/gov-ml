"""Health endpoints — `/healthz` (always 200) and `/readyz` (deps probed)."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from aegis_assistant import __version__

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, object]:  # noqa: RUF029
    return {"ok": True, "service": "assistant", "version": __version__}


@router.get("/readyz")
async def readyz() -> dict[str, object]:  # noqa: RUF029
    """Readiness probe.

    The assistant has no required external deps at startup — Groq is
    contacted only when `/chat/stream` fires, and the upstream Aegis
    HTTP services are reached lazily by tool dispatchers. Returns
    `{"ready": true}` once the FastAPI app has booted.
    """
    return {"ready": True, "ts": datetime.now(UTC).isoformat()}
