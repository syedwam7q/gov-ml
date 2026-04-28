"""Pure preprocessing functions for the credit pipeline.

Split out from the CLI driver so we can test the transforms in isolation
without touching the filesystem.
"""

from __future__ import annotations

import pandas as pd
from sklearn.model_selection import train_test_split


def binarize_label(df: pd.DataFrame, *, label_col: str, positive_codes: set[int]) -> pd.DataFrame:
    """Add `label` column = 1 if `df[label_col]` ∈ `positive_codes`, else 0."""
    out = df.copy()
    out["label"] = out[label_col].apply(lambda v: 1 if v in positive_codes else 0)
    return out


def drop_missing_critical(df: pd.DataFrame, *, critical_cols: list[str]) -> pd.DataFrame:
    """Drop rows where any column in `critical_cols` is missing."""
    return df.dropna(subset=critical_cols).reset_index(drop=True)


def encode_categoricals(
    df: pd.DataFrame, *, categorical_cols: list[str]
) -> tuple[pd.DataFrame, dict[str, dict[str, int]]]:
    """Label-encode categorical columns. Returns (encoded_df, encoders)."""
    out = df.copy()
    encoders: dict[str, dict[str, int]] = {}
    for col in categorical_cols:
        unique = sorted(out[col].dropna().unique().tolist(), key=str)
        mapping = {v: i for i, v in enumerate(unique)}
        encoders[col] = mapping
        out[col] = out[col].map(mapping).astype("int32")
    return out, encoders


def stratified_split(
    df: pd.DataFrame, *, label_col: str, seed: int
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Deterministic stratified 80 / 10 / 10 split."""
    train, rest = train_test_split(df, test_size=0.2, stratify=df[label_col], random_state=seed)
    val, test = train_test_split(rest, test_size=0.5, stratify=rest[label_col], random_state=seed)
    return (
        train.reset_index(drop=True),
        val.reset_index(drop=True),
        test.reset_index(drop=True),
    )
