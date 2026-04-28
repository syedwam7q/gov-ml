"""Per-`model_id` CB-Knapsack persistence.

Phase 7 keeps state in a process-local dict — restart and the bandit
posterior is gone. Phase 8 (this module's extended form) adds an
optional Redis backend so the posterior survives restarts on
production deployments where the action-selector instance is recycled
by Vercel Functions Fluid Compute.

Behaviour:
  * If `REDIS_URL` is set, `get_or_create_bandit` first attempts a
    cache-load from Redis and falls back to a fresh CBKnapsack.
  * If `REDIS_URL` is unset (the dev workflow default), persistence is
    purely in-memory — same shape as Phase 7.
  * `save_bandit_to_redis` and `load_bandit_from_redis` accept an
    injected redis client so tests can swap in a fake.

Serialization uses JSON with numpy arrays encoded as plain lists. The
matrices are small (n_features × n_features, typically 4×4) so JSON
keeps the wire format human-debuggable and language-neutral — a
future Rust action-selector could read the same blob without round-
tripping through Python.
"""

from __future__ import annotations

import json
import logging
from typing import Any, cast

import numpy as np
import redis.asyncio as aioredis

from aegis_action_selector.actions import ACTION_SET
from aegis_action_selector.blr import BayesianLinearRegression
from aegis_action_selector.cb_knapsack import CBKnapsack

_BANDITS: dict[str, CBKnapsack] = {}
_log = logging.getLogger(__name__)

REDIS_KEY_PREFIX = "action_selector:bandit:"


def _redis_key(model_id: str) -> str:
    return f"{REDIS_KEY_PREFIX}{model_id}"


def get_or_create_bandit(model_id: str, n_features: int) -> CBKnapsack:
    """Return the in-process bandit, creating a fresh one if needed.

    Pure in-memory — Redis hydration is the caller's responsibility
    (typically the /select handler awaits `load_bandit_from_redis`
    before falling through to this path).
    """
    if model_id not in _BANDITS:
        _BANDITS[model_id] = CBKnapsack(action_set=ACTION_SET, n_features=n_features)
    return _BANDITS[model_id]


def install_bandit(model_id: str, bandit: CBKnapsack) -> None:
    """Install a fully-formed bandit into the registry. Used after a
    successful Redis load."""
    _BANDITS[model_id] = bandit


def reset() -> None:
    """Drop all in-memory bandit state. Used by tests."""
    _BANDITS.clear()


# ─── Serialization helpers ────────────────────────────────────────────


def _blr_to_dict(blr: BayesianLinearRegression) -> dict[str, Any]:
    return {
        "n_features": blr.n_features,
        "alpha_prior": blr.alpha_prior,
        "beta_prior": blr.beta_prior,
        "precision": blr.precision_matrix.tolist(),
        "mean_times_precision": blr.mean_x_precision.tolist(),
    }


def _blr_from_dict(payload: dict[str, Any]) -> BayesianLinearRegression:
    blr = BayesianLinearRegression(
        n_features=int(payload["n_features"]),
        alpha_prior=float(payload["alpha_prior"]),
        beta_prior=float(payload["beta_prior"]),
    )
    blr.restore_state(
        precision=np.asarray(payload["precision"], dtype=float),
        mean_times_precision=np.asarray(payload["mean_times_precision"], dtype=float),
    )
    return blr


def _bandit_to_dict(bandit: CBKnapsack) -> dict[str, Any]:
    return {
        "n_features": bandit.n_features,
        "beta": bandit.beta,
        "eta": bandit.eta,
        "prior_strength": bandit.prior_strength,
        "n_reward_dims": bandit.n_reward_dims,
        "n_cost_dims": bandit.n_cost_dims,
        "lambda_dual": bandit.lambda_dual.tolist(),
        "reward_oracles": {
            action.value: [_blr_to_dict(blr) for blr in oracles]
            for action, oracles in bandit.reward_oracles.items()
        },
        "cost_oracles": {
            action.value: [_blr_to_dict(blr) for blr in oracles]
            for action, oracles in bandit.cost_oracles.items()
        },
    }


def _bandit_from_dict(payload: dict[str, Any], *, n_features: int) -> CBKnapsack:
    """Reconstruct a CBKnapsack from a Redis payload.

    The constructor seeds fresh oracles in `__post_init__`; we then
    overwrite them with the persisted state. `lambda_dual` is a numpy
    array, restored shape-faithful from the JSON list.
    """
    bandit = CBKnapsack(
        action_set=ACTION_SET,
        n_features=int(payload.get("n_features", n_features)),
        beta=float(payload.get("beta", 2.0)),
        eta=float(payload.get("eta", 0.05)),
        prior_strength=float(payload.get("prior_strength", 0.5)),
        n_reward_dims=int(payload.get("n_reward_dims", 4)),
        n_cost_dims=int(payload.get("n_cost_dims", 4)),
    )
    bandit.lambda_dual = np.asarray(payload["lambda_dual"], dtype=float)
    reward_payload = cast("dict[str, list[dict[str, Any]]]", payload["reward_oracles"])
    cost_payload = cast("dict[str, list[dict[str, Any]]]", payload["cost_oracles"])
    for action in ACTION_SET:
        if action.value in reward_payload:
            bandit.reward_oracles[action] = [
                _blr_from_dict(d) for d in reward_payload[action.value]
            ]
        if action.value in cost_payload:
            bandit.cost_oracles[action] = [_blr_from_dict(d) for d in cost_payload[action.value]]
    return bandit


# ─── Redis I/O ─────────────────────────────────────────────────────────


async def save_bandit_to_redis(
    model_id: str,
    *,
    redis_client: aioredis.Redis,
) -> None:
    """Serialize the in-memory bandit for `model_id` and store it under
    `action_selector:bandit:<model_id>`. Silently no-ops if the bandit
    isn't registered (caller-side guard against losing fresh state)."""
    bandit = _BANDITS.get(model_id)
    if bandit is None:
        return
    payload = _bandit_to_dict(bandit)
    await redis_client.set(_redis_key(model_id), json.dumps(payload))


async def load_bandit_from_redis(
    model_id: str,
    *,
    n_features: int,
    redis_client: aioredis.Redis,
) -> CBKnapsack | None:
    """Return the persisted bandit for `model_id` or `None` on cache miss.

    Cache misses (key absent) and decode errors both return None — the
    caller falls back to `get_or_create_bandit`. Decode errors are
    logged at warning so they don't silently mask data corruption.
    """
    raw = await redis_client.get(_redis_key(model_id))
    if raw is None:
        return None
    try:
        text = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
        payload = cast("dict[str, Any]", json.loads(text))
        return _bandit_from_dict(payload, n_features=n_features)
    except (json.JSONDecodeError, KeyError, ValueError, TypeError):
        _log.warning(
            "redis-persistence: failed to decode bandit payload for %s — "
            "ignoring and falling back to a fresh bandit",
            model_id,
        )
        return None
