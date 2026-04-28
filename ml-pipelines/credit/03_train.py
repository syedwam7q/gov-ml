"""Train an XGBoost classifier on the preprocessed credit data."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from aegis_pipelines.seed import set_global_seed
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).parent))
from config import ARTIFACTS_DIR, PROCESSED_DIR, XGBOOST_PARAMS  # noqa: E402


def main() -> int:
    set_global_seed()
    train = pd.read_parquet(PROCESSED_DIR / "train.parquet")
    val = pd.read_parquet(PROCESSED_DIR / "val.parquet")
    feature_cols = [c for c in train.columns if c != "label"]

    print(f"→ training XGBoost on {len(train):,} rows")
    model = XGBClassifier(**XGBOOST_PARAMS)
    model.fit(
        train[feature_cols],
        train["label"],
        eval_set=[(val[feature_cols], val["label"])],
        verbose=False,
    )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    model.save_model(ARTIFACTS_DIR / "model.json")
    (ARTIFACTS_DIR / "feature_cols.json").write_text(json.dumps(feature_cols, indent=2))
    print(f"✓ wrote {ARTIFACTS_DIR / 'model.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
