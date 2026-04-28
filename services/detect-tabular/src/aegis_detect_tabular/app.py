"""FastAPI app for the tabular detector — `/detect/run`."""

from __future__ import annotations

import io
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from aegis_detect_tabular import __version__
from aegis_detect_tabular.detectors import run_all
from aegis_shared.schemas import DriftSignal


class DetectRunRequest(BaseModel):
    """Body of `POST /detect/run`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    model_id: str = Field(min_length=1)
    window_secs: int = Field(ge=60, le=86_400)
    reference_blob_url: str = Field(min_length=1)
    # Phase 3 wiring sources reference + current frames from Tinybird /
    # Vercel Blob in production. For now, callers can also pass the rows
    # inline via these optional fields — used by the cron handler in
    # tests and by ad-hoc operator queries.
    reference_rows: list[dict[str, Any]] | None = None
    current_rows: list[dict[str, Any]] | None = None
    numeric_columns: list[str] = Field(default_factory=list)
    sensitive_columns: list[str] = Field(default_factory=list)


class DetectRunResponse(BaseModel):
    """Body of `POST /detect/run`."""

    model_config = ConfigDict(extra="forbid")

    signals: list[DriftSignal]
    rows_evaluated: int


def _frame_from_rows(rows: list[dict[str, Any]] | None) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame.from_records(rows)


def _frame_from_reference(_url: str) -> pd.DataFrame:
    """Stub: load the reference frame from a Vercel Blob URL.

    Phase 4 wires real Blob fetching. For Phase 3 we default to an empty
    frame when the URL is a placeholder so the cron handler can still
    exercise the path without real reference data.
    """
    # If a future caller passes a path or in-memory CSV via the URL, we
    # could parse it here; the placeholder URL is treated as "no data."
    _ = io  # placeholder for the future Blob client integration
    return pd.DataFrame()


def build_app() -> FastAPI:
    app = FastAPI(
        title="Aegis · Tabular Detector",
        version=__version__,
        description=(
            "Drift + fairness + calibration detection over tabular predictions. "
            "Built on scipy + fairlearn (no Evidently/NannyML deps to keep the "
            "workspace's xgboost 3.x compatible)."
        ),
    )

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:  # noqa: RUF029
        return {
            "status": "ok",
            "version": __version__,
            "service": "detect-tabular",
        }

    @app.post("/detect/run", response_model=DetectRunResponse)
    async def detect_run(payload: DetectRunRequest) -> DetectRunResponse:  # noqa: RUF029
        reference = (
            _frame_from_rows(payload.reference_rows)
            if payload.reference_rows is not None
            else _frame_from_reference(payload.reference_blob_url)
        )
        current = _frame_from_rows(payload.current_rows)

        # If neither reference nor current rows are available, return an
        # empty signal list rather than raising — the cron handler treats
        # an empty response as "no signals this cycle."
        if reference.empty and current.empty:
            return DetectRunResponse(signals=[], rows_evaluated=0)

        if reference.empty or current.empty:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Both reference_rows (or reference_blob_url) and current_rows "
                    "must be provided to run drift detection."
                ),
            )

        signals = run_all(
            model_id=payload.model_id,
            reference=reference,
            current=current,
            numeric_columns=payload.numeric_columns,
            sensitive_columns=payload.sensitive_columns,
        )
        return DetectRunResponse(signals=signals, rows_evaluated=len(current))

    _ = (healthz, detect_run)

    return app


app = build_app()
