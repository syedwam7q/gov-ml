"""Model card (Mitchell et al. 2019) and datasheet (Gebru et al. 2021) writers.

Both artifacts are emitted as JSON (machine-readable, audit-log-friendly) and
Markdown (human-readable, paper-friendly). The dashboard renders the JSON;
the paper appendix and `/datasets` page render the Markdown.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


class _Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)


class ModelDetails(_Frozen):
    developers: str
    date: str
    type: str
    paper: str
    license: str
    contact: str


class TrainingData(_Frozen):
    source: str
    size: int = Field(ge=0)


class EvaluationData(_Frozen):
    source: str
    size: int = Field(ge=0)


class QuantitativeAnalysis(_Frozen):
    unitary: dict[str, float]
    intersectional: dict[str, float]


class EthicalConsiderations(_Frozen):
    risks: list[str]
    mitigations: list[str]


class ModelCard(_Frozen):
    """Mitchell et al. 2019 — Model Cards for Model Reporting."""

    name: str
    version: str
    details: ModelDetails
    intended_use: str
    factors: list[str]
    metrics: list[str]
    training_data: TrainingData
    evaluation_data: EvaluationData
    quantitative_analysis: QuantitativeAnalysis
    ethical_considerations: EthicalConsiderations
    caveats: list[str]


class DatasheetMotivation(_Frozen):
    purpose: str
    funded_by: str


class DatasheetComposition(_Frozen):
    instances: str
    count: int = Field(ge=0)
    features: list[str]
    label: str


class DatasheetCollection(_Frozen):
    method: str
    timeframe: str


class DatasheetUses(_Frozen):
    tasks: list[str]
    recommended: bool


class DatasheetMaintenance(_Frozen):
    maintainer: str
    url: str


class Datasheet(_Frozen):
    """Gebru et al. 2021 — Datasheets for Datasets (compact form)."""

    name: str
    version: str
    motivation: DatasheetMotivation
    composition: DatasheetComposition
    collection: DatasheetCollection
    uses: DatasheetUses
    maintenance: DatasheetMaintenance


def _model_card_to_md(card: ModelCard) -> str:
    risks_md = "\n".join(f"- {r}" for r in card.ethical_considerations.risks)
    mitigations_md = "\n".join(f"- {m}" for m in card.ethical_considerations.mitigations)
    caveats_md = "\n".join(f"- {c}" for c in card.caveats)
    return (
        f"# {card.name}\n\n"
        f"**Version:** {card.version}  \n"
        f"**Developers:** {card.details.developers}  \n"
        f"**Date:** {card.details.date}  \n"
        f"**Type:** {card.details.type}  \n"
        f"**License:** {card.details.license}  \n"
        f"**Contact:** {card.details.contact}\n\n"
        f"## Intended use\n\n{card.intended_use}\n\n"
        f"## Factors\n\n{', '.join(card.factors)}\n\n"
        f"## Metrics\n\n{', '.join(card.metrics)}\n\n"
        f"## Training data\n\n{card.training_data.source} (size={card.training_data.size:,})\n\n"
        f"## Evaluation data\n\n"
        f"{card.evaluation_data.source} (size={card.evaluation_data.size:,})\n\n"
        f"## Quantitative analysis\n\n"
        f"- **Unitary:** {card.quantitative_analysis.unitary}\n"
        f"- **Intersectional:** {card.quantitative_analysis.intersectional}\n\n"
        f"## Ethical considerations\n\n"
        f"### Risks\n\n{risks_md}\n\n"
        f"### Mitigations\n\n{mitigations_md}\n\n"
        f"## Caveats\n\n{caveats_md}\n"
    )


def _datasheet_to_md(sheet: Datasheet) -> str:
    tasks_md = "\n".join(f"- {t}" for t in sheet.uses.tasks)
    return (
        f"# {sheet.name}\n\n"
        f"**Version:** {sheet.version}  \n"
        f"**Maintainer:** {sheet.maintenance.maintainer}  \n"
        f"**Source:** <{sheet.maintenance.url}>\n\n"
        f"## Motivation\n\n"
        f"**Purpose:** {sheet.motivation.purpose}  \n"
        f"**Funded by:** {sheet.motivation.funded_by}\n\n"
        f"## Composition\n\n"
        f"- **Instances:** {sheet.composition.instances}\n"
        f"- **Count:** {sheet.composition.count:,}\n"
        f"- **Label:** {sheet.composition.label}\n"
        f"- **Features:** {', '.join(sheet.composition.features)}\n\n"
        f"## Collection\n\n"
        f"**Method:** {sheet.collection.method}  \n"
        f"**Timeframe:** {sheet.collection.timeframe}\n\n"
        f"## Recommended uses\n\n{tasks_md}\n"
    )


def write_model_card(card: ModelCard, dest_dir: Path) -> tuple[Path, Path]:
    """Write `<name>.model_card.json` and `<name>.model_card.md`. Returns both paths."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    json_path = dest_dir / f"{card.name}.model_card.json"
    md_path = dest_dir / f"{card.name}.model_card.md"
    json_path.write_text(json.dumps(card.model_dump(), indent=2))
    md_path.write_text(_model_card_to_md(card))
    return json_path, md_path


def write_datasheet(sheet: Datasheet, dest_dir: Path) -> tuple[Path, Path]:
    """Write `<name>.datasheet.json` and `<name>.datasheet.md`. Returns both paths."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    json_path = dest_dir / f"{sheet.name}.datasheet.json"
    md_path = dest_dir / f"{sheet.name}.datasheet.md"
    json_path.write_text(json.dumps(sheet.model_dump(), indent=2))
    md_path.write_text(_datasheet_to_md(sheet))
    return json_path, md_path
