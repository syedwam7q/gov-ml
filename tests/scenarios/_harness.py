"""Minimal scenario runner.

Phase 9 will extend this with the full 10-scenario benchmark library;
Phase 6's responsibility is the harness shape and the canonical
Apple-Card-2019 case. Each scenario is a frozen dataclass that the
ablation grid will iterate over in Phase 9.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class Scenario:
    """One canonical scenario — reference + current + ground-truth labels."""

    name: str
    """Human-readable identifier — also the directory name in `tests/scenarios/`."""

    model_id: str
    """Which model's DAG to load."""

    target_node: str
    """Continuous downstream node DoWhy will attribute against."""

    build_reference: Callable[[], pd.DataFrame]
    """Returns a fresh reference frame on each call."""

    build_current: Callable[[], pd.DataFrame]
    """Returns a fresh current frame (with the scenario's distribution shift)."""

    expected_dominant_cause: str
    """Ground-truth dominant cause node — what a correct attribution returns."""

    expected_action: str
    """Ground-truth recommended action — what cause→action returns from the dominant."""
