"""Deterministic seeding for ML pipelines.

Every pipeline calls `set_global_seed()` exactly once at the top of its main
script. Every nondeterministic operation goes through `seeded_rng()` so we
can reproduce results bit-for-bit across re-runs.
"""

from __future__ import annotations

import os
import random
from typing import Final

import numpy as np

GLOBAL_SEED: Final[int] = 1729
"""Project-wide default seed. Changing this requires a deliberate retraining."""


def set_global_seed(seed: int = GLOBAL_SEED) -> None:
    """Seed Python, NumPy, and PYTHONHASHSEED. Call once at the top of main."""
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)


def seeded_rng(seed: int = GLOBAL_SEED) -> np.random.Generator:
    """Return a fresh NumPy Generator seeded deterministically."""
    return np.random.default_rng(seed)
