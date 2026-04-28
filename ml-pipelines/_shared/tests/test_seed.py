"""Tests for deterministic seeding."""

import os

import numpy as np
from aegis_pipelines.seed import GLOBAL_SEED, seeded_rng, set_global_seed


class TestGlobalSeed:
    def test_global_seed_is_a_constant(self) -> None:
        assert GLOBAL_SEED == 1729

    def test_set_global_seed_writes_pythonhashseed(self) -> None:
        set_global_seed(42)
        assert os.environ.get("PYTHONHASHSEED") == "42"

    def test_set_global_seed_sets_numpy_seed(self) -> None:
        set_global_seed(42)
        a = np.random.default_rng().integers(0, 1_000_000, size=10)
        set_global_seed(42)
        b = np.random.default_rng().integers(0, 1_000_000, size=10)
        assert isinstance(a[0].item(), int)
        assert isinstance(b[0].item(), int)


class TestSeededRng:
    def test_same_seed_same_sequence(self) -> None:
        r1 = seeded_rng(7).integers(0, 100, size=5).tolist()
        r2 = seeded_rng(7).integers(0, 100, size=5).tolist()
        assert r1 == r2

    def test_different_seed_different_sequence(self) -> None:
        r1 = seeded_rng(7).integers(0, 100, size=5).tolist()
        r2 = seeded_rng(8).integers(0, 100, size=5).tolist()
        assert r1 != r2

    def test_default_uses_global_seed(self) -> None:
        r1 = seeded_rng().integers(0, 100, size=5).tolist()
        r2 = seeded_rng(GLOBAL_SEED).integers(0, 100, size=5).tolist()
        assert r1 == r2
