"""Alembic environment — async SQLAlchemy engine, DATABASE_URL from env.

Operators paste a plain `postgresql://...` URL from their cloud
provider (Neon / Supabase / RDS). Without normalisation, SQLAlchemy
defaults to the sync psycopg2 driver — and we only ship asyncpg, so
alembic crashes with `InvalidRequestError: The asyncio extension
requires an async driver`. We share the same `normalise_async_postgres_url`
helper used at runtime in `aegis_control_plane.db` so `alembic upgrade
head` and the live app see the exact same URL transformation.
"""

from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig

from aegis_control_plane.db import normalise_async_postgres_url
from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _get_url() -> str:
    raw = os.environ.get("DATABASE_URL", "postgresql+asyncpg://localhost/aegis_dev")
    return normalise_async_postgres_url(raw)


def run_migrations_offline() -> None:
    context.configure(
        url=_get_url(),
        target_metadata=None,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=None)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    config.set_main_option("sqlalchemy.url", _get_url())
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
