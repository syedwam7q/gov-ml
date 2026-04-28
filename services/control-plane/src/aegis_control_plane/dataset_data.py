"""Seeded dataset registry — the three real-world corpora behind the platform's models.

Sourced verbatim from spec Appendix A. Every row carries:

  • `source` + `source_url` — the canonical citation
  • `datasheet` — Datasheets-for-Datasets (Gebru et al. 2021) sections
  • `snapshots` — chronological history with PSI vs baseline
  • `schema_overview` — column → semantic type for the dataset detail panel

Seeded once by `aegis_control_plane.seed.seed_datasets()`. Updates here
require a new seeder run (or a manual SQL UPDATE — but updating the
canonical citation should be deliberate and rare).
"""

from __future__ import annotations

from typing import Any, Final

# HMDA Public LAR — credit-v1 ----------------------------------------------

HMDA_DATASET: Final[dict[str, Any]] = {
    "id": "hmda-2018-public-lar",
    "name": "HMDA Public LAR · 2018 California subset",
    "description": (
        "Loan Application Register from the U.S. Home Mortgage Disclosure Act, "
        "released annually by the CFPB. We use the 2018 California subset "
        "(~1.2M applications) as the training-time snapshot for credit-v1."
    ),
    "source": "U.S. Consumer Financial Protection Bureau (CFPB)",
    "source_url": "https://www.consumerfinance.gov/data-research/hmda/",
    "row_count": 1_186_307,
    "snapshot_id": "hmda-2018-ca-snapshot-001",
    "model_ids": ["credit-v1"],
    "datasheet": {
        "motivation": (
            "Public-domain release of mortgage application records, mandated by "
            "the Home Mortgage Disclosure Act of 1975 to support enforcement of "
            "fair-lending laws (ECOA Reg B § 1002.4)."
        ),
        "composition": (
            "One row per mortgage application or pre-approval. Columns include "
            "loan amount, property type, applicant + co-applicant demographics "
            "(race, sex, ethnicity), action taken, and reasons for denial. "
            "Free-tier license; no PII (lender + tract IDs only)."
        ),
        "collection": (
            "Reported by ~5,500 financial institutions to the CFPB under HMDA "
            "compliance. CFPB publishes the cleaned, geocoded LAR each spring."
        ),
        "uses": (
            "Recommended: fair-lending research, disparate-impact audits, "
            "policy analysis. NOT recommended: applicant-level prediction "
            "without subgroup-fairness controls."
        ),
        "sensitive_attributes": [
            "applicant_race",
            "applicant_sex",
            "applicant_ethnicity",
            "co_applicant_race",
            "co_applicant_sex",
            "co_applicant_ethnicity",
            "applicant_income",
            "tract_minority_population_percent",
        ],
        "maintenance": (
            "Annual release (typically March). 2018 vintage retained as the "
            "Apple-Card-2019-era reference snapshot for the hero scenario."
        ),
    },
    "snapshots": [
        {
            "id": "hmda-2018-ca-snapshot-001",
            "created_at": "2026-01-12T09:00:00Z",
            "row_count": 1_186_307,
            "psi_vs_baseline": 0.0,
            "note": "baseline · pinned at credit-v1 1.0.0 training",
        },
        {
            "id": "hmda-2018-ca-snapshot-002",
            "created_at": "2026-04-04T09:00:00Z",
            "row_count": 1_186_307,
            "psi_vs_baseline": 0.18,
            "note": "PSI 0.18 · co-applicant-income shift (Apple-Card scenario)",
        },
    ],
    "schema_overview": [
        {"column": "loan_amount", "type": "float", "hint": "USD, no rounding"},
        {
            "column": "property_type",
            "type": "categorical",
            "hint": "1–4 family / multi / manufactured",
        },
        {"column": "loan_purpose", "type": "categorical", "hint": "purchase / refi / improvement"},
        {"column": "applicant_income", "type": "float", "hint": "USD, banded"},
        {"column": "co_applicant_income", "type": "float", "hint": "USD, often missing"},
        {"column": "applicant_gender", "type": "categorical", "hint": "protected attribute"},
        {"column": "applicant_race", "type": "categorical", "hint": "protected attribute"},
        {
            "column": "action_taken",
            "type": "categorical",
            "hint": "originated / denied / withdrawn",
        },
        {"column": "tract_minority_pct", "type": "float", "hint": "geographic risk proxy"},
    ],
}


# Jigsaw Civil Comments — toxicity-v1 -------------------------------------

