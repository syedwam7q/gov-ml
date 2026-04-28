"""Pure preprocessing functions for the toxicity pipeline.

Civil Comments has a `toxicity` column with a probabilistic score in [0,1] and
24 identity columns. We binarize toxicity at TOXIC_THRESHOLD and turn each
identity column into a boolean "comment mentions this identity" mask.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def binarize_toxicity(
    df: pd.DataFrame, *, score_col: str = "toxicity", threshold: float = 0.5
) -> pd.DataFrame:
    """Add `label` column = 1 if `df[score_col]` ≥ threshold, else 0."""
    out = df.copy()
    out["label"] = (out[score_col].astype(float) >= threshold).astype(int)
    return out


def identity_mentioned(
    df: pd.DataFrame, *, identity_columns: list[str], threshold: float = 0.5
) -> pd.DataFrame:
    """Add `mentions_<id>` boolean columns for each identity column.

    A comment `mentions` an identity when its identity-column value ≥ threshold
    (Jigsaw convention). Identity columns may be NaN — treated as "not
    mentioned".
    """
    out = df.copy()
    for col in identity_columns:
        if col not in out.columns:
            out[f"mentions_{col}"] = False
            continue
        vals = pd.to_numeric(out[col], errors="coerce").fillna(0.0)
        out[f"mentions_{col}"] = (vals >= threshold).to_numpy()
    return out


def drop_empty_text(df: pd.DataFrame, *, text_col: str = "text") -> pd.DataFrame:
    """Drop rows where the text is missing or empty after stripping."""
    mask = df[text_col].astype(str).str.strip().str.len() > 0
    return df[mask].reset_index(drop=True)


def identity_masks_from_frame(
    df: pd.DataFrame, *, identity_columns: list[str]
) -> dict[str, np.ndarray]:
    """Convert `mentions_<id>` columns into the `identities` dict for Borkan eval."""
    return {
        ident: df[f"mentions_{ident}"].to_numpy(dtype=bool)
        for ident in identity_columns
        if f"mentions_{ident}" in df.columns
    }
