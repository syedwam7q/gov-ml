"""Shared fixtures — synthetic linear-Gaussian SCMs over the credit DAG.

The reference frame is drawn from a stable joint; the current frame
applies the Apple-Card-2019 distilled distribution shift on top:
P(co_applicant_present | applicant_sex) drops sharply for women
(sex == 0) — modelling the marketing-campaign signature that drove
the 2019 incident. Downstream variables (income, loan, dti, approval)
are re-derived through the same SCM so the joint is consistent.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


@pytest.fixture
def rng() -> np.random.Generator:
    return np.random.default_rng(seed=42)


@pytest.fixture
def credit_reference_frame(rng: np.random.Generator) -> pd.DataFrame:
    """5,000-row reference frame matching the credit-v1 DAG."""
    n = 5_000
    sex = rng.integers(0, 2, n)
    age = rng.integers(0, 5, n)
    co_app = (_sigmoid(0.4 * sex + 0.2 * age) > rng.random(n)).astype(int)
    income = 50_000 + 10_000 * sex + 5_000 * age + 8_000 * co_app + rng.normal(0, 5_000, n)
    loan = 0.8 * income + rng.normal(0, 5_000, n)
    dti = loan / income + rng.normal(0, 0.05, n)
    appr = (_sigmoid(-2 * dti + 1e-4 * income) > rng.random(n)).astype(int)
    return pd.DataFrame(
        {
            "applicant_sex": sex,
            "applicant_race": rng.integers(0, 4, n),
            "applicant_age": age,
            "applicant_ethnicity": rng.integers(0, 3, n),
            "co_applicant_present": co_app,
            "income": income,
            "loan_amount": loan,
            "debt_to_income": dti,
            "approval": appr,
        }
    )


@pytest.fixture
def credit_current_frame_with_drift(
    credit_reference_frame: pd.DataFrame, rng: np.random.Generator
) -> pd.DataFrame:
    """Same SCM with a P(co_applicant_present | sex) shift — Apple-Card hero."""
    df = credit_reference_frame.copy()
    mask = df["applicant_sex"] == 0
    df.loc[mask, "co_applicant_present"] = (rng.random(int(mask.sum())) > 0.7).astype(int)
    df["income"] = (
        50_000
        + 10_000 * df["applicant_sex"]
        + 5_000 * df["applicant_age"]
        + 8_000 * df["co_applicant_present"]
        + rng.normal(0, 5_000, len(df))
    )
    df["loan_amount"] = 0.8 * df["income"] + rng.normal(0, 5_000, len(df))
    df["debt_to_income"] = df["loan_amount"] / df["income"] + rng.normal(0, 0.05, len(df))
    df["approval"] = (
        _sigmoid(-2 * df["debt_to_income"] + 1e-4 * df["income"]) > rng.random(len(df))
    ).astype(int)
    return df
