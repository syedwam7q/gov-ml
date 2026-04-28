"""Readmission pipeline configuration — paths, dataset spec, hyperparams."""

from __future__ import annotations

from pathlib import Path
from typing import Final

from aegis_pipelines.data import DatasetSpec

REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[2]
RAW_DIR: Final[Path] = REPO_ROOT / "data" / "raw" / "readmission"
PROCESSED_DIR: Final[Path] = REPO_ROOT / "data" / "processed" / "readmission"
ARTIFACTS_DIR: Final[Path] = Path(__file__).parent / "artifacts"

# UCI Diabetes 130-US Hospitals (Strack et al. 2014).
# Source: https://archive.ics.uci.edu/ml/datasets/diabetes+130-us+hospitals+for+years+1999-2008
#
# First-run pinning workflow (same as credit/config.py): leave the placeholder
# SHA below, run 01_download.py once, paste the actual hash from the
# DownloadError into this constant, then re-run. Pins the upstream file so
# every change is a deliberate code change.
DIABETES_130_SPEC: Final[DatasetSpec] = DatasetSpec(
    name="UCI-Diabetes-130-US",
    url="https://archive.ics.uci.edu/ml/machine-learning-databases/00296/dataset_diabetes.zip",
    sha256="00000000000000000000000000000000000000000000000000000000deadbeef",
    dest_relpath="dataset_diabetes.zip",
)

# After unzipping, the CSV we use lives at this relative path inside the ZIP.
DIABETES_CSV_INSIDE_ZIP: Final[str] = "dataset_diabetes/diabetic_data.csv"

# Fairness-relevant attributes per HHS Office of Civil Rights guidance and
# Obermeyer 2019. `race` is the canonical attribute for the Optum-style story.
PROTECTED_FEATURES: Final[list[str]] = ["race", "gender", "age"]

# Numeric features kept after preprocessing (subset of the 50 raw columns).
NUMERIC_FEATURES: Final[list[str]] = [
    "time_in_hospital",
    "num_lab_procedures",
    "num_procedures",
    "num_medications",
    "number_outpatient",
    "number_emergency",
    "number_inpatient",
    "number_diagnoses",
]

# Categorical features kept (in addition to PROTECTED_FEATURES).
CATEGORICAL_FEATURES: Final[list[str]] = [
    "admission_type_id",
    "discharge_disposition_id",
    "admission_source_id",
    "insulin",
    "change",
    "diabetesMed",
    "A1Cresult",
    "max_glu_serum",
]

LABEL_COLUMN: Final[str] = "readmitted"

# XGBoost hyperparameters — modest, CPU-friendly. Same shape as credit.
XGBOOST_PARAMS: Final[dict[str, object]] = {
    "objective": "binary:logistic",
    "max_depth": 6,
    "learning_rate": 0.1,
    "n_estimators": 200,
    "tree_method": "hist",
    "n_jobs": -1,
    "random_state": 1729,
}
