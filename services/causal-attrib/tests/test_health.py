"""Tests for the health endpoints."""

from __future__ import annotations

from aegis_causal_attrib.app import build_app
from fastapi.testclient import TestClient


def test_healthz_returns_ok() -> None:
    res = TestClient(build_app()).get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["service"] == "causal-attrib"


def test_readyz_returns_ready() -> None:
    res = TestClient(build_app()).get("/readyz")
    assert res.status_code == 200
    assert res.json()["ready"] is True
