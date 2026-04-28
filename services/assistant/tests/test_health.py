"""Health-probe smoke tests for the assistant service."""

from __future__ import annotations

from aegis_assistant.app import build_app
from fastapi.testclient import TestClient


def test_healthz_returns_ok() -> None:
    client = TestClient(build_app())
    res = client.get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["service"] == "assistant"


def test_readyz_returns_ready() -> None:
    client = TestClient(build_app())
    res = client.get("/readyz")
    assert res.status_code == 200
    body = res.json()
    assert body["ready"] is True
    assert "ts" in body
