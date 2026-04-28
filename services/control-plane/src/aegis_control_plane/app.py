"""FastAPI application factory for the control plane."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from aegis_control_plane import __version__
from aegis_control_plane.routers import audit as audit_router
from aegis_control_plane.routers import decisions as decisions_router
from aegis_control_plane.routers import health as health_router
from aegis_control_plane.routers import models as models_router
from aegis_control_plane.routers import policies as policies_router


def build_app() -> FastAPI:
    """Construct a fresh FastAPI app. Used in production and in tests."""
    app = FastAPI(
        title="Aegis Control Plane",
        version=__version__,
        description=(
            "MAPE-K orchestrator and sole audit-log writer for the Aegis ML governance platform."
        ),
    )

    app.include_router(health_router.router)
    app.include_router(models_router.router)
    app.include_router(policies_router.router)
    app.include_router(audit_router.router)
    app.include_router(decisions_router.router)

    @app.get("/", include_in_schema=False)
    async def _root() -> RedirectResponse:  # noqa: RUF029  # registered by decorator
        return RedirectResponse(url="/healthz")

    _ = _root  # silence pyright reportUnusedFunction — used via decorator registration

    return app


app = build_app()
