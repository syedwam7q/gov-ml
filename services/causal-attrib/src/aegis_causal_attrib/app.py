"""FastAPI application factory for the causal-attribution worker."""

from __future__ import annotations

from fastapi import FastAPI

from aegis_causal_attrib import __version__
from aegis_causal_attrib.routers import health as health_router


def build_app() -> FastAPI:
    """Construct a fresh FastAPI app. Used in production and in tests."""
    app = FastAPI(
        title="Aegis Causal Attribution",
        version=__version__,
        description=(
            "Causal root-cause attribution via DoWhy GCM (Budhathoki AISTATS 2021)"
            " with DBShap fallback (Edakunni 2024)."
        ),
    )
    app.include_router(health_router.router)
    return app


app = build_app()
