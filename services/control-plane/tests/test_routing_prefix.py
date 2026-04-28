"""Lock the public path prefix.

Every dashboard-facing route lives under `/api/cp/*`. Health probes
(`/healthz`, `/readyz`) stay at the root because they're platform-level
endpoints consumed by Vercel + cron orchestration, not by the dashboard.

If a router is accidentally mounted under the legacy `/api/v1` prefix,
the second test catches it before the dashboard's typecheck does.
"""

from __future__ import annotations

from aegis_control_plane.app import build_app

REQUIRED_PUBLIC_PREFIXES = (
    "/api/cp/models",
    "/api/cp/policies",
    "/api/cp/decisions",
    "/api/cp/audit",
    "/api/cp/signals",
    "/api/cp/stream",
    "/api/cp/internal",  # broadcast + cron handlers
)

# These platform-level endpoints stay at root and must not move.
ROOT_LEVEL_PATHS = ("/healthz", "/readyz")


def _all_paths() -> set[str]:
    app = build_app()
    return {r.path for r in app.routes if hasattr(r, "path") and isinstance(r.path, str)}


def test_every_public_router_lives_under_api_cp() -> None:
    paths = _all_paths()
    for prefix in REQUIRED_PUBLIC_PREFIXES:
        matched = [p for p in paths if p.startswith(prefix)]
        assert matched, f"missing public prefix {prefix!r}; routes are: {sorted(paths)}"


def test_no_legacy_api_v1_routes_remain() -> None:
    paths = _all_paths()
    leaked = sorted(p for p in paths if p.startswith("/api/v1"))
    assert leaked == [], f"legacy /api/v1 routes still mounted: {leaked}"


def test_health_endpoints_still_at_root() -> None:
    paths = _all_paths()
    for required in ROOT_LEVEL_PATHS:
        assert required in paths, f"health endpoint {required!r} missing; routes: {sorted(paths)}"
