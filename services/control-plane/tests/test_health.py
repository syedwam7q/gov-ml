"""Tests for /healthz and /readyz."""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_healthz_returns_ok() -> None:
    from aegis_control_plane.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body


@pytest.mark.asyncio
async def test_readyz_returns_ok_with_dep_report() -> None:
    from aegis_control_plane.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/readyz")
    assert resp.status_code == 200
    body = resp.json()
    assert "deps" in body
    assert "database" in body["deps"]


@pytest.mark.asyncio
async def test_root_redirects() -> None:
    from aegis_control_plane.app import build_app

    app = build_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as ac:
        resp = await ac.get("/")
    assert resp.status_code in (200, 307, 308)
