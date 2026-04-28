"""Evaluate the trained credit model — overall + subgroup metrics, calibration."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from aegis_pipelines.eval import binary_classification_metrics, subgroup_metrics
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).parent))
from config import ARTIFACTS_DIR, PROCESSED_DIR, PROTECTED_FEATURES  # noqa: E402


def main() -> int:
    test = pd.read_parquet(PROCESSED_DIR / "test.parquet")
    feature_cols = json.loads((ARTIFACTS_DIR / "feature_cols.json").read_text())

    print("→ loading trained model")
    model = XGBClassifier()
    model.load_model(ARTIFACTS_DIR / "model.json")

    y_true = test["label"].to_numpy()
    y_prob = model.predict_proba(test[feature_cols])[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    overall = binary_classification_metrics(y_true=y_true, y_pred=y_pred, y_prob=y_prob)
    by_group = {
        feat: subgroup_metrics(
            y_true=y_true,
            y_pred=y_pred,
            y_prob=y_prob,
            sensitive=test[feat].astype(str).to_numpy(),
        )
        for feat in PROTECTED_FEATURES
    }

    out = {"overall": overall, "subgroup": by_group}
    (ARTIFACTS_DIR / "evaluation.json").write_text(json.dumps(out, indent=2))
    print(f"✓ wrote {ARTIFACTS_DIR / 'evaluation.json'}")
    print(f"  accuracy = {overall['accuracy']:.4f}")
    print(f"  AUROC    = {overall['auroc']:.4f}")
    print(f"  ECE      = {overall['ece']:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