CIVIL_COMMENTS_DATASET: Final[dict[str, Any]] = {
    "id": "civil-comments-jigsaw",
    "name": "Civil Comments · Jigsaw Unintended Bias 2019",
    "description": (
        "1.8 million online comments labelled for toxicity, with subgroup "
        "annotations for unintended-bias measurement. Released by Jigsaw "
        "under CC0 in 2019."
    ),
    "source": "Jigsaw / Google · Civil Comments platform",
    "source_url": "https://www.kaggle.com/c/jigsaw-unintended-bias-in-toxicity-classification",
    "row_count": 1_804_874,
    "snapshot_id": "civil-comments-2019-snapshot-001",
    "model_ids": ["toxicity-v1"],
    "datasheet": {
        "motivation": (
            "Address the documented unintended bias in early toxicity "
            "classifiers, where mentions of identity terms (e.g. 'gay', 'muslim') "
            "correlated with higher toxicity scores. Released alongside a "
            "Kaggle competition to drive bias-mitigation research."
        ),
        "composition": (
            "One row per comment, with a continuous toxicity score in [0, 1] "
            "averaged from ≥10 crowd-worker labels. Subset of 405K comments "
            "carries identity-term annotations across nine groups: male, female, "
            "transgender, other_gender, heterosexual, lgbtq, christian, jewish, "
            "muslim, hindu, buddhist, atheist, other_religion, black, white, "
            "asian, latino, other_race, physical_disability, intellectual_disability, "
            "other_disability."
        ),
        "collection": (
            "Comments harvested from the Civil Comments commenting platform "
            "(operated 2015–2017 across ~50 news sites). Toxicity + identity "
            "labels collected via Mechanical Turk between 2017 and 2019."
        ),
        "uses": (
            "Recommended: toxicity classification with bias-mitigation analysis. "
            "NOT recommended: deployment without subgroup-FPR monitoring; "
            "comments are English-only and skew toward U.S. politics."
        ),
        "sensitive_attributes": [
            "gender_identity_terms",
            "sexual_orientation_terms",
            "religion_terms",
            "race_terms",
            "disability_terms",
        ],
        "maintenance": (
            "Static release; no further updates. Periodic snapshots in our "
            "registry track the model's drift relative to this fixed corpus."
        ),
    },
    "snapshots": [
        {
            "id": "civil-comments-2019-snapshot-001",
            "created_at": "2026-01-12T09:00:00Z",
            "row_count": 1_804_874,
            "psi_vs_baseline": 0.0,
            "note": "baseline · pinned at toxicity-v1 0.9.0 training",
        },
    ],
    "schema_overview": [
        {"column": "comment_text", "type": "text", "hint": "raw English comment"},
        {"column": "toxicity", "type": "float", "hint": "[0, 1] crowd-averaged"},
        {"column": "severe_toxicity", "type": "float", "hint": "[0, 1]"},
        {"column": "obscene", "type": "float", "hint": "[0, 1]"},
        {"column": "identity_attack", "type": "float", "hint": "[0, 1]"},
        {"column": "insult", "type": "float", "hint": "[0, 1]"},
        {"column": "threat", "type": "float", "hint": "[0, 1]"},
        {"column": "<identity_terms>", "type": "float", "hint": "24 sub-columns, [0, 1]"},
    ],
}


# Diabetes 130-US UCI — readmission-v1 ------------------------------------

DIABETES_130_DATASET: Final[dict[str, Any]] = {
    "id": "diabetes-130-uci",
    "name": "Diabetes 130-US · UCI Repository (1999–2008)",
    "description": (
        "Ten years of clinical care data for diabetic patients across 130 "
        "U.S. hospitals. Used to train readmission-v1 to predict 30-day "
        "all-cause readmission risk."
    ),
    "source": "UCI Machine Learning Repository · Strack et al. 2014",
    "source_url": "https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008",
    "row_count": 101_766,
    "snapshot_id": "diabetes-130-snapshot-001",
    "model_ids": ["readmission-v1"],
    "datasheet": {
        "motivation": (
            "Strack et al. (2014) released the dataset alongside their study "
            "of HbA1c measurement on readmission rates. It remains the "
            "canonical benchmark for readmission-risk modelling."
        ),
        "composition": (
            "One row per inpatient encounter for a diabetic patient. 50 "
            "features: demographics, admission type, length of stay, primary "
            "and secondary diagnoses (ICD-9), 23 medication columns, and "
            "lab values. Binary target: readmitted within 30 days."
        ),
        "collection": (
            "De-identified by the Health Facts data warehouse (Cerner), spanning "
            "1999–2008 across 130 U.S. hospitals. HIPAA Safe Harbor de-id."
        ),
        "uses": (
            "Recommended: readmission modelling, fairness audits across "
            "ethnicity / age. NOT recommended: clinical decisioning without "
            "site-specific recalibration; data is from a single decade and "
            "may not reflect current standards of care."
        ),
        "sensitive_attributes": [
            "race",
            "gender",
            "age_bucket",
            "payer_code",
        ],
        "maintenance": (
            "Static release on UCI; no updates planned. Snapshot history "
            "tracks our preprocessing variants over time."
        ),
    },
    "snapshots": [
        {
            "id": "diabetes-130-snapshot-001",
            "created_at": "2026-01-12T09:00:00Z",
            "row_count": 101_766,
            "psi_vs_baseline": 0.0,
            "note": "baseline · pinned at readmission-v1 1.0.0 training",
        },
    ],
    "schema_overview": [
        {"column": "race", "type": "categorical", "hint": "5 buckets, protected attribute"},
        {"column": "gender", "type": "categorical", "hint": "Male / Female / Unknown"},
        {"column": "age", "type": "categorical", "hint": "10 banded ranges"},
        {"column": "admission_type_id", "type": "categorical", "hint": "8 codes"},
        {"column": "time_in_hospital", "type": "int", "hint": "days, 1–14"},
        {"column": "num_lab_procedures", "type": "int"},
        {"column": "num_medications", "type": "int"},
        {
            "column": "diag_1 / diag_2 / diag_3",
            "type": "icd9",
            "hint": "primary + 2 secondary diagnoses",
        },
        {"column": "A1Cresult", "type": "categorical", "hint": "<7% / >7% / >8% / None"},
        {"column": "readmitted", "type": "categorical", "hint": "target: <30 / >30 / NO"},
    ],
}


SEEDED_DATASETS: Final[tuple[dict[str, Any], ...]] = (
    HMDA_DATASET,
    CIVIL_COMMENTS_DATASET,
    DIABETES_130_DATASET,
)
