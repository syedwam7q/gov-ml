"""Credit pipeline configuration — paths, dataset spec, hyperparams."""

from __future__ import annotations

from pathlib import Path
from typing import Final

from aegis_pipelines.data import DatasetSpec

REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[2]
RAW_DIR: Final[Path] = REPO_ROOT / "data" / "raw" / "credit"
PROCESSED_DIR: Final[Path] = REPO_ROOT / "data" / "processed" / "credit"
ARTIFACTS_DIR: Final[Path] = Path(__file__).parent / "artifacts"

# HMDA Public LAR 2017 California, Modified-LAR format. Pinned URL and SHA.
# Source: https://ffiec.cfpb.gov/data-publication/modified-lar/2017
#
# First-run pinning workflow: leave the placeholder SHA below, run 01_download.py,
# observe the actual hash from the resulting DownloadError, paste it here, then
# re-run. This forces every change of the upstream file to be a deliberate code
# change, which is the reproducibility property we want.
HMDA_2017_CA_SPEC: Final[DatasetSpec] = DatasetSpec(
    name="HMDA-2017-CA",
    url=(
        "https://ffiec.cfpb.gov/v2/data-browser-api/view/csv?states=CA&years=2017&actions_taken=1,3"
    ),
    sha256="00000000000000000000000000000000000000000000000000000000deadbeef",
    dest_relpath="hmda-2017-ca.csv",
)

PROTECTED_FEATURES: Final[list[str]] = [
    "applicant_race",
    "applicant_ethnicity",
    "applicant_sex",
    "applicant_age",
]

LABEL_COLUMN: Final[str] = "action_taken"

# XGBoost hyperparameters — modest, CPU-friendly defaults.
XGBOOST_PARAMS: Final[dict[str, object]] = {
    "objective": "binary:logistic",
    "max_depth": 6,
    "learning_rate": 0.1,
    "n_estimators": 200,
    "tree_method": "hist",
    "n_jobs": -1,
    "random_state": 1729,
}
