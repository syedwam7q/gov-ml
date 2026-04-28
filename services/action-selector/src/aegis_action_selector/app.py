"""FastAPI application factory for the action-selector worker."""

from __future__ import annotations

from fastapi import FastAPI

from aegis_action_selector import __version__
from aegis_action_selector.routers import health as health_router


def build_app() -> FastAPI:
    """Construct a fresh FastAPI app. Used in production and in tests."""
    app = FastAPI(
        title="Aegis Action Selector",
        version=__version__,
        description=(
            "Pareto-optimal action selection via Contextual Bandits with"
            " Knapsacks (Slivkins, Sankararaman & Foster JMLR 2024)."
        ),
    )
    app.include_router(health_router.router)
    return app


app = build_app()
