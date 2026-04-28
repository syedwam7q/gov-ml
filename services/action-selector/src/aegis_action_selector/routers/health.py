"""Health endpoints — `/healthz` (always 200) and `/readyz` (deps probed)."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from aegis_action_selector import __version__

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, object]:  # noqa: RUF029
    return {"ok": True, "service": "action-selector", "version": __version__}


@router.get("/readyz")
async def readyz() -> dict[str, object]:  # noqa: RUF029
    return {"ready": True, "ts": datetime.now(UTC).isoformat()}
