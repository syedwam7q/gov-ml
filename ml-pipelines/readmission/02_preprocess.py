"""Read raw Diabetes-130 CSV, preprocess, write train/val/test parquet files."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from aegis_pipelines.seed import GLOBAL_SEED, set_global_seed

sys.path.insert(0, str(Path(__file__).parent))
from config import (  # noqa: E402
    CATEGORICAL_FEATURES,
    DIABETES_CSV_INSIDE_ZIP,
    LABEL_COLUMN,
    NUMERIC_FEATURES,
    PROCESSED_DIR,
    PROTECTED_FEATURES,
    RAW_DIR,
)
from readmission_preprocess import (  # noqa: E402
    binarize_readmission,
    drop_missing_critical,
    encode_categoricals,
    replace_missing_sentinels,
    stratified_split,
)


def main() -> int:
    set_global_seed()
    src = RAW_DIR / DIABETES_CSV_INSIDE_ZIP
    if not src.exists():
        print(f"❌ raw CSV not found at {src}; run 01_download.py first", file=sys.stderr)
        return 1

    print(f"→ reading {src}")
    df = pd.read_csv(src)

    print("→ replacing '?' sentinels with NA")
    df = replace_missing_sentinels(df)

    print(f"→ binarizing readmission (column={LABEL_COLUMN}, positive=<30)")
    df = binarize_readmission(df, label_col=LABEL_COLUMN)

    print("→ dropping missing critical columns")
    df = drop_missing_critical(df, critical_cols=["label", *PROTECTED_FEATURES])

    print("→ encoding categoricals")
    feature_cols = NUMERIC_FEATURES + PROTECTED_FEATURES + CATEGORICAL_FEATURES
    encoded, encoders = encode_categoricals(
        df[[*feature_cols, "label"]],
        categorical_cols=PROTECTED_FEATURES + CATEGORICAL_FEATURES,
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
