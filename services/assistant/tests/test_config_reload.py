"""Tests for the mtime-aware settings cache.

Operators rotate `GROQ_API_KEY` in `.env` mid-session; the assistant
must pick up the new key on the next request without a process
restart. We verify that get_settings() re-reads `.env` when its mtime
changes, and that the cache is hit when nothing changed.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from aegis_assistant import config as config_module
from aegis_assistant.config import get_settings, reset_settings_cache


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Each test gets its own .env in a tmp dir; we point the module's
    `_ENV_PATH` at it and reset the cache."""
    fake_env = tmp_path / ".env"
    monkeypatch.setattr(config_module, "_ENV_PATH", fake_env)
    # Also chdir so pydantic-settings reads from the same .env.
    monkeypatch.chdir(tmp_path)
    # Make sure no real-shell env vars leak in for the keys we test.
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_MODEL_FAST", raising=False)
    reset_settings_cache()


def _write(env_path: Path, content: str) -> None:
    env_path.write_text(content, encoding="utf-8")


def test_first_call_reads_env(tmp_path: Path) -> None:
    _write(tmp_path / ".env", "GROQ_API_KEY=key-original-aaaa\n")
    s = get_settings()
    assert s.groq_api_key == "key-original-aaaa"


def test_second_call_returns_cached_settings(tmp_path: Path) -> None:
    """Repeated calls without an mtime change return the same object."""
    _write(tmp_path / ".env", "GROQ_API_KEY=key-cached-bbbb\n")
    first = get_settings()
    second = get_settings()
    assert first is second


def test_env_edit_picks_up_new_key(tmp_path: Path) -> None:
    """Mutating .env between calls must surface the new value — this is
    the user-visible behaviour: paste a new GROQ_API_KEY, hit send,
    next chat call uses the new key."""
    env = tmp_path / ".env"
    _write(env, "GROQ_API_KEY=key-old-1111\n")
    first = get_settings()
    assert first.groq_api_key == "key-old-1111"

    # Bump mtime explicitly — some file systems have second-resolution
    # mtimes and the test runs in <1s.
    _write(env, "GROQ_API_KEY=key-new-2222\n")
    stat = env.stat()
    os.utime(env, (stat.st_atime, stat.st_mtime + 5))

    second = get_settings()
    assert second.groq_api_key == "key-new-2222", (
        "after .env edit, get_settings() must re-read and surface the new key"
    )
    assert first is not second, "fresh Settings instance on mtime change"


def test_missing_env_file_does_not_crash(tmp_path: Path) -> None:
    """Production deployments typically use real env vars, no .env file.
    The mtime probe must tolerate a missing path."""
    s = get_settings()
    assert s.groq_api_key == ""  # default


def test_reset_settings_cache_forces_reread(tmp_path: Path) -> None:
    """The test helper must actually wipe the cache — otherwise the
    monkeypatched fixtures in other tests would see stale Settings."""
    _write(tmp_path / ".env", "GROQ_API_KEY=key-before-reset\n")
    first = get_settings()
    assert first.groq_api_key == "key-before-reset"

    _write(tmp_path / ".env", "GROQ_API_KEY=key-after-reset\n")
    reset_settings_cache()
    second = get_settings()
    assert second.groq_api_key == "key-after-reset"
