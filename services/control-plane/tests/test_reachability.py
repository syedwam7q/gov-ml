"""Tests for `/api/cp/reachability`."""

from __future__ import annotations

from aegis_control_plane import __version__
from aegis_control_plane.app import build_app
from fastapi.testclient import TestClient


def test_reachability_returns_ok_with_version() -> None:
    res = TestClient(build_app()).get("/api/cp/reachability")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["version"] == __version__
    assert "ts" in body


def test_reachability_does_not_require_db_or_tinybird() -> None:
    """The probe deliberately doesn't touch downstream deps so it's fast + always-up."""
    res = TestClient(build_app()).get("/api/cp/reachability")
    assert res.status_code == 200, "endpoint must not depend on DB / Tinybird"
