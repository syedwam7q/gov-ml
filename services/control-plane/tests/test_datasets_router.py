"""Tests for `/api/cp/datasets` and the dataset seeder."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest
from aegis_control_plane import db as db_module
from aegis_control_plane.app import build_app
from aegis_control_plane.orm import DatasetRow
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def test_datasets_returns_empty_list_with_stub_session() -> None:
    """Empty registry → empty list, no errors. No DB required."""

    class _StubResult:
        def scalars(self) -> Any:
            return self

        def all(self) -> list[Any]:
            return []

    class _StubSession:
        async def execute(self, *_: object, **__: object) -> Any:
            return _StubResult()

    async def _override() -> AsyncIterator[Any]:
        yield _StubSession()

    app = build_app()
    app.dependency_overrides[db_module.get_session] = _override
    try:
        res = TestClient(app).get("/api/cp/datasets")
        assert res.status_code == 200
        assert res.json() == []
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
@pytest.mark.db
async def test_seed_datasets_inserts_three_seeded_corpora(db_session: AsyncSession) -> None:
    """The dataset seeder creates the three real-world corpora from spec Appendix A."""
    from aegis_control_plane.seed import seed_datasets

    inserted = await seed_datasets(db_session)
    assert inserted == 3, "first pass should insert all three datasets"

    rows = (await db_session.execute(select(DatasetRow).order_by(DatasetRow.id))).scalars().all()
    ids = {r.id for r in rows}
    assert ids == {"hmda-2018-public-lar", "civil-comments-jigsaw", "diabetes-130-uci"}

    # Each row carries the full Datasheet bundle.
    for row in rows:
        assert row.row_count > 0
        assert row.source_url.startswith("http")
        assert isinstance(row.model_ids, list)
        assert len(row.model_ids) > 0
        assert row.datasheet is not None
        assert "motivation" in row.datasheet
        assert row.snapshots is not None
        assert len(row.snapshots) >= 1
        assert row.schema_overview is not None
        assert len(row.schema_overview) >= 5


@pytest.mark.asyncio
@pytest.mark.db
async def test_seed_datasets_is_idempotent(db_session: AsyncSession) -> None:
    """Running the dataset seeder twice doesn't insert duplicates."""
    from aegis_control_plane.seed import seed_datasets

    first = await seed_datasets(db_session)
    second = await seed_datasets(db_session)
    assert first == 3
    assert second == 0


@pytest.mark.asyncio
@pytest.mark.db
async def test_dataset_row_to_json_projection_matches_dashboard_shape(
    db_session: AsyncSession,
) -> None:
    """Direct projection check — mirrors the router's `_row_to_dataset` shape."""
    from aegis_control_plane.routers.datasets import _row_to_dataset
    from aegis_control_plane.seed import seed_datasets

    await seed_datasets(db_session)
    rows = (await db_session.execute(select(DatasetRow))).scalars().all()
    for row in rows:
        projected = _row_to_dataset(row)
        # Required dashboard `Dataset` fields.
        for field in (
            "id",
            "name",
            "description",
            "source",
            "source_url",
            "created_at",
            "row_count",
            "snapshot_id",
            "model_ids",
        ):
            assert field in projected, f"projection missing {field}"
        # The DB column is `schema_overview`; the dashboard expects `schema`.
        assert "schema" in projected
        assert "schema_overview" not in projected
