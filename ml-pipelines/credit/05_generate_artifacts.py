"""Emit the credit model card and HMDA datasheet, sourcing metrics from evaluation.json."""

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
        name="credit-v1",
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
            "NOT for any production lending decision."
        ),
        factors=["applicant_race", "applicant_ethnicity", "applicant_sex", "applicant_age"],
        metrics=["accuracy", "demographic_parity", "equal_opportunity", "ECE", "AUROC"],
        training_data=TrainingData(source="HMDA Public LAR 2017 California", size=train_size),
        evaluation_data=EvaluationData(
            source="HMDA Public LAR 2017 California holdout", size=test_size
        ),
        quantitative_analysis=QuantitativeAnalysis(
            unitary={
                "accuracy": overall["accuracy"],
                "auroc": overall["auroc"],
                "ece": overall["ece"],
                "brier": overall["brier"],
            },
            intersectional={
                "demographic_parity_diff_race": metrics["subgroup"]["applicant_race"][
                    "demographic_parity_difference"
                ],
                "equal_opportunity_diff_race": metrics["subgroup"]["applicant_race"][
                    "equal_opportunity_difference"
                ],
                "demographic_parity_diff_sex": metrics["subgroup"]["applicant_sex"][
                    "demographic_parity_difference"
                ],
            },
        ),
        ethical_considerations=EthicalConsiderations(
            risks=[
                "disparate impact across race / ethnicity / sex (cf. Apple Card 2019)",
                "calibration drift when economic conditions shift (cf. COVID 2020 macro-shock)",
                "proxy-variable contamination (e.g., zipcode → race)",
            ],
            mitigations=[
                "Aegis monitors all subgroup metrics in real time",
                "auto-rollback on KPI breach during canary",
                "approval gate before any retrain promotion",
            ],
        ),
        caveats=[
            "Public dataset — not representative of any specific lender's portfolio.",
            "Class imbalance in training data: loan-action codes 1 (approved) vs 3 (denied).",
        ],
    )
    write_model_card(card, ARTIFACTS_DIR)

    sheet = Datasheet(
        name="HMDA-2017-CA",
        version="2017-California",
        motivation=DatasheetMotivation(
            purpose=(
                "Public mortgage application dataset published annually by the CFPB under "
                "the Home Mortgage Disclosure Act (HMDA)."
            ),
            funded_by="US Consumer Financial Protection Bureau",
        ),
        composition=DatasheetComposition(
            instances="Loan applications",
            count=600_000,
            features=[
                "income",
                "loan_amount",
                "applicant_race",
                "applicant_ethnicity",
                "applicant_sex",
                "applicant_age",
                "co_applicant_present",
            ],
            label="action_taken (1=approved, 3=denied)",
        ),
        collection=DatasheetCollection(
            method="HMDA-Modified-LAR public release", timeframe="Calendar year 2017"
        ),
        uses=DatasheetUses(
            tasks=[
                "credit-approval binary classification",
                "fairness benchmarking across protected attributes",
                "drift / governance research (Aegis target use)",
            ],
            recommended=True,
        ),
        maintenance=DatasheetMaintenance(
            maintainer="CFPB", url="https://ffiec.cfpb.gov/data-publication/"
        ),
    )
    write_datasheet(sheet, ARTIFACTS_DIR)

    print(f"✓ wrote model card + datasheet to {ARTIFACTS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
