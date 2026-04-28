"""Tests for `/api/cp/audit/export.csv`."""

from __future__ import annotations

import csv
from collections.abc import AsyncIterator
from io import StringIO
from typing import Any

import pytest
from aegis_control_plane import db as db_module
from aegis_control_plane.app import build_app
from fastapi.testclient import TestClient


def test_export_returns_csv_content_type_with_stub_session() -> None:
    """The endpoint must declare text/csv even on an empty chain."""

    class _StubSession:
        async def stream(self, *_: object, **__: object) -> Any:
            class _AsyncIter:
                async def partitions(self, _n: int) -> AsyncIterator[list[Any]]:
                    if False:  # pragma: no cover — empty generator
                        yield []
                    return

            return _AsyncIter()

    async def _override() -> AsyncIterator[Any]:
        yield _StubSession()

    app = build_app()
    app.dependency_overrides[db_module.get_session] = _override
    try:
        client = TestClient(app)
        res = client.get("/api/cp/audit/export.csv")
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")
        assert "filename=aegis-audit-chain.csv" in res.headers["content-disposition"]
        # Empty chain → just the header row.
        rows = list(csv.reader(StringIO(res.text)))
        assert rows[0] == [
            "sequence_n",
            "ts",
            "actor",
            "action",
            "payload",
            "prev_hash",
            "row_hash",
            "signature",
        ]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
@pytest.mark.db
async def test_export_streams_real_audit_rows(db_session, hmac_secret: str) -> None:  # type: ignore[no-untyped-def]
    """Insert a couple of audit rows and verify the CSV contains them in order."""
    # Configure audit secret for the test process.
    import os
    from datetime import UTC, datetime

    from aegis_control_plane.audit_writer import append_audit_row
    from aegis_control_plane.config import get_settings

    os.environ["AUDIT_LOG_HMAC_SECRET"] = hmac_secret
    get_settings.cache_clear()

    await append_audit_row(
        db_session,
        actor="system:test",
        action="detect",
        payload={"summary": "test row 1"},
        decision_id=None,
        ts=datetime(2026, 4, 28, 12, 0, 0, tzinfo=UTC),
    )
    await append_audit_row(
        db_session,
        actor="system:test",
        action="analyze",
        payload={"summary": "test row 2"},
        decision_id=None,
        ts=datetime(2026, 4, 28, 12, 1, 0, tzinfo=UTC),
    )
    await db_session.flush()

    async def _override() -> AsyncIterator[Any]:
        yield db_session

    app = build_app()
    app.dependency_overrides[db_module.get_session] = _override
    try:
        client = TestClient(app)
        res = client.get("/api/cp/audit/export.csv")
        assert res.status_code == 200
        rows = list(csv.reader(StringIO(res.text)))
        assert len(rows) == 3  # header + 2 rows
        assert rows[1][2] == "system:test"
        assert rows[1][3] == "detect"
        assert rows[2][3] == "analyze"
    finally:
        app.dependency_overrides.clear()
