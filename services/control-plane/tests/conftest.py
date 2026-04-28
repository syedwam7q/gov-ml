"""Shared pytest fixtures for the control plane.

The DB fixtures use whatever Postgres is reachable via `DATABASE_URL`. In
GitHub Actions CI the workflow spins up a Postgres service container and
sets the env. Locally, point at any Postgres instance you have running:

    export DATABASE_URL=postgresql+asyncpg://localhost/aegis_test

Tests that need the DB are decorated with `@pytest.mark.db` and skip
gracefully when `DATABASE_URL` is not configured.
"""

from __future__ import annotations

import os
import secrets
import subprocess
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from aegis_control_plane.db import make_engine, make_session_factory
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

CONTROL_PLANE_DIR = Path(__file__).resolve().parents[1]


def _database_url_or_skip() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        pytest.skip("DATABASE_URL not configured; skipping integration tests")
    return url


@pytest_asyncio.fixture(scope="session")
async def db_engine() -> AsyncIterator[AsyncEngine]:
    """Session-scoped async engine bound to a freshly-migrated schema."""
    url = _database_url_or_skip()
    # Run alembic upgrade head once per session against the configured DB.
    # We isolate runs by appending a random schema suffix in CI; locally
    # users point at a throwaway database.
    env = {**os.environ, "DATABASE_URL": url}
    cmd = ["uv", "run", "alembic", "upgrade", "head"]  # noqa: S603, S607
    subprocess.run(cmd, cwd=CONTROL_PLANE_DIR, check=True, env=env)  # noqa: S603
    engine = make_engine(url)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Per-test session inside a transaction that rolls back at the end.

    Every test gets a clean slate without truncating tables — much faster
    than re-migrating between tests.
    """
    factory: async_sessionmaker[AsyncSession] = make_session_factory(db_engine)
    async with db_engine.connect() as connection:
        outer = await connection.begin()
        async with factory(bind=connection) as session:
            try:
                yield session
            finally:
                await session.close()
                await outer.rollback()


@pytest.fixture
def hmac_secret() -> str:
    """Generates a fresh HMAC secret for each test."""
    return secrets.token_hex(64)


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "db: requires DATABASE_URL")
