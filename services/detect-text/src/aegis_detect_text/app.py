"""FastAPI app for the text detector — `/detect/text/run`."""

from __future__ import annotations

import numpy as np
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from aegis_detect_text import __version__
from aegis_detect_text.mmd import detect_text_drift
from aegis_shared.schemas import DriftSignal


class DetectTextRunRequest(BaseModel):
    """Body of `POST /detect/text/run`.

    Embeddings are passed inline as 2D float arrays. Production callers
    encode text via `encode()` before posting; tests pass synthetic
    arrays directly so they don't need the [nlp] extras installed.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    model_id: str = Field(min_length=1)
    window_secs: int = Field(ge=60, le=86_400)
    reference_blob_url: str = Field(min_length=1)
    reference_embeddings: list[list[float]] | None = None
    current_embeddings: list[list[float]] | None = None
    n_permutations: int = Field(default=100, ge=10, le=1000)


class DetectTextRunResponse(BaseModel):
    """Body of `POST /detect/text/run`."""

    model_config = ConfigDict(extra="forbid")

    signals: list[DriftSignal]
    rows_evaluated: int


def build_app() -> FastAPI:
    app = FastAPI(
        title="Aegis · Text Detector",
        version=__version__,
        description=(
            "Text drift detection via MMD on sentence-transformer embeddings. "
            "Pure-numpy MMD; sentence-transformers is an opt-in [nlp] extra."
        ),
    )

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:  # noqa: RUF029
        return {
            "status": "ok",
            "version": __version__,
            "service": "detect-text",
        }

    @app.post("/detect/text/run", response_model=DetectTextRunResponse)
    async def detect_text_run(  # noqa: RUF029
        payload: DetectTextRunRequest,
    ) -> DetectTextRunResponse:
        ref = payload.reference_embeddings
        cur = payload.current_embeddings
        if ref is None and cur is None:
            return DetectTextRunResponse(signals=[], rows_evaluated=0)
        if ref is None or cur is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="both reference_embeddings and current_embeddings must be provided",
            )
        ref_arr = np.asarray(ref, dtype=np.float32)
        cur_arr = np.asarray(cur, dtype=np.float32)
        if ref_arr.ndim != 2 or cur_arr.ndim != 2:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="embeddings must be 2D arrays (n_examples × embedding_dim)",
            )
        signals = detect_text_drift(
            model_id=payload.model_id,
            reference_embeddings=ref_arr,
            current_embeddings=cur_arr,
            n_permutations=payload.n_permutations,
        )
        return DetectTextRunResponse(signals=signals, rows_evaluated=len(cur_arr))

    _ = (healthz, detect_text_run)

    return app


app = build_app()
