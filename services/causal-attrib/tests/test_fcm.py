"""Tests for the additive-noise FCM fitter."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from aegis_causal_attrib.dag_loader import load_dag_for_model
from aegis_causal_attrib.fcm import FittedFCM, fit_fcm

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_fit_returns_one_mechanism_per_node(credit_reference_frame: pd.DataFrame) -> None:
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    fcm = fit_fcm(spec, credit_reference_frame)
    assert isinstance(fcm, FittedFCM)
    assert set(fcm.mechanisms.keys()) == set(spec.nodes)


def test_fitted_fcm_can_sample_synthetic_rows(credit_reference_frame: pd.DataFrame) -> None:
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    fcm = fit_fcm(spec, credit_reference_frame)
    sampled = fcm.sample(n=500, rng=np.random.default_rng(0))
    assert sampled.shape == (500, len(spec.nodes))
    assert set(sampled.columns) == set(spec.nodes)
    ref_mean = credit_reference_frame["income"].mean()
    assert 0.5 * ref_mean < sampled["income"].mean() < 1.5 * ref_mean


def test_root_nodes_use_marginal_distribution(credit_reference_frame: pd.DataFrame) -> None:
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    fcm = fit_fcm(spec, credit_reference_frame)
    sex_mech = fcm.mechanisms["applicant_sex"]
    assert sex_mech.parents == ()
    # Categorical (0/1) integer data → categorical mechanism.
    assert sex_mech.is_categorical is True
    assert sex_mech.marginal_values is not None
    assert sex_mech.marginal_probs is not None


def test_non_root_nodes_have_ridge_coefs(credit_reference_frame: pd.DataFrame) -> None:
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    fcm = fit_fcm(spec, credit_reference_frame)
    income_mech = fcm.mechanisms["income"]
    assert income_mech.parents != ()
    assert income_mech.coef is not None
    # 5 parents → 5 coefficients.
    assert income_mech.coef.shape == (len(income_mech.parents),)
    # Residual std is positive (real data has noise).
    assert income_mech.residual_std > 0.0


def test_fit_raises_when_frame_missing_node(credit_reference_frame: pd.DataFrame) -> None:
    import pytest

    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    truncated = credit_reference_frame.drop(columns=["income"])
    with pytest.raises(ValueError, match="missing required DAG nodes"):
        fit_fcm(spec, truncated)
