"""Tests for the toxicity preprocessing library."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from toxicity_preprocess import (  # noqa: E402
    binarize_toxicity,
    drop_empty_text,
    identity_masks_from_frame,
    identity_mentioned,
)


def _toy_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "text": ["hello world", "you are stupid", "  ", "I love this", "go away"],
            "toxicity": [0.0, 0.95, 0.6, 0.05, 0.7],
            "black": [0.0, 0.7, 0.0, 0.0, 0.0],
            "muslim": [0.0, 0.0, 0.6, 0.0, 0.0],
            "female": [0.0, 0.0, 0.0, 0.0, 0.55],
        }
    )


def test_binarize_toxicity_threshold_default_05() -> None:
    df = _toy_frame()
    out = binarize_toxicity(df)
    assert out["label"].tolist() == [0, 1, 1, 0, 1]


def test_binarize_toxicity_custom_threshold() -> None:
    df = _toy_frame()
    out = binarize_toxicity(df, threshold=0.8)
    assert out["label"].tolist() == [0, 1, 0, 0, 0]


def test_drop_empty_text_strips_whitespace() -> None:
    df = _toy_frame()
    out = drop_empty_text(df)
    assert len(out) == 4
    assert "  " not in out["text"].tolist()


def test_identity_mentioned_creates_boolean_columns() -> None:
    df = _toy_frame()
    out = identity_mentioned(df, identity_columns=["black", "muslim", "female"])
    assert out["mentions_black"].tolist() == [False, True, False, False, False]
    assert out["mentions_muslim"].tolist() == [False, False, True, False, False]
    assert out["mentions_female"].tolist() == [False, False, False, False, True]


def test_identity_mentioned_handles_missing_columns() -> None:
    df = _toy_frame()
    out = identity_mentioned(df, identity_columns=["black", "asian"])  # asian not in df
    assert out["mentions_black"].any()
    assert not out["mentions_asian"].any()


def test_identity_mentioned_treats_nan_as_not_mentioned() -> None:
    df = _toy_frame().copy()
    df.loc[0, "black"] = float("nan")
    out = identity_mentioned(df, identity_columns=["black"])
    assert out.loc[0, "mentions_black"] == False  # noqa: E712


def test_identity_masks_from_frame_returns_bool_arrays() -> None:
    df = _toy_frame()
    df = identity_mentioned(df, identity_columns=["black", "muslim"])
    masks = identity_masks_from_frame(df, identity_columns=["black", "muslim", "asian"])
    # asian wasn't in the frame so no mentions_asian column → not in dict.
    assert set(masks.keys()) == {"black", "muslim"}
    for arr in masks.values():
        assert arr.dtype == np.bool_
