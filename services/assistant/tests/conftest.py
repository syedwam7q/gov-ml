"""Shared pytest fixtures for the assistant test suite."""

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest


@pytest.fixture
async def http_client() -> AsyncIterator[httpx.AsyncClient]:
    """An async httpx client for tests that exercise dispatchers directly."""
    async with httpx.AsyncClient() as client:
        yield client
