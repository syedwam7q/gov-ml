"""Tests for the causal-DAG loader + validator."""

from __future__ import annotations

from pathlib import Path

import pytest
from aegis_causal_attrib.dag_loader import (
    CauseKind,
    DAGSpec,
    DAGValidationError,
    load_dag_for_model,
    validate_dag,
)

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.parametrize("model_id", ["credit-v1", "toxicity-v1", "readmission-v1"])
def test_every_model_dag_loads_and_is_acyclic(model_id: str) -> None:
    spec = load_dag_for_model(model_id, repo_root=REPO_ROOT)
    assert isinstance(spec, DAGSpec)
    assert spec.is_acyclic()
    assert set(spec.cause_kinds.keys()) == set(spec.nodes)
    for parent, child in spec.edges:
        assert parent in spec.nodes
        assert child in spec.nodes


def test_validate_rejects_cyclic_dag() -> None:
    cyclic = {
        "name": "broken",
        "nodes": ["a", "b", "c"],
        "edges": [["a", "b"], ["b", "c"], ["c", "a"]],
        "cause_kinds": {
            "a": "upstream_covariate",
            "b": "upstream_covariate",
            "c": "upstream_covariate",
        },
    }
    with pytest.raises(DAGValidationError, match="cycle"):
        validate_dag(cyclic)


def test_validate_rejects_unknown_cause_kind() -> None:
    bad = {
        "name": "bad",
        "nodes": ["a", "b"],
        "edges": [["a", "b"]],
        "cause_kinds": {"a": "wat", "b": "upstream_covariate"},
    }
    with pytest.raises(DAGValidationError, match="cause_kind"):
        validate_dag(bad)


def test_validate_rejects_edge_to_unknown_node() -> None:
    bad = {
        "name": "bad",
        "nodes": ["a", "b"],
        "edges": [["a", "ghost"]],
        "cause_kinds": {"a": "upstream_covariate", "b": "upstream_covariate"},
    }
    with pytest.raises(DAGValidationError, match="undeclared node"):
        validate_dag(bad)


def test_validate_rejects_missing_cause_kind_for_node() -> None:
    bad = {
        "name": "bad",
        "nodes": ["a", "b"],
        "edges": [["a", "b"]],
        "cause_kinds": {"a": "upstream_covariate"},  # missing b
    }
    with pytest.raises(DAGValidationError, match="cause_kinds keys must equal nodes"):
        validate_dag(bad)


def test_cause_kind_enum_covers_spec_table() -> None:
    """The four cause-kind values match the spec §12.1 mapping table."""
    assert {k.value for k in CauseKind} == {
        "proxy_attribute",
        "upstream_covariate",
        "conditional_mechanism",
        "calibration_mechanism",
    }


def test_dag_spec_parents_returns_topologically_correct_set() -> None:
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    # `income` has parents: applicant_race, applicant_ethnicity,
    # applicant_sex, applicant_age, co_applicant_present.
    parents = set(spec.parents("income"))
    assert parents == {
        "applicant_race",
        "applicant_ethnicity",
        "applicant_sex",
        "applicant_age",
        "co_applicant_present",
    }
    # Root nodes have no parents.
    assert spec.parents("applicant_sex") == ()


def test_load_unknown_model_raises() -> None:
    with pytest.raises(DAGValidationError, match="no pipeline registered"):
        load_dag_for_model("no-such-model", repo_root=REPO_ROOT)
