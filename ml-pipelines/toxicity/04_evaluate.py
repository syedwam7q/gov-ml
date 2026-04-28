"""Evaluate the fine-tuned toxicity model — overall + Borkan subgroup AUCs."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from aegis_pipelines.eval import binary_classification_metrics, borkan_subgroup_report

sys.path.insert(0, str(Path(__file__).parent))
from config import ARTIFACTS_DIR, IDENTITY_COLUMNS, MAX_SEQUENCE_LENGTH, PROCESSED_DIR  # noqa: E402
from toxicity_preprocess import identity_masks_from_frame  # noqa: E402


def main() -> int:
    try:
        import torch  # noqa: PLC0415
        from transformers import (  # noqa: PLC0415
            AutoModelForSequenceClassification,
            AutoTokenizer,
        )
    except ImportError as exc:
        print(
            "❌ NLP deps missing; run `uv sync --all-packages --extra nlp` first.",
            file=sys.stderr,
        )
        print(f"   ({exc})", file=sys.stderr)
        return 1

    test_df = pd.read_parquet(PROCESSED_DIR / "test.parquet")
    print(f"→ loaded {len(test_df):,} test examples")

    model_dir = ARTIFACTS_DIR / "model"
    print(f"→ loading model from {model_dir}")
    tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
    model = AutoModelForSequenceClassification.from_pretrained(str(model_dir))
    model.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)

    print("→ scoring test set")
    probs: list[float] = []
    batch_size = 64
    texts = test_df["text"].astype(str).tolist()
    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            enc = tokenizer(
                chunk,
                padding=True,
                truncation=True,
                max_length=MAX_SEQUENCE_LENGTH,
                return_tensors="pt",
            ).to(device)
            logits = model(**enc).logits
            chunk_probs = torch.softmax(logits, dim=-1)[:, 1].detach().cpu().numpy()
            probs.extend(chunk_probs.tolist())

    y_prob = np.asarray(probs, dtype=float)
    y_true = test_df["label"].to_numpy()
    y_pred = (y_prob >= 0.5).astype(int)

    overall = binary_classification_metrics(y_true=y_true, y_pred=y_pred, y_prob=y_prob)

    identities = identity_masks_from_frame(test_df, identity_columns=IDENTITY_COLUMNS)
    borkan = borkan_subgroup_report(y_true=y_true, y_prob=y_prob, identities=identities)

    out = {"overall": overall, "borkan": borkan}
    (ARTIFACTS_DIR / "evaluation.json").write_text(json.dumps(out, indent=2))
    print(f"✓ wrote {ARTIFACTS_DIR / 'evaluation.json'}")
    print(f"  accuracy = {overall['accuracy']:.4f}")
    print(f"  AUROC    = {overall['auroc']:.4f}")
    print(f"  ECE      = {overall['ece']:.4f}")
    if borkan:
        worst = min(borkan.items(), key=lambda kv: kv[1]["bpsn_auc"])
        print(f"  worst BPSN subgroup: {worst[0]} = {worst[1]['bpsn_auc']:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
