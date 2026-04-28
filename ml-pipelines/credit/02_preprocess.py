"""Read raw HMDA, preprocess, write train/val/test parquet files."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from aegis_pipelines.seed import GLOBAL_SEED, set_global_seed

sys.path.insert(0, str(Path(__file__).parent))
from config import (  # noqa: E402
    HMDA_2017_CA_SPEC,
    LABEL_COLUMN,
    PROCESSED_DIR,
    PROTECTED_FEATURES,
    RAW_DIR,
)
from preprocess_lib import (  # noqa: E402
    binarize_label,
    drop_missing_critical,
    encode_categoricals,
    stratified_split,
)

CATEGORICAL_COLS = PROTECTED_FEATURES.copy()
NUMERIC_COLS = ["income", "loan_amount"]


def main() -> int:
    set_global_seed()
    src = RAW_DIR / HMDA_2017_CA_SPEC.dest_relpath
    if not src.exists():
        print(f"❌ raw file not found at {src}; run 01_download.py first", file=sys.stderr)
        return 1

    print(f"→ reading {src}")
    df = pd.read_csv(src)

    print(f"→ binarizing label (column={LABEL_COLUMN}, positive=1)")
    df = binarize_label(df, label_col=LABEL_COLUMN, positive_codes={1})

    print("→ dropping missing critical columns")
    df = drop_missing_critical(df, critical_cols=["label", *PROTECTED_FEATURES])

    print("→ encoding categoricals")
    feature_cols = NUMERIC_COLS + CATEGORICAL_COLS
    encoded, encoders = encode_categoricals(
        df[[*feature_cols, "label"]], categorical_cols=CATEGORICAL_COLS
    )

    print(f"→ stratified split (seed={GLOBAL_SEED})")
    train, val, test = stratified_split(encoded, label_col="label", seed=GLOBAL_SEED)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    train.to_parquet(PROCESSED_DIR / "train.parquet")
    val.to_parquet(PROCESSED_DIR / "val.parquet")
    test.to_parquet(PROCESSED_DIR / "test.parquet")
    (PROCESSED_DIR / "encoders.json").write_text(json.dumps(encoders, indent=2))

    print(f"✓ wrote train={len(train):,} val={len(val):,} test={len(test):,} to {PROCESSED_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
