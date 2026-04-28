"""FastAPI application factory for the Governance Assistant."""

from __future__ import annotations

from fastapi import FastAPI

from aegis_assistant import __version__
from aegis_assistant.routers import chat as chat_router
from aegis_assistant.routers import health as health_router


def build_app() -> FastAPI:
    """Construct a fresh FastAPI app. Used in production and in tests."""
    app = FastAPI(
        title="Aegis Governance Assistant",
        version=__version__,
        description=(
            "Groq-powered tool-using agent grounded on the MAPE-K knowledge"
            " plane (spec §11). Every claim must reference a tool call."
        ),
    )
    app.include_router(health_router.router)
    app.include_router(chat_router.router)
    return app


app = build_app()
