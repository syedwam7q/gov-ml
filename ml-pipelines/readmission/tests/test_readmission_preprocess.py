"""Tests for the readmission preprocessing library."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from readmission_preprocess import (  # noqa: E402
    binarize_readmission,
    drop_missing_critical,
    encode_categoricals,
    replace_missing_sentinels,
    stratified_split,
)


def _toy_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "race": ["Caucasian", "AfricanAmerican", "Hispanic", "?", "Caucasian"],
            "gender": ["Male", "Female", "Male", "Female", "Male"],
            "age": ["[50-60)", "[60-70)", "[40-50)", "[70-80)", "[60-70)"],
            "time_in_hospital": [3, 5, 2, 8, 1],
            "num_medications": [12, 18, 6, 22, 8],
            "readmitted": ["<30", "NO", ">30", "<30", "NO"],
        }
    )


def test_replace_missing_sentinels_replaces_question_marks() -> None:
    df = _toy_frame()
    out = replace_missing_sentinels(df)
    assert pd.isna(out.loc[3, "race"])


def test_binarize_readmission_only_flags_within_30_days() -> None:
    df = _toy_frame()
    out = binarize_readmission(df, label_col="readmitted")
    assert out["label"].tolist() == [1, 0, 0, 1, 0]


def test_drop_missing_critical_drops_rows_with_nan() -> None:
    df = _toy_frame()
    df = replace_missing_sentinels(df)
    out = drop_missing_critical(df, critical_cols=["race"])
    assert len(out) == 4


def test_encode_categoricals_returns_only_numeric() -> None:
    df = _toy_frame()
    encoded, encoders = encode_categoricals(df, categorical_cols=["race", "gender", "age"])
    for col in ["race", "gender", "age"]:
        assert np.issubdtype(encoded[col].dtype, np.number)
        assert col in encoders


def test_encode_categoricals_handles_question_mark_as_string() -> None:
    df = _toy_frame()
    encoded, encoders = encode_categoricals(df, categorical_cols=["race"])
    # `?` becomes its own bucket; this is intentional — preprocess script drops
    # rows where race == ? before encoding when race is critical
    assert "?" in encoders["race"]
    assert np.issubdtype(encoded["race"].dtype, np.number)


def test_stratified_split_is_deterministic() -> None:
    rng = np.random.default_rng(0)
    n = 600
    df = pd.DataFrame({"x": rng.uniform(size=n), "label": rng.binomial(1, 0.2, size=n)})
    a1, _, _ = stratified_split(df, label_col="label", seed=42)
    a2, _, _ = stratified_split(df, label_col="label", seed=42)
    pd.testing.assert_frame_equal(a1.reset_index(drop=True), a2.reset_index(drop=True))


def test_stratified_split_proportions() -> None:
    rng = np.random.default_rng(0)
    n = 1000
    df = pd.DataFrame({"x": rng.uniform(size=n), "label": rng.binomial(1, 0.15, size=n)})
    train, val, test = stratified_split(df, label_col="label", seed=42)
    for part in (train, val, test):
        assert 0.10 < part["label"].mean() < 0.20
    assert len(train) + len(val) + len(test) == n
