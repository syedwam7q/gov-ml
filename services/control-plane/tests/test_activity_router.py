"""Tests for `/api/cp/activity` — the dashboard's activity feed.

The feed enriches audit-log rows with the parent decision's severity +
model_id when available. DB-backed test is gated on `DATABASE_URL`; the
parameter-validation test stubs the session so it runs everywhere.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest
from aegis_control_plane import db as db_module
from aegis_control_plane.app import build_app
from fastapi.testclient import TestClient


def test_activity_limit_validated_with_stub_session() -> None:
    """Validation rejects out-of-range `limit` values without touching the DB."""

    async def _empty_session() -> AsyncIterator[Any]:
        # The handler queries a session, but pydantic rejects the request
        # before the handler ever runs. The stub still has to be awaitable.
        class _Stub:
            async def execute(self, *_: object, **__: object) -> Any:
                raise AssertionError("validation should reject before handler runs")

        yield _Stub()

    app = build_app()
    app.dependency_overrides[db_module.get_session] = _empty_session
    try:
        client = TestClient(app)
        assert client.get("/api/cp/activity?limit=0").status_code == 422
        assert client.get("/api/cp/activity?limit=201").status_code == 422
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
@pytest.mark.db
async def test_activity_returns_empty_list_on_fresh_db(db_session) -> None:  # type: ignore[no-untyped-def]
    """A freshly-migrated DB has no audit rows; the endpoint returns []."""

    async def _override() -> AsyncIterator[Any]:
        yield db_session

    app = build_app()
    app.dependency_overrides[db_module.get_session] = _override
    try:
        client = TestClient(app)
        res = client.get("/api/cp/activity?limit=10")
        assert res.status_code == 200
        assert res.json() == []
    finally:
        app.dependency_overrides.clear()
