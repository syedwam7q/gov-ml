"""Runtime configuration sourced from environment via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Aegis control-plane runtime settings.

    Read from environment variables (or `.env` for local dev — never commit `.env`).
    Sensitive values default to empty strings; runtime code raises if it tries to
    use one without an explicit value.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", frozen=True
    )

    database_url: str = Field(default="", alias="DATABASE_URL")
    """Postgres async URL — `postgresql+asyncpg://user:pass@host/db`."""

    audit_log_hmac_secret: str = Field(default="", alias="AUDIT_LOG_HMAC_SECRET")
    """HMAC secret for signing audit-log row hashes (64 hex chars; `openssl rand -hex 64`)."""

    inter_service_hmac_secret: str = Field(default="", alias="INTER_SERVICE_HMAC_SECRET")
    """Shared HMAC secret for inter-service auth on internal endpoints."""

    emergency_stop: bool = Field(default=False, alias="EMERGENCY_STOP")
    """Global kill-switch. Admin-only via the dashboard."""

    tinybird_token: str = Field(default="", alias="TINYBIRD_TOKEN")
    """Bearer token for Tinybird Build plan — read-only `.json` pipe endpoints."""

    tinybird_host: str = Field(default="https://api.tinybird.co", alias="TINYBIRD_HOST")
    """Tinybird API host. Defaults to public endpoint; override for EU region."""

    @property
    def database_url_sync(self) -> str:
        """Sync variant for Alembic offline mode."""
        return self.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor — read once per process."""
    return Settings()
