"""End-to-end scenario test — Apple-Card-2019.

Verifies that Phase 6's full pipeline (DAG load → DoWhy GCM →
recommend_action) runs end-to-end on the canonical Apple-Card hero
scenario and produces a valid `CausalAttribution`-shaped result.

This is a *structural* test — it doesn't assert that DoWhy attributes
to one specific node, because DoWhy's Monte-Carlo Shapley spreads
mass across the upstream-of-target ancestor set on small synthetic
samples. The cause→action mapping logic itself is exhaustively
covered by deterministic-input unit tests in
`services/causal-attrib/tests/test_cause_mapping.py`.

The Phase 6 paper-claim test (Σ φ_i ≈ Δtarget) lives in
`test_shapley_efficiency.py`; that's the load-bearing CI gate.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.scenarios.apple_card_2019 import APPLE_CARD_2019


@pytest.mark.slow
def test_apple_card_2019_full_pipeline_runs_end_to_end() -> None:
    """The full DAG-load → DoWhy → recommend_action pipeline produces a
    valid CausalAttribution-shaped output on the hero scenario."""
    from aegis_causal_attrib.cause_mapping import (
        ActionKey,
        AttributionEvidence,
        recommend_action,
    )
    from aegis_causal_attrib.dag_loader import load_dag_for_model
    from aegis_causal_attrib.dowhy_attrib import run_dowhy_attribution

    repo_root = Path(__file__).resolve().parents[2]
    spec = load_dag_for_model(APPLE_CARD_2019.model_id, repo_root=repo_root)
    res = run_dowhy_attribution(
        model_id=APPLE_CARD_2019.model_id,
        spec=spec,
        reference=APPLE_CARD_2019.build_reference(),
        current=APPLE_CARD_2019.build_current(),
        target_node=APPLE_CARD_2019.target_node,
        timeout_s=120.0,
        num_samples=300,
    )

    # 1. Shapley keys are a subset of the DAG nodes (specifically, the
    #    target's ancestor set ∪ {target}).
    assert set(res.shapley.keys()) <= set(spec.nodes)
    assert len(res.shapley) > 0

    # 2. Dominant cause is one of the returned Shapley nodes.
    assert res.dominant_cause in res.shapley

    # 3. Target delta is non-zero — there really was a distribution shift.
    assert abs(res.target_delta) > 0.0

    # 4. recommend_action() produces a valid ActionKey for whatever
    #    DoWhy attributed to. We pass a permissive confidence_floor
    #    because Monte-Carlo Shapley spreads mass across ancestors.
    total = sum(abs(v) for v in res.shapley.values()) or 1.0
    confidence = abs(res.shapley[res.dominant_cause]) / total
    action = recommend_action(
        AttributionEvidence(
            dominant_cause_node=res.dominant_cause,
            dominant_cause_kind=spec.cause_kinds[res.dominant_cause],
            shapley=res.shapley,
            confidence=confidence,
        ),
        confidence_floor=0.0,  # accept any DoWhy result
    )
    assert isinstance(action, ActionKey)


@pytest.mark.slow
def test_apple_card_2019_attribution_identifies_upstream_signature() -> None:
    """The dominant cause is in the upstream-of-induced-shift set.

    The induced shift is `co_applicant_present` conditioned on
    `applicant_sex`. DoWhy may attribute to either node directly, to
    upstream confounders that happen to correlate, or to the target's
    own conditional mechanism (when the parent values shifted enough
    to look like a mechanism shift). All of these are defensible
    attributions on a 5K-row synthetic sample.
    """
    from aegis_causal_attrib.dag_loader import load_dag_for_model
    from aegis_causal_attrib.dowhy_attrib import run_dowhy_attribution

    repo_root = Path(__file__).resolve().parents[2]
    spec = load_dag_for_model(APPLE_CARD_2019.model_id, repo_root=repo_root)
    res = run_dowhy_attribution(
        model_id=APPLE_CARD_2019.model_id,
        spec=spec,
        reference=APPLE_CARD_2019.build_reference(),
        current=APPLE_CARD_2019.build_current(),
        target_node=APPLE_CARD_2019.target_node,
        timeout_s=120.0,
        num_samples=300,
    )
    # Acceptable attributions for this scenario: any ancestor of `income`,
    # or `income` itself (target's own conditional mechanism). DoWhy never
    # attributes to a downstream-of-target node — that's structurally
    # impossible.
    import networkx as nx  # noqa: PLC0415

    nx_dag = spec.to_networkx()
    acceptable = set(nx.ancestors(nx_dag, "income")) | {"income"}
    assert res.dominant_cause in acceptable, (
        f"dominant cause={res.dominant_cause!r} not in upstream set; shapley={res.shapley}"
    )
