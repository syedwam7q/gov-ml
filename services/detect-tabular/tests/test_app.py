"""Tests for the tabular detector skeleton."""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_healthz_returns_ok() -> None:
    from aegis_detect_tabular.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["service"] == "detect-tabular"


@pytest.mark.asyncio
async def test_detect_run_skeleton_returns_501() -> None:
    from aegis_detect_tabular.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/detect/run",
            json={
                "model_id": "credit-v1",
                "window_secs": 300,
                "reference_blob_url": "blob://ref/credit-v1.parquet",
            },
        )
    assert resp.status_code == 501
    body = resp.json()
    assert body["status"] == "not_implemented"
    assert "Phase 3 Task 3" in body["detail"]


@pytest.mark.asyncio
async def test_detect_run_validates_input() -> None:
    from aegis_detect_tabular.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # window_secs below the floor must fail validation
        resp = await ac.post(
            "/detect/run",
            json={
                "model_id": "credit-v1",
                "window_secs": 1,
                "reference_blob_url": "blob://x",
            },
        )
    assert resp.status_code == 422
