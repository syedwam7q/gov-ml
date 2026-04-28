"""Tests for the tabular detector app."""

import numpy as np
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
async def test_detect_run_validates_window_secs() -> None:
    from aegis_detect_tabular.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/detect/run",
            json={
                "model_id": "credit-v1",
                "window_secs": 1,
                "reference_blob_url": "blob://x",
            },
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_detect_run_returns_empty_when_no_rows() -> None:
    from aegis_detect_tabular.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/detect/run",
            json={
                "model_id": "credit-v1",
                "window_secs": 300,
                "reference_blob_url": "blob://placeholder",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["signals"] == []
    assert body["rows_evaluated"] == 0


@pytest.mark.asyncio
async def test_detect_run_emits_signals_for_shifted_data() -> None:
    from aegis_detect_tabular.app import build_app

    app = build_app()
    rng = np.random.default_rng(0)
    n = 300
    ref_rows = [{"income": float(x)} for x in rng.normal(60_000, 20_000, size=n)]
    gender = rng.choice(["M", "F"], size=n)
    income_cur = rng.normal(80_000, 20_000, size=n)
    pred = np.where(gender == "F", rng.uniform(0, 0.4, size=n), rng.uniform(0.6, 1.0, size=n))
    cur_rows = [
        {"income": float(income_cur[i]), "gender": str(gender[i]), "y_pred": float(pred[i])}
        for i in range(n)
    ]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/detect/run",
            json={
                "model_id": "credit-v1",
                "window_secs": 300,
                "reference_blob_url": "blob://placeholder",
                "reference_rows": ref_rows,
                "current_rows": cur_rows,
                "numeric_columns": ["income"],
                "sensitive_columns": ["gender"],
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows_evaluated"] == n
    metrics = {s["metric"] for s in body["signals"]}
    assert "drift_psi_income" in metrics
    assert "demographic_parity_gender" in metrics
