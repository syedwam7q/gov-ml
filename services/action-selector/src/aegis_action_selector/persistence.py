"""Process-local CB-Knapsack state per `model_id`.

Phase 7 keeps state in-memory; Phase 8 will persist to Redis so the
bandit posterior survives restarts. For now the keying is per-model
(one bandit per registered ML model).
"""

from __future__ import annotations

from aegis_action_selector.actions import ACTION_SET
from aegis_action_selector.cb_knapsack import CBKnapsack

_BANDITS: dict[str, CBKnapsack] = {}


def get_or_create_bandit(model_id: str, n_features: int) -> CBKnapsack:
    if model_id not in _BANDITS:
        _BANDITS[model_id] = CBKnapsack(action_set=ACTION_SET, n_features=n_features)
    return _BANDITS[model_id]


def reset() -> None:
    """Drop all bandit state. Used by tests."""
    _BANDITS.clear()
