"""FastAPI app for the tabular detector — `/detect/run`."""

from __future__ import annotations

from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from aegis_detect_tabular import __version__


class DetectRunRequest(BaseModel):
    """Body of `POST /detect/run`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    model_id: str = Field(min_length=1)
    window_secs: int = Field(ge=60, le=86_400)
    reference_blob_url: str = Field(min_length=1)


def build_app() -> FastAPI:
    app = FastAPI(
        title="Aegis · Tabular Detector",
        version=__version__,
        description="Drift + fairness + calibration detection over tabular predictions.",
    )

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:  # noqa: RUF029
        return {
            "status": "ok",
            "version": __version__,
            "service": "detect-tabular",
        }

    @app.post("/detect/run")
    async def detect_run(_payload: DetectRunRequest) -> JSONResponse:  # noqa: RUF029
        # Real Evidently / fairlearn / NannyML wiring lands in Task 3.
        return JSONResponse(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            content={
                "status": "not_implemented",
                "detail": (
                    "Tabular detection wiring lands in Phase 3 Task 3 "
                    "(Evidently + fairlearn + NannyML)."
                ),
            },
        )

    _ = (healthz, detect_run)  # silence pyright on decorator-registered handlers

    return app


app = build_app()
