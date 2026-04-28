"""End-to-end smoke test: tiny synthetic frame → preprocess → train → eval → cards."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from credit_preprocess import (  # noqa: E402
    binarize_label,
    drop_missing_critical,
    encode_categoricals,
    stratified_split,
)


def _synthetic_frame(n: int = 2000, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    income = rng.normal(60_000, 20_000, size=n).clip(10_000, 250_000)
    loan_amount = (income * rng.uniform(2.0, 5.0, size=n)).astype(int)
    race = rng.choice(["W", "B", "L", "A", "N"], size=n, p=[0.55, 0.15, 0.18, 0.10, 0.02])
    ethnicity = rng.choice(["NH", "H"], size=n, p=[0.85, 0.15])
    sex = rng.choice(["M", "F"], size=n)
    age = rng.choice(["25-34", "35-44", "45-54", "55-64"], size=n)
    base_logit = -2.0 + 0.00003 * income - 0.00001 * loan_amount
    bias = np.where(race == "W", 0.5, np.where(race == "B", -0.5, 0.0))
    prob = 1.0 / (1.0 + np.exp(-(base_logit + bias)))
    action_taken = np.where(rng.uniform(size=n) < prob, 1, 3)
    return pd.DataFrame(
        {
            "income": income,
            "loan_amount": loan_amount,
            "applicant_race": race,
            "applicant_ethnicity": ethnicity,
            "applicant_sex": sex,
            "applicant_age": age,
            "action_taken": action_taken,
        }
    )


def test_full_pipeline_e2e(tmp_path: Path) -> None:
    df = _synthetic_frame()
    df = binarize_label(df, label_col="action_taken", positive_codes={1})
    df = drop_missing_critical(df, critical_cols=["label", "applicant_race", "applicant_sex"])
    feature_cols = [
        "income",
        "loan_amount",
        "applicant_race",
        "applicant_ethnicity",
        "applicant_sex",
        "applicant_age",
    ]
    encoded, encoders = encode_categoricals(
        df[[*feature_cols, "label"]],
        categorical_cols=[
            "applicant_race",
            "applicant_ethnicity",
            "applicant_sex",
            "applicant_age",
        ],
    )
    train, _val, test = stratified_split(encoded, label_col="label", seed=42)

    model = XGBClassifier(max_depth=4, n_estimators=20, n_jobs=1, random_state=42)
    model.fit(train[feature_cols], train["label"])

    y_prob = model.predict_proba(test[feature_cols])[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    accuracy = (y_pred == test["label"].to_numpy()).mean()
    assert accuracy > 0.55

    out = tmp_path / "model.json"
    model.save_model(out)
    reloaded = XGBClassifier()
    reloaded.load_model(out)
    pred_again = reloaded.predict_proba(test[feature_cols])[:, 1]
    np.testing.assert_array_almost_equal(y_prob, pred_again, decimal=6)

    json.dumps(encoders)
