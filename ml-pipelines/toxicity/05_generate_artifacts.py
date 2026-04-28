"""Emit the toxicity model card and Civil Comments datasheet."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from aegis_pipelines.cards import (
    Datasheet,
    DatasheetCollection,
    DatasheetComposition,
    DatasheetMaintenance,
    DatasheetMotivation,
    DatasheetUses,
    EthicalConsiderations,
    EvaluationData,
    ModelCard,
    ModelDetails,
    QuantitativeAnalysis,
    TrainingData,
    write_datasheet,
    write_model_card,
)

sys.path.insert(0, str(Path(__file__).parent))
from config import ARTIFACTS_DIR, IDENTITY_COLUMNS, PROCESSED_DIR  # noqa: E402


def _read_split_size(path: Path) -> int:
    return len(pd.read_parquet(path))


def _worst_borkan_subgroup(borkan: dict[str, dict[str, float]]) -> tuple[str, float]:
    if not borkan:
        return ("none", 0.0)
    name, scores = min(borkan.items(), key=lambda kv: kv[1]["bpsn_auc"])
    return name, scores["bpsn_auc"]


def main() -> int:
    eval_path = ARTIFACTS_DIR / "evaluation.json"
    if not eval_path.exists():
        print("❌ evaluation.json not found; run 04_evaluate.py first", file=sys.stderr)
        return 1

    metrics = json.loads(eval_path.read_text())
    overall = metrics["overall"]
    borkan = metrics.get("borkan", {})

    train_size = _read_split_size(PROCESSED_DIR / "train.parquet")
    test_size = _read_split_size(PROCESSED_DIR / "test.parquet")

    worst_name, worst_bpsn = _worst_borkan_subgroup(borkan)

    card = ModelCard(
        name="toxicity-v3",
        version="0.1.0",
        details=ModelDetails(
            developers="syedwam7q",
            date="2026-04-28",
            type="DistilBERT fine-tuned binary classifier",
            paper="https://github.com/syedwam7q/gov-ml/blob/main/docs/paper",
            license="MIT",
            contact="sdirwamiq@gmail.com",
        ),
        intended_use=(
            "Demonstration governance target for the Aegis platform. "
            "Predicts whether a comment is toxic. NOT for any production "
            "moderation system."
        ),
        factors=IDENTITY_COLUMNS,
        metrics=["accuracy", "AUROC", "ECE", "subgroup_AUC", "BPSN", "BNSP"],
        training_data=TrainingData(source="Civil Comments train split", size=train_size),
        evaluation_data=EvaluationData(source="Civil Comments test split", size=test_size),
        quantitative_analysis=QuantitativeAnalysis(
            unitary={
                "accuracy": overall["accuracy"],
                "auroc": overall["auroc"],
                "ece": overall["ece"],
                "brier": overall["brier"],
            },
            intersectional={
                f"bpsn_auc_{name}": scores["bpsn_auc"] for name, scores in borkan.items()
            },
        ),
        ethical_considerations=EthicalConsiderations(
            risks=[
                "identity-term false positives (cf. Dixon 2018)",
                "AAE-dialect false positives (cf. Sap et al. 2019)",
                "annotator-pool bias propagating into labels (Borkan 2019)",
            ],
            mitigations=[
                "Aegis monitors per-identity BPSN/BNSP in real time",
                "auto-escalation to human review when subgroup AUC drops below floor",
                "calibration-patch remediation when ECE drifts",
            ],
        ),
        caveats=[
            f"Worst current BPSN-AUC: {worst_name} = {worst_bpsn:.4f}",
            "Public dataset — not a substitute for context-aware moderation.",
            "Identity column values are crowdsourced annotations, not ground truth.",
        ],
    )
    write_model_card(card, ARTIFACTS_DIR)

    sheet = Datasheet(
        name="Civil-Comments",
        version="Borkan-2019",
        motivation=DatasheetMotivation(
            purpose=(
                "Public corpus of online comments (~1.8M) released by Jigsaw / "
                "Conversation AI to study unintended bias in toxicity classification."
            ),
            funded_by="Jigsaw / Google Conversation AI",
        ),
        composition=DatasheetComposition(
            instances="Online comments",
            count=1_804_874,
            features=["text", "toxicity", *IDENTITY_COLUMNS],
            label="toxicity (continuous in [0,1]) → binarized at 0.5",
        ),
        collection=DatasheetCollection(
            method="Crowdsourced labels via Jigsaw's Civil Comments platform",
            timeframe="2017–2018",
        ),
        uses=DatasheetUses(
            tasks=[
                "toxic-comment binary classification",
                "subgroup-bias benchmarking via BPSN / BNSP / subgroup AUC",
                "drift / governance research (Aegis target use)",
            ],
            recommended=True,
        ),
        maintenance=DatasheetMaintenance(
            maintainer="Jigsaw / HuggingFace mirror",
            url="https://huggingface.co/datasets/google/civil_comments",
        ),
    )
    write_datasheet(sheet, ARTIFACTS_DIR)

    print(f"✓ wrote model card + datasheet to {ARTIFACTS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
