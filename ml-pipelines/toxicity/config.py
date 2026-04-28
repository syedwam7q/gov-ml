"""Toxicity pipeline configuration — paths, dataset spec, model + training params."""

from __future__ import annotations

from pathlib import Path
from typing import Final

REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[2]
RAW_DIR: Final[Path] = REPO_ROOT / "data" / "raw" / "toxicity"
PROCESSED_DIR: Final[Path] = REPO_ROOT / "data" / "processed" / "toxicity"
ARTIFACTS_DIR: Final[Path] = Path(__file__).parent / "artifacts"

# HuggingFace dataset identifier for Civil Comments (Borkan et al. 2019).
# Loading via the `datasets` library is more reliable than the Kaggle URL,
# which requires Kaggle CLI auth. The HF mirror has the same splits.
HF_DATASET: Final[str] = "google/civil_comments"

# Real model — fine-tuned in Colab.
DISTILBERT_BASE: Final[str] = "distilbert-base-uncased"

# Tiny model used in the CI smoke test — same architecture family as DistilBERT
# but only 4M parameters, so fine-tuning is feasible on CPU in seconds.
SMOKE_TEST_MODEL: Final[str] = "prajjwal1/bert-tiny"

# Borkan 2019 identity columns. Each row of Jigsaw has a probability for each
# identity; we treat ≥ 0.5 as "the comment mentions this identity".
IDENTITY_COLUMNS: Final[list[str]] = [
    "asian",
    "atheist",
    "bisexual",
    "black",
    "buddhist",
    "christian",
    "female",
    "heterosexual",
    "hindu",
    "homosexual_gay_or_lesbian",
    "intellectual_or_learning_disability",
    "jewish",
    "latino",
    "male",
    "muslim",
    "other_disability",
    "other_gender",
    "other_race_or_ethnicity",
    "other_religion",
    "other_sexual_orientation",
    "physical_disability",
    "psychiatric_or_mental_illness",
    "transgender",
    "white",
]

# Toxicity score threshold for binarization (Jigsaw convention).
TOXIC_THRESHOLD: Final[float] = 0.5

MAX_SEQUENCE_LENGTH: Final[int] = 256

# DistilBERT training hyperparameters — tuned for Colab T4. CPU users should
# subset the data heavily.
TRAIN_PARAMS: Final[dict[str, object]] = {
    "model_name": DISTILBERT_BASE,
    "num_train_epochs": 2,
    "per_device_train_batch_size": 32,
    "per_device_eval_batch_size": 64,
    "learning_rate": 2e-5,
    "warmup_steps": 500,
    "weight_decay": 0.01,
    "logging_steps": 200,
    "eval_strategy": "epoch",
    "save_strategy": "epoch",
    "load_best_model_at_end": True,
    "metric_for_best_model": "auroc",
    "seed": 1729,
}
