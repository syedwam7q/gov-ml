"""Pareto-front extraction over candidate (action, reward_vector) pairs."""

from __future__ import annotations

import numpy as np

from aegis_action_selector.actions import ActionKey


def pareto_front(candidates: dict[ActionKey, np.ndarray]) -> set[ActionKey]:
    """Return the set of non-dominated actions.

    A dominates B iff A ≥ B on every dim AND A > B on at least one dim.
    """
    keys = list(candidates.keys())
    out: set[ActionKey] = set()
    for i, a in enumerate(keys):
        ra = candidates[a]
        dominated = False
        for j, b in enumerate(keys):
            if i == j:
                continue
            rb = candidates[b]
            if bool(np.all(rb >= ra)) and bool(np.any(rb > ra)):
                dominated = True
                break
        if not dominated:
            out.add(a)
    return out
