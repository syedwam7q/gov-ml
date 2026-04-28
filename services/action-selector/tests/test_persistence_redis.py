"""Redis-backed BLR persistence (Phase 8 follow-up to Phase 7).

We exercise the round-trip with `fakeredis` so the test suite stays
hermetic — no real Redis required.
"""

from __future__ import annotations

import fakeredis.aioredis as fakeredis
import numpy as np
import pytest
from aegis_action_selector.actions import ActionKey
from aegis_action_selector.persistence import (
    _bandit_from_dict,
    _bandit_to_dict,
    get_or_create_bandit,
    install_bandit,
    load_bandit_from_redis,
    reset,
    save_bandit_to_redis,
)


@pytest.fixture(autouse=True)
def _reset() -> None:
    reset()


def test_serialization_roundtrip_preserves_posterior() -> None:
    """Serialize → deserialize must reproduce precision + dual exactly."""
    bandit = get_or_create_bandit("credit-v1", n_features=4)
    bandit.update(
        ActionKey.REWEIGH,
        context=np.array([0.5, 0.5, 0.5, 0.5]),
        reward_vector=np.array([0.001, 0.20, -2.0, -0.4]),
        observed_cost_vector=np.array([1.0, 0.5, 50.0, 0.3]),
        budget=np.array([100.0, 50.0, 5_000.0, 30.0]),
        horizon_remaining=100,
    )
    expected_lambda = bandit.lambda_dual.copy()
    expected_precision = bandit.reward_oracles[ActionKey.REWEIGH][0].precision_matrix.copy()

    payload = _bandit_to_dict(bandit)
    restored = _bandit_from_dict(payload, n_features=4)

    np.testing.assert_array_almost_equal(restored.lambda_dual, expected_lambda)
    np.testing.assert_array_almost_equal(
        restored.reward_oracles[ActionKey.REWEIGH][0].precision_matrix, expected_precision
    )
    # Reward oracle for REWEIGH should have non-zero precision (was updated).
    rew_oracle = restored.reward_oracles[ActionKey.REWEIGH][0]
    assert not np.allclose(rew_oracle.precision_matrix, np.eye(4))


@pytest.mark.asyncio
async def test_save_and_load_round_trips_through_fakeredis() -> None:
    redis_client = fakeredis.FakeRedis()
    bandit = get_or_create_bandit("credit-v1", n_features=4)
    bandit.update(
        ActionKey.REWEIGH,
        context=np.array([0.5, 0.5, 0.5, 0.5]),
        reward_vector=np.array([0.001, 0.20, -2.0, -0.4]),
        observed_cost_vector=np.array([1.0, 0.5, 50.0, 0.3]),
        budget=np.array([100.0, 50.0, 5_000.0, 30.0]),
        horizon_remaining=100,
    )
    expected_lambda = bandit.lambda_dual.copy()

    await save_bandit_to_redis("credit-v1", redis_client=redis_client)
    reset()  # drop in-memory state — simulate process restart

    restored = await load_bandit_from_redis("credit-v1", n_features=4, redis_client=redis_client)
    assert restored is not None
    np.testing.assert_array_almost_equal(restored.lambda_dual, expected_lambda)


@pytest.mark.asyncio
async def test_load_returns_none_when_key_missing() -> None:
    redis_client = fakeredis.FakeRedis()
    result = await load_bandit_from_redis("no-such-model", n_features=4, redis_client=redis_client)
    assert result is None


@pytest.mark.asyncio
async def test_save_is_noop_when_bandit_not_registered() -> None:
    """Don't write a stale payload if there's nothing to write."""
    redis_client = fakeredis.FakeRedis()
    await save_bandit_to_redis("ghost-model", redis_client=redis_client)
    keys = await redis_client.keys("action_selector:bandit:*")
    assert keys == []


@pytest.mark.asyncio
async def test_load_corrupt_payload_returns_none() -> None:
    """A malformed Redis payload should fall back to fresh, not crash."""
    redis_client = fakeredis.FakeRedis()
    await redis_client.set("action_selector:bandit:credit-v1", "not-valid-json{")
    result = await load_bandit_from_redis("credit-v1", n_features=4, redis_client=redis_client)
    assert result is None


@pytest.mark.asyncio
async def test_install_bandit_replaces_in_memory_state() -> None:
    """After Redis hydration, install_bandit puts the restored state back
    in the registry so subsequent get_or_create returns it."""
    redis_client = fakeredis.FakeRedis()
    original = get_or_create_bandit("credit-v1", n_features=4)
    original.lambda_dual = np.array([0.1, 0.2, 0.3, 0.4])
    await save_bandit_to_redis("credit-v1", redis_client=redis_client)
    reset()
    restored = await load_bandit_from_redis("credit-v1", n_features=4, redis_client=redis_client)
    assert restored is not None
    install_bandit("credit-v1", restored)
    fetched = get_or_create_bandit("credit-v1", n_features=4)
    np.testing.assert_array_almost_equal(fetched.lambda_dual, np.array([0.1, 0.2, 0.3, 0.4]))
