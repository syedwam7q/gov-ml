"""Runtime configuration sourced from environment via pydantic-settings.

Settings are mtime-aware: editing `.env` (e.g. rotating
`GROQ_API_KEY`) takes effect on the next request, no process restart
needed. The cache key is the file's modification time — when it
changes, we re-instantiate `Settings()` (which re-reads `.env` via
pydantic-settings) and overwrite the cache. Cost per call: one
`stat()` syscall, ~microseconds.

Why not rely on uvicorn's `--reload-include='.env'`: watchfiles
ignores hidden files (anything starting with `.`) by default, and
the `*.env` glob doesn't match the dotfile name. We tried both;
this app-layer cache is the robust fix.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Aegis Governance Assistant settings (spec §11)."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", frozen=True
    )

    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    """Groq dev-tier API key. Empty = `/chat/stream` returns 503 and the
    dashboard renders a polite fallback message — the rest of the
    surface (health checks, dashboard pages) keeps working."""

    groq_model_quality: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL_QUALITY")
    """Used for the final synthesis step — quality matters more than latency."""

    groq_model_fast: str = Field(default="llama-3.1-8b-instant", alias="GROQ_MODEL_FAST")
    """Used for tool-call decision steps — cheap and fast."""

    control_plane_url: str = Field(default="http://localhost:8000", alias="CONTROL_PLANE_URL")
    causal_attrib_url: str = Field(default="http://localhost:8003", alias="CAUSAL_ATTRIB_URL")
    action_selector_url: str = Field(default="http://localhost:8004", alias="ACTION_SELECTOR_URL")

    chat_max_iterations: int = Field(default=6, alias="CHAT_MAX_ITERATIONS", ge=1, le=20)
    """Hard cap on tool-call loop iterations per chat turn — protects
    against the model getting stuck in a tool-call ping-pong."""

    tool_request_timeout_s: float = Field(
        default=10.0, alias="TOOL_REQUEST_TIMEOUT_S", ge=1.0, le=60.0
    )
    """Per-request HTTP timeout for tool dispatchers."""


# `pydantic-settings` resolves `env_file=".env"` relative to the
# current working directory at instantiation time. We capture the
# resolved path once at import so the mtime probe always points at
# the same file the operator is editing.
_ENV_PATH: Path = Path(".env").resolve()
_log = logging.getLogger(__name__)
_cache_lock = threading.Lock()
_cache: tuple[float, Settings] | None = None


def _env_mtime() -> float:
    try:
        return _ENV_PATH.stat().st_mtime if _ENV_PATH.exists() else 0.0
    except OSError:
        return 0.0


def get_settings() -> Settings:
    """Return Settings, re-reading `.env` if its mtime has changed.

    Thread-safe: the cache is guarded by a Lock so concurrent requests
    racing in immediately after a key rotation construct exactly one
    fresh `Settings()` rather than N.
    """
    global _cache
    mtime = _env_mtime()
    cache_local = _cache  # snapshot for fast-path read without the lock
    if cache_local is not None and cache_local[0] == mtime:
        return cache_local[1]

    with _cache_lock:
        # Re-check inside the lock — another thread may have refreshed
        # while we were waiting.
        cache_local = _cache
        if cache_local is not None and cache_local[0] == mtime:
            return cache_local[1]
        fresh = Settings()
        _cache = (mtime, fresh)
        if cache_local is not None:
            # Log only on actual reload (not on first load) so operators
            # see a clear "config refreshed" line in the assistant log
            # right after they save .env.
            _log.info(
                "config: .env mtime changed → reloaded settings (GROQ_API_KEY fingerprint=%s…%s)",
                fresh.groq_api_key[:8] if fresh.groq_api_key else "(empty)",
                fresh.groq_api_key[-4:] if fresh.groq_api_key else "",
            )
        return fresh


def reset_settings_cache() -> None:
    """Test-only: clear the mtime cache so monkeypatched envs are picked up."""
    global _cache
    with _cache_lock:
        _cache = None
