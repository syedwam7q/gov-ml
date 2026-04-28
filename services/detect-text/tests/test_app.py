"""Tests for the text detector app."""

from __future__ import annotations

import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_healthz_returns_ok() -> None:
    from aegis_detect_text.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["service"] == "detect-text"


@pytest.mark.asyncio
async def test_detect_text_run_validates_window_secs() -> None:
    from aegis_detect_text.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/detect/text/run",
            json={
                "model_id": "toxicity-v3",
                "window_secs": 1,
                "reference_blob_url": "blob://x",
            },
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_detect_text_run_returns_empty_when_no_embeddings() -> None:
    from aegis_detect_text.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/detect/text/run",
            json={
                "model_id": "toxicity-v3",
                "window_secs": 300,
                "reference_blob_url": "blob://placeholder",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["signals"] == []
    assert body["rows_evaluated"] == 0


@pytest.mark.asyncio
async def test_detect_text_run_emits_high_severity_for_shifted_distribution() -> None:
    from aegis_detect_text.app import build_app

    app = build_app()
    rng = np.random.default_rng(0)
    n, dim = 150, 16
    ref = rng.normal(0.0, 1.0, size=(n, dim)).astype(np.float32).tolist()
    cur = rng.normal(3.0, 1.0, size=(n, dim)).astype(np.float32).tolist()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/detect/text/run",
            json={
                "model_id": "toxicity-v3",
                "window_secs": 300,
                "reference_blob_url": "blob://placeholder",
                "reference_embeddings": ref,
                "current_embeddings": cur,
                "n_permutations": 100,
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows_evaluated"] == n
    assert any(s["metric"] == "text_drift_mmd" for s in body["signals"])
    assert any(s["severity"] in ("HIGH", "MEDIUM") for s in body["signals"])
