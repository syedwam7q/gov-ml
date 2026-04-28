"""Tests for the model card and datasheet writers."""

import json
from pathlib import Path

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


def _minimal_card() -> ModelCard:
    return ModelCard(
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
        intended_use="Demonstration governance target for Aegis. NOT for production lending.",
        factors=["race", "ethnicity", "sex", "age"],
        metrics=["accuracy", "demographic_parity", "equal_opportunity", "ECE"],
        training_data=TrainingData(source="HMDA Public LAR 2017 CA subset", size=100_000),
        evaluation_data=EvaluationData(source="HMDA 2017 CA holdout", size=20_000),
        quantitative_analysis=QuantitativeAnalysis(
            unitary={"accuracy": 0.872, "ECE": 0.041},
            intersectional={"DP_gender": 0.94, "EO_race": 0.86},
        ),
        ethical_considerations=EthicalConsiderations(
            risks=["disparate impact across protected groups", "calibration drift"],
            mitigations=["fairness monitoring via Aegis", "canary rollout on retrain"],
        ),
        caveats=["Public dataset — not representative of any specific lender"],
    )


def _minimal_datasheet() -> Datasheet:
    return Datasheet(
        name="HMDA-2017-CA",
        version="2017-California",
        motivation=DatasheetMotivation(
            purpose="Public mortgage application dataset published by CFPB.",
            funded_by="US Consumer Financial Protection Bureau",
        ),
        composition=DatasheetComposition(
            instances="Loan applications",
            count=600_000,
            features=["income", "loan_amount", "applicant_race", "applicant_sex", "..."],
            label="action_taken (approved/denied)",
        ),
        collection=DatasheetCollection(
            method="HMDA-Modified-LAR public release",
            timeframe="2017",
        ),
        uses=DatasheetUses(
            tasks=["credit-approval classification", "fairness benchmarking"],
            recommended=True,
        ),
        maintenance=DatasheetMaintenance(
            maintainer="CFPB",
            url="https://ffiec.cfpb.gov/data-publication/",
        ),
    )


def test_write_model_card_writes_json_and_md(tmp_path: Path) -> None:
    card = _minimal_card()
    json_path, md_path = write_model_card(card, tmp_path)
    assert json_path.exists()
    assert md_path.exists()
    parsed = json.loads(json_path.read_text())
    assert parsed["name"] == "credit-v1"
    md = md_path.read_text()
    assert "# credit-v1" in md
    assert "demographic_parity" in md


def test_write_datasheet_writes_json_and_md(tmp_path: Path) -> None:
    sheet = _minimal_datasheet()
    json_path, md_path = write_datasheet(sheet, tmp_path)
    assert json_path.exists()
    assert md_path.exists()
    parsed = json.loads(json_path.read_text())
    assert parsed["name"] == "HMDA-2017-CA"
    md = md_path.read_text()
    assert "# HMDA-2017-CA" in md
    assert "CFPB" in md


def test_model_card_round_trip_json(tmp_path: Path) -> None:
    card = _minimal_card()
    json_path, _ = write_model_card(card, tmp_path)
    reloaded = ModelCard.model_validate_json(json_path.read_text())
    assert reloaded == card


def test_datasheet_round_trip_json(tmp_path: Path) -> None:
    sheet = _minimal_datasheet()
    json_path, _ = write_datasheet(sheet, tmp_path)
    reloaded = Datasheet.model_validate_json(json_path.read_text())
    assert reloaded == sheet
