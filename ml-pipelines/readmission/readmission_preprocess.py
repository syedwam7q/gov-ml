"""Pure preprocessing functions for the readmission pipeline.

The Diabetes 130-US dataset uses `?` as a missing-value sentinel and labels
readmissions with three values (`NO`, `<30`, `>30`). We binarize as
"readmitted within 30 days" — the clinically actionable signal.
"""

from __future__ import annotations

import pandas as pd
from aegis_pipelines.eval import (  # re-export — keeps the model file dependency-free
    binary_classification_metrics,  # noqa: F401
)


def replace_missing_sentinels(df: pd.DataFrame, *, sentinel: str = "?") -> pd.DataFrame:
    """Replace `sentinel` strings with NaN throughout the frame."""
    return df.replace(sentinel, pd.NA)


def binarize_readmission(df: pd.DataFrame, *, label_col: str) -> pd.DataFrame:
    """Map `<30` → 1, anything else → 0. Returns frame with new `label` column."""
    out = df.copy()
    out["label"] = (out[label_col] == "<30").astype(int)
    return out


def drop_missing_critical(df: pd.DataFrame, *, critical_cols: list[str]) -> pd.DataFrame:
    """Drop rows where any column in `critical_cols` is NA."""
    return df.dropna(subset=critical_cols).reset_index(drop=True)


def encode_categoricals(
    df: pd.DataFrame, *, categorical_cols: list[str]
) -> tuple[pd.DataFrame, dict[str, dict[str, int]]]:
    """Label-encode categorical columns. Returns (encoded_df, encoders)."""
    out = df.copy()
    encoders: dict[str, dict[str, int]] = {}
    for col in categorical_cols:
        unique = sorted(out[col].dropna().astype(str).unique().tolist(), key=str)
        mapping = {v: i for i, v in enumerate(unique)}
        encoders[col] = mapping
        out[col] = out[col].astype(str).map(mapping).astype("int32")
    return out, encoders


def stratified_split(
    df: pd.DataFrame, *, label_col: str, seed: int
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Deterministic stratified 80 / 10 / 10 split."""
    from sklearn.model_selection import train_test_split

    train, rest = train_test_split(df, test_size=0.2, stratify=df[label_col], random_state=seed)
    val, test = train_test_split(rest, test_size=0.5, stratify=rest[label_col], random_state=seed)
    return (
        train.reset_index(drop=True),
        val.reset_index(drop=True),
        test.reset_index(drop=True),
    )
