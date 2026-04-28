"""Read raw Civil Comments, preprocess (binarize + identity masks), write splits."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from aegis_pipelines.seed import set_global_seed

sys.path.insert(0, str(Path(__file__).parent))
from config import IDENTITY_COLUMNS, PROCESSED_DIR, RAW_DIR, TOXIC_THRESHOLD  # noqa: E402
from toxicity_preprocess import (  # noqa: E402
    binarize_toxicity,
    drop_empty_text,
    identity_mentioned,
)


def _process_split(name: str) -> pd.DataFrame:
    src = RAW_DIR / f"{name}.parquet"
    print(f"→ {name}: reading {src}")
    df = pd.read_parquet(src)
    df = drop_empty_text(df, text_col="text")
    df = binarize_toxicity(df, score_col="toxicity", threshold=TOXIC_THRESHOLD)
    df = identity_mentioned(df, identity_columns=IDENTITY_COLUMNS, threshold=0.5)
    keep_cols = [
        "text",
        "label",
        *(f"mentions_{ident}" for ident in IDENTITY_COLUMNS),
    ]
    return df[[c for c in keep_cols if c in df.columns]]


def main() -> int:
    set_global_seed()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    for split in ("train", "validation", "test"):
        out = _process_split(split)
        dest = PROCESSED_DIR / f"{split}.parquet"
        out.to_parquet(dest)
        print(f"✓ wrote {dest} ({len(out):,} rows)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
