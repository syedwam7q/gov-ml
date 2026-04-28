"""Runtime configuration sourced from environment via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Aegis causal-attribution worker settings."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", frozen=True
    )

    attrib_timeout_s: float = Field(default=30.0, alias="ATTRIB_TIMEOUT_S", ge=1.0)
    """Hard timeout for one DoWhy GCM run. Spec §12.1 default = 30 s."""

    dbshap_samples: int = Field(default=2_048, alias="DBSHAP_SAMPLES", ge=128)
    """Monte-Carlo permutation budget for the DBShap fallback. Default = 2,048."""

    cache_size: int = Field(default=64, alias="CAUSAL_CACHE_SIZE", ge=1)
    """In-process cache size for `(model_id, target, ref_fp, cur_fp, num_samples)`."""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor — read once per process."""
    return Settings()
