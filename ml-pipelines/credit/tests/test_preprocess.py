"""Tests for the credit preprocessing library."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from preprocess_lib import (  # noqa: E402
    binarize_label,
    drop_missing_critical,
    encode_categoricals,
    stratified_split,
)


def _toy_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "income": [50000, 75000, 30000, 100000, 60000, 45000, 80000, 90000, 25000, 55000],
            "loan_amount": [200, 300, 150, 500, 250, 180, 350, 450, 100, 220],
            "applicant_race": ["W", "B", "B", "W", "L", "L", "B", "W", "L", "W"],
            "applicant_ethnicity": ["NH", "NH", "NH", "NH", "H", "H", "NH", "NH", "H", "NH"],
            "applicant_sex": ["M", "F", "F", "M", "M", "F", "M", "F", "F", "M"],
            "applicant_age": ["35-44", "25-34", "45-54", "55-64", "35-44"] * 2,
            "action_taken": [1, 1, 3, 1, 1, 3, 1, 1, 3, 1],
        }
    )


def test_binarize_label_maps_action_taken_to_01() -> None:
    df = _toy_frame()
    out = binarize_label(df, label_col="action_taken", positive_codes={1})
    assert out["label"].tolist() == [1, 1, 0, 1, 1, 0, 1, 1, 0, 1]


def test_drop_missing_critical_drops_rows_with_nan_label_or_protected() -> None:
    df = _toy_frame()
    df.loc[2, "applicant_race"] = np.nan
    df.loc[5, "action_taken"] = np.nan
    out = drop_missing_critical(df, critical_cols=["applicant_race", "action_taken"])
    assert len(out) == 8


def test_encode_categoricals_returns_only_numeric() -> None:
    df = _toy_frame()
    df = binarize_label(df, label_col="action_taken", positive_codes={1})
    encoded, encoders = encode_categoricals(
        df.drop(columns=["action_taken"]),
        categorical_cols=[
            "applicant_race",
            "applicant_ethnicity",
            "applicant_sex",
            "applicant_age",
        ],
    )
    assert all(np.issubdtype(t, np.number) for t in encoded.dtypes)
    assert set(encoders.keys()) == {
        "applicant_race",
        "applicant_ethnicity",
        "applicant_sex",
        "applicant_age",
    }


def test_stratified_split_preserves_label_proportions() -> None:
    rng = np.random.default_rng(0)
    n = 1000
    df = pd.DataFrame(
        {
            "x": rng.uniform(size=n),
            "label": rng.binomial(1, 0.3, size=n),
        }
    )
    train, val, test = stratified_split(df, label_col="label", seed=42)
    for part in (train, val, test):
        assert 0.25 < part["label"].mean() < 0.35
    assert len(train) + len(val) + len(test) == n
    assert abs(len(train) / n - 0.80) < 0.02
    assert abs(len(val) / n - 0.10) < 0.02
    assert abs(len(test) / n - 0.10) < 0.02


def test_stratified_split_is_deterministic() -> None:
    rng = np.random.default_rng(0)
    df = pd.DataFrame({"x": rng.uniform(size=200), "label": rng.binomial(1, 0.5, size=200)})
    a1, _, _ = stratified_split(df, label_col="label", seed=42)
    a2, _, _ = stratified_split(df, label_col="label", seed=42)
    pd.testing.assert_frame_equal(a1.reset_index(drop=True), a2.reset_index(drop=True))


@pytest.mark.parametrize("seed", [1, 2, 3])
def test_split_seed_changes_result(seed: int) -> None:
    rng = np.random.default_rng(0)
    df = pd.DataFrame({"x": rng.uniform(size=200), "label": rng.binomial(1, 0.5, size=200)})
    a, _, _ = stratified_split(df, label_col="label", seed=seed)
    b, _, _ = stratified_split(df, label_col="label", seed=seed + 100)
    assert a["x"].sum() != b["x"].sum()
