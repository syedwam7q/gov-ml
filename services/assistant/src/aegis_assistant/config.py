"""Runtime configuration sourced from environment via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache

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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor — read once per process."""
    return Settings()
