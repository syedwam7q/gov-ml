"""Async SQLAlchemy engine + session factory + FastAPI dependency."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from aegis_control_plane.config import get_settings


def _normalise_async_postgres_url(url: str) -> str:
    """SQLAlchemy needs `postgresql+asyncpg://...` for async. Operators
    typically paste a plain `postgresql://...` from their cloud provider
    (Neon, Supabase, RDS), which defaults to the psycopg2 sync driver
    and crashes with `ModuleNotFoundError: psycopg2` since we only
    install asyncpg. Rewrite the scheme automatically so the .env stays
    operator-friendly.

    Also strips Postgres connection params that asyncpg doesn't accept
    on the URL (`channel_binding`, `sslmode` — asyncpg uses `ssl='require'`
    via connect args, not a query param). We keep `sslmode=require`
    behavior implicitly since most managed Postgres providers force TLS
    at the network layer anyway.
    """
    target = url
    if target.startswith("postgresql://"):
        target = "postgresql+asyncpg://" + target[len("postgresql://") :]
    elif target.startswith("postgres://"):
        target = "postgresql+asyncpg://" + target[len("postgres://") :]
    # asyncpg rejects `channel_binding` / `sslmode` query params.
    for bad_param in ("channel_binding=require", "channel_binding=disable", "sslmode=require"):
        target = (
            target.replace("?" + bad_param + "&", "?")
            .replace("&" + bad_param, "")
            .replace("?" + bad_param, "")
        )
    return target


def make_engine(url: str | None = None) -> AsyncEngine:
    """Construct a fresh async engine. Used in production and in tests."""
    target_url = url or get_settings().database_url
    if not target_url:
        msg = "DATABASE_URL is not configured"
        raise RuntimeError(msg)
    target_url = _normalise_async_postgres_url(target_url)
    return create_async_engine(target_url, pool_pre_ping=True, future=True)


def make_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Construct a fresh session factory bound to `engine`."""
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


# Module-level singletons populated lazily on first request. Tests use their
# own engine + factory via fixtures — they never touch these.
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _get_engine() -> AsyncEngine:
    global _engine, _session_factory
    if _engine is None:
        _engine = make_engine()
        _session_factory = make_session_factory(_engine)
    return _engine


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _get_engine()
        assert _session_factory is not None
    return _session_factory


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields one session per request."""
    factory = _get_session_factory()
    async with factory() as session:
        yield session


async def dispose_engine() -> None:
    """Tear-down hook for tests and graceful shutdown."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
