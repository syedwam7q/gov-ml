"""Health endpoints — `/healthz` (always 200) and `/readyz` (deps probed)."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from aegis_causal_attrib import __version__

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, object]:  # noqa: RUF029
    return {"ok": True, "service": "causal-attrib", "version": __version__}


@router.get("/readyz")
async def readyz() -> dict[str, object]:  # noqa: RUF029
    """Readiness probe.

    Phase 6 has no required external deps at startup (DoWhy is imported
    lazily on first attribution call to keep cold start fast). Returns
    `{"ready": true}` once the FastAPI app has booted.
    """
    return {"ready": True, "ts": datetime.now(UTC).isoformat()}
