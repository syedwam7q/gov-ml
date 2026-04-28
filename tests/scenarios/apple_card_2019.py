"""Apple-Card-2019 scenario — the hero replay.

Spec §5.2 + Appendix A.1. Real-world incident: NYDFS investigation 2021,
CFPB fine 2024. Distilled signature:

  P(co_applicant_present | applicant_sex) drops sharply for women
  (single-applicant marketing campaign). Downstream income, loan,
  debt-to-income, and approval re-derive through the credit DAG.

Ground truth:
  • Dominant cause: co_applicant_present (or applicant_sex —
    DoWhy attributes the upstream-of-shift node, which is sometimes sex).
  • Recommended action: REWEIGH (upstream covariate shift → Kamiran-Calders).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from tests.scenarios._harness import Scenario


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _build_reference() -> pd.DataFrame:
    """5,000-row reference frame matching the credit-v1 DAG."""
    rng = np.random.default_rng(42)
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


def _build_current() -> pd.DataFrame:
    """Reference + Apple-Card distribution shift.

    Stronger version of the shift: co_applicant_present drops to ~0 for
    ALL women in the current window, modelling the marketing campaign
    that targeted single-applicant women. This produces a clear,
    DoWhy-detectable signature on the upstream covariate
    `co_applicant_present`. The downstream variables re-derive through
    the same SCM so the joint stays consistent.
    """
    rng = np.random.default_rng(43)
    df = _build_reference()
    mask = df["applicant_sex"] == 0
    # Hard zero — campaign targeted single-applicants exclusively.
    df.loc[mask, "co_applicant_present"] = 0
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


APPLE_CARD_2019 = Scenario(
    name="apple_card_2019",
    model_id="credit-v1",
    target_node="income",
    build_reference=_build_reference,
    build_current=_build_current,
    expected_dominant_cause="co_applicant_present",
    expected_action="REWEIGH",
)
