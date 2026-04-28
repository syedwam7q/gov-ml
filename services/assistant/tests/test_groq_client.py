"""Tests for the Groq client wrapper — model rotation + 503 surface."""

from __future__ import annotations

import pytest
from aegis_assistant import groq_client
from aegis_assistant.config import Settings, get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    """The lru_cache on get_settings() persists across tests; reset it
    so monkeypatched env vars take effect."""
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_chat_completion_raises_when_no_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty GROQ_API_KEY → GroqUnavailableError → 503 from /chat/stream."""

    def _no_key_settings() -> Settings:
        # `_env_file=None` bypasses any repo-level .env file so this test
        # is hermetic and works on a developer machine that has Groq
        # configured for live use.
        return Settings(_env_file=None, GROQ_API_KEY="")

    monkeypatch.setattr(groq_client, "get_settings", _no_key_settings)
    with pytest.raises(groq_client.GroqUnavailableError):
        await groq_client.chat_completion(messages=[{"role": "user", "content": "hi"}])


def test_settings_have_default_two_model_rotation() -> None:
    """The two-model rotation IDs (spec §11.1) are pinned in defaults."""
    fresh = Settings(_env_file=None)
    assert fresh.groq_model_fast == "llama-3.1-8b-instant"
    assert fresh.groq_model_quality == "llama-3.3-70b-versatile"


def test_settings_respect_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROQ_MODEL_FAST", "custom-fast-model")
    monkeypatch.setenv("GROQ_MODEL_QUALITY", "custom-quality-model")
    s = Settings(_env_file=None)
    assert s.groq_model_fast == "custom-fast-model"
    assert s.groq_model_quality == "custom-quality-model"
