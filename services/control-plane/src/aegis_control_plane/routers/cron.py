"""Internal cron endpoints — `/api/v1/internal/cron/*`.

Vercel Cron hits these. They're meant to be called only from the Vercel
Cron infrastructure (or, locally, by a developer poking at the dev
deployment); production exposure is restricted by the same HMAC scheme
as `/internal/broadcast`.

Phase 3 ships two endpoints:

* `/api/v1/internal/cron/heartbeat` — proves cron wiring is alive.
  Vercel calls this every 5 min via `vercel.ts`. Records a single
  `audit_log` row with action=`cron_heartbeat`.
* `/api/v1/internal/cron/detect` — fans out to the detect services per
  model. Iterates the model registry, calls each detect service per
  family, posts the returned signals back into `/api/v1/signals`.

The detect services themselves are scaffolds in Phase 3 Task 1 + skeleton;
the cron handler is wired up here so the loop shape is correct even
before the detectors return real signals.
"""

from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.audit_writer import append_audit_row
from aegis_control_plane.db import get_session
from aegis_control_plane.orm import ModelRow
from aegis_shared.types import ModelFamily

router = APIRouter(prefix="/api/cp/internal/cron", tags=["cron"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Detect-service URLs are passed in via env at deploy time (Vercel sets one
# per deployment target). Phase 3 Task 1 + scaffolds use these defaults
# under local development.
_DETECT_TABULAR_DEFAULT_URL = "http://localhost:8001"
_DETECT_TEXT_DEFAULT_URL = "http://localhost:8002"


# Map a model family to the URL of its detect service. Read once per
# request to keep tests deterministic.
def _detect_url_for_family(family: ModelFamily) -> str:
    import os  # noqa: PLC0415

    if family == ModelFamily.TABULAR:
        return os.environ.get("DETECT_TABULAR_URL", _DETECT_TABULAR_DEFAULT_URL)
    if family == ModelFamily.TEXT:
        return os.environ.get("DETECT_TEXT_URL", _DETECT_TEXT_DEFAULT_URL)
    msg = f"no detect service configured for family {family.value}"
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


@router.get("/heartbeat", status_code=status.HTTP_200_OK)
async def heartbeat(session: SessionDep) -> dict[str, str | bool]:
    """Cron heartbeat. Records a single audit row so we can prove cron firing.

    When `AEGIS_SEED_HERO=true` is set in the environment, the heartbeat
    also runs the idempotent Apple-Card-2019 hero-scenario seeder (Phase 5
    Task 20). The seeder is a no-op once the scenario is in place — set
    the env var on first deploy then remove it.
    """
    import os  # noqa: PLC0415

    seeded = False
    if os.environ.get("AEGIS_SEED_HERO", "false").lower() == "true":
        from aegis_control_plane.seed import seed_hero_scenario  # noqa: PLC0415

        seeded = await seed_hero_scenario(session)

    await append_audit_row(
        session,
        actor="system:cron",
        action="cron_heartbeat",
        payload={"source": "vercel-cron", "seeded_hero": seeded},
        decision_id=None,
    )
    await session.commit()
    return {"status": "ok", "seeded_hero": seeded}


@router.get("/detect", status_code=status.HTTP_200_OK)
async def detect_fanout(session: SessionDep) -> dict[str, object]:
    """Fan out a detection round across every registered model.

    For each model, calls `<detect_url>/detect/run` with `{model_id,
    window_secs, reference_blob_url}` and counts the responses. Phase 3
    Task 3 + 4 will replace the placeholder detect services with real
    ones; this handler is family-aware and forward-compatible.

    Returns a summary dict — Vercel logs it; the dashboard polls
    `/api/v1/audit` to surface the actual signals.
    """
    models = (await session.execute(select(ModelRow))).scalars().all()

    called = 0
    errors = 0
    skipped = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in models:
            try:
                family = ModelFamily(model.family)
            except ValueError:
                skipped += 1
                continue

            base_url = _detect_url_for_family(family)
            try:
                resp = await client.post(
                    f"{base_url}/detect/run",
                    json={
                        "model_id": model.id,
                        "window_secs": 300,
                        "reference_blob_url": "blob://placeholder/reference.parquet",
                    },
                )
            except (httpx.RequestError, httpx.TimeoutException):
                errors += 1
                continue

            # 501 (skeleton) is expected during Phase 3 Task 1; count it as
            # called, not errored, so the heartbeat is meaningful.
            if resp.status_code in (200, 202, 501):
                called += 1
            else:
                errors += 1

    summary: dict[str, object] = {
        "models": len(models),
        "called": called,
        "errors": errors,
        "skipped": skipped,
    }

    # Record one audit row per fan-out; the per-signal audit rows are
    # written by /api/v1/signals when the detect service returns.
    await append_audit_row(
        session,
        actor="system:cron",
        action="cron_detect_fanout",
        payload=summary,
        decision_id=None,
    )
    await session.commit()
    return summary
