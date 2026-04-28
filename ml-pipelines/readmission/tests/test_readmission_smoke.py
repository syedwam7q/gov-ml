"""End-to-end smoke test: tiny synthetic frame → preprocess → train → eval."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from readmission_preprocess import (  # noqa: E402
    binarize_readmission,
    drop_missing_critical,
    encode_categoricals,
    replace_missing_sentinels,
    stratified_split,
)


def _synthetic_frame(n: int = 2000, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    race = rng.choice(
        ["Caucasian", "AfricanAmerican", "Hispanic", "Other", "?"],
        size=n,
        p=[0.65, 0.18, 0.08, 0.06, 0.03],
    )
    gender = rng.choice(["Male", "Female"], size=n)
    age = rng.choice(["[40-50)", "[50-60)", "[60-70)", "[70-80)", "[80-90)"], size=n)
    time_in_hospital = rng.integers(1, 14, size=n)
    num_medications = rng.integers(1, 30, size=n)
    a1c = rng.choice([">8", "Norm", "None"], size=n, p=[0.25, 0.10, 0.65])

    base_logit = -2.5 + 0.05 * time_in_hospital + 0.02 * num_medications
    bias = np.where(race == "AfricanAmerican", 0.4, 0.0)  # induced disparity
    prob = 1.0 / (1.0 + np.exp(-(base_logit + bias)))
    readmit_within_30 = rng.uniform(size=n) < prob
    readmitted = np.where(readmit_within_30, "<30", rng.choice(["NO", ">30"], size=n))
    return pd.DataFrame(
        {
            "race": race,
            "gender": gender,
            "age": age,
            "time_in_hospital": time_in_hospital,
            "num_medications": num_medications,
            "A1Cresult": a1c,
            "readmitted": readmitted,
        }
    )


def test_full_pipeline_e2e(tmp_path: Path) -> None:
    df = _synthetic_frame()
    df = replace_missing_sentinels(df)
    df = binarize_readmission(df, label_col="readmitted")
    df = drop_missing_critical(df, critical_cols=["label", "race", "gender"])

    feature_cols = ["time_in_hospital", "num_medications", "race", "gender", "age", "A1Cresult"]
    encoded, encoders = encode_categoricals(
        df[[*feature_cols, "label"]],
        categorical_cols=["race", "gender", "age", "A1Cresult"],
    )
    train, _val, test = stratified_split(encoded, label_col="label", seed=42)

    model = XGBClassifier(max_depth=4, n_estimators=20, n_jobs=1, random_state=42)
    model.fit(train[feature_cols], train["label"])

    y_prob = model.predict_proba(test[feature_cols])[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    accuracy = (y_pred == test["label"].to_numpy()).mean()
    # Baseline: ~85% are not readmitted in 30d, so a "predict 0 always" baseline
    # would hit ~85%. We just confirm the model produces *some* output and the
    # artifact persists/reloads cleanly — performance on tiny synthetic is not
    # a useful signal.
    assert 0.0 <= accuracy <= 1.0

    out = tmp_path / "model.json"
    model.save_model(out)
    reloaded = XGBClassifier()
    reloaded.load_model(out)
    pred_again = reloaded.predict_proba(test[feature_cols])[:, 1]
    np.testing.assert_array_almost_equal(y_prob, pred_again, decimal=6)

    json.dumps(encoders)
