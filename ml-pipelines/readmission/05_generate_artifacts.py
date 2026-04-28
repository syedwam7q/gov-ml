"""Emit the readmission model card and Diabetes-130 datasheet."""

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
from config import ARTIFACTS_DIR, PROCESSED_DIR  # noqa: E402


def _read_split_size(path: Path) -> int:
    return len(pd.read_parquet(path))


def main() -> int:
    eval_path = ARTIFACTS_DIR / "evaluation.json"
    if not eval_path.exists():
        print("❌ evaluation.json not found; run 04_evaluate.py first", file=sys.stderr)
        return 1

    metrics = json.loads(eval_path.read_text())
    overall = metrics["overall"]

    train_size = _read_split_size(PROCESSED_DIR / "train.parquet")
    test_size = _read_split_size(PROCESSED_DIR / "test.parquet")

    card = ModelCard(
        name="readmission-v2",
        version="0.1.0",
        details=ModelDetails(
            developers="syedwam7q",
            date="2026-04-28",
            type="XGBoost binary classifier",
            paper="https://github.com/syedwam7q/gov-ml/blob/main/docs/paper",
            license="MIT",
            contact="sdirwamiq@gmail.com",
        ),
        intended_use=(
            "Demonstration governance target for the Aegis platform. "
            "Predicts readmission within 30 days of discharge for diabetes inpatients. "
            "NOT for any production clinical decision."
        ),
        factors=["race", "gender", "age"],
        metrics=["accuracy", "demographic_parity", "equal_opportunity", "ECE", "AUROC", "Brier"],
        training_data=TrainingData(
            source="UCI Diabetes 130-US Hospitals (Strack et al. 2014)", size=train_size
        ),
        evaluation_data=EvaluationData(source="UCI Diabetes 130-US holdout", size=test_size),
        quantitative_analysis=QuantitativeAnalysis(
            unitary={
                "accuracy": overall["accuracy"],
                "auroc": overall["auroc"],
                "ece": overall["ece"],
                "brier": overall["brier"],
            },
            intersectional={
                "demographic_parity_diff_race": metrics["subgroup"]["race"][
                    "demographic_parity_difference"
                ],
                "equal_opportunity_diff_race": metrics["subgroup"]["race"][
                    "equal_opportunity_difference"
                ],
                "demographic_parity_diff_gender": metrics["subgroup"]["gender"][
                    "demographic_parity_difference"
                ],
            },
        ),
        ethical_considerations=EthicalConsiderations(
            risks=[
                "calibration disparity across racial subgroups (cf. Obermeyer 2019, Optum)",
                "label proxy hazard — readmission is partly driven by insurance and access",
                "covariate shift from changing clinical guidelines or pharmaceutical practice",
            ],
            mitigations=[
                "Aegis monitors per-race calibration and subgroup metrics in real time",
                "approval gate on retrain promotion",
                "fallback to conservative thresholds if subgroup AUC drops below floor",
            ],
        ),
        caveats=[
            "Public dataset — covers 130 US hospitals 1999–2008 only.",
            "Class imbalance: <30-day readmissions are ~11% of encounters.",
            "Model is decisioning-grade for research, NOT for production clinical use.",
        ],
    )
    write_model_card(card, ARTIFACTS_DIR)

    sheet = Datasheet(
        name="UCI-Diabetes-130-US",
        version="1999-2008",
        motivation=DatasheetMotivation(
            purpose=(
                "Public hospital-encounter dataset from 130 US hospitals over 1999–2008, "
                "used in Strack et al. 2014 to study HbA1c testing's effect on readmission "
                "and disparities across patient populations."
            ),
            funded_by=(
                "Center for Clinical and Translational Research, Virginia Commonwealth University"
            ),
        ),
        composition=DatasheetComposition(
            instances="Hospital encounters of diabetes patients",
            count=101_766,
            features=[
                "race",
                "gender",
                "age",
                "time_in_hospital",
                "num_lab_procedures",
                "num_procedures",
                "num_medications",
                "number_outpatient",
                "number_emergency",
                "number_inpatient",
                "number_diagnoses",
                "A1Cresult",
                "max_glu_serum",
                "insulin",
                "diabetesMed",
            ],
            label="readmitted (NO / <30 / >30) → binarized to <30",
        ),
        collection=DatasheetCollection(
            method="Hospital records, de-identified per HIPAA",
            timeframe="1999–2008",
        ),
        uses=DatasheetUses(
            tasks=[
                "30-day readmission binary classification",
                "fairness benchmarking across race / gender / age",
                "drift / governance research (Aegis target use)",
            ],
            recommended=True,
        ),
        maintenance=DatasheetMaintenance(
            maintainer="UCI Machine Learning Repository",
            url="https://archive.ics.uci.edu/ml/datasets/diabetes+130-us+hospitals+for+years+1999-2008",
        ),
    )
    write_datasheet(sheet, ARTIFACTS_DIR)

    print(f"✓ wrote model card + datasheet to {ARTIFACTS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
