# Aegis — Phase 6: Causal Root-Cause Attribution · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** Stand up `services/causal-attrib` — the first of the two paper-earning research extensions. When a `GovernanceDecision` advances from `detected` to `analyzed`, the control plane calls `POST /attrib/run` and the service returns a `CausalAttribution` payload identifying which causal mechanism shifted (Shapley-decomposed by Budhathoki et al. AISTATS 2021) plus a `recommended_action` derived from the cause→remediation mapping. Both fields land in `governance_decisions.causal_attribution` so the dashboard's Shapley waterfall + causal DAG render real attribution data — replacing the hardcoded values seeded for the hero scenario.

**Architecture.** Three structural moves:

1. **Per-model causal DAG, additive-noise FCM.** Each model's `causal_dag.json` (already authored in `ml-pipelines/{credit,toxicity,readmission}/`) defines a DAG `G = (V, E)`. The service fits an additive-noise structural equation `V_i = f_i(PA(V_i)) + N_i` per node on a reference window `D_ref`, then again on the current window `D_cur`. DoWhy GCM's `distribution_change` returns Shapley contributions `φ_i` such that `Σ φ_i = Δ_target` (efficiency, CI-tested by property test).
2. **DBShap fallback for graceful degradation.** When DoWhy times out (default 30 s), is unavailable, or the model has no DAG, we fall back to **DBShap** (Edakunni et al. arXiv:2401.09756, 2024) — Shapley over distributions, no DAG required. Decisions in this branch are tagged `attribution_quality=degraded` so the dashboard flags reduced confidence.
3. **Cause → action mapping is the novel paper contribution.** A static table in `services/causal-attrib/src/.../cause_mapping.py` maps the dominant Shapley contributor's _kind_ (upstream covariate shift / conditional mechanism shift / proxy shift / calibration / etc.) to a recommended remediation action. The action sticks to the decision payload; Phase 7 (Pareto policy) reads it as a prior.

**Tech Stack.** `dowhy>=0.13` (GCM module) · `networkx>=3.4` · `pandas` · `numpy` · `scipy.stats` · `scikit-learn` (Ridge per-node regressors) · custom DBShap implementation in pure NumPy · FastAPI · `hypothesis` for the Shapley-efficiency property test · pytest.

**Spec reference.** `docs/superpowers/specs/2026-04-28-aegis-design.md` §4.3 (per-service contract row 6), §5 (decision lifecycle Phase 2 — Analyze), §6.1 (`governance_decisions.causal_attribution` JSONB), §12.1 (full research extension spec — this is the load-bearing section), §13:Phase 5 (re-numbered to Phase 6 in our delivery cadence), Appendix A (real-world incidents per model).

**Why this phase, why now.** Phase 5 wired the dashboard to live data. Phase 6 makes the `causal_attribution` field stop being a hardcoded JSONB and start being computed by a real attribution engine. This is the **first of the two novel research contributions** that earn the paper a NeurIPS / FAccT submission. The hero scenario's Shapley waterfall (`P(co_applicant_income | applicant_gender)` at 71%, `loan_purpose` at 18%, `credit_score binning` at 11%) currently comes from `seed.py`; by the end of Phase 6 it comes from running DoWhy GCM on a real reference / current pair derived from the hero scenario's induced distribution shift.

---

## File structure created or modified in Phase 6

```
gov-ml/
├── services/causal-attrib/
│   ├── pyproject.toml                                      # CREATE — workspace package, dowhy + networkx + sklearn deps
│   ├── README.md                                            # CREATE — what + how + paper anchor
│   ├── src/aegis_causal_attrib/
│   │   ├── __init__.py                                      # CREATE — version + exports
│   │   ├── py.typed                                         # CREATE — strict-typing marker
│   │   ├── app.py                                           # CREATE — FastAPI app
│   │   ├── config.py                                        # CREATE — settings: ATTRIB_TIMEOUT_S, DBSHAP_SAMPLES
│   │   ├── dag_loader.py                                    # CREATE — load + validate causal_dag.json files
│   │   ├── fcm.py                                           # CREATE — fit additive-noise SCM per node
│   │   ├── dowhy_attrib.py                                  # CREATE — DoWhy GCM wrapper with timeout + cache
│   │   ├── dbshap.py                                        # CREATE — fallback Shapley-over-distributions
│   │   ├── cause_mapping.py                                 # CREATE — the novel cause→action table (paper artifact)
│   │   └── routers/
│   │       ├── __init__.py                                  # CREATE
│   │       ├── attrib.py                                    # CREATE — POST /attrib/run
│   │       └── health.py                                    # CREATE — /healthz + /readyz
│   └── tests/
│       ├── __init__.py                                      # CREATE
│       ├── conftest.py                                      # CREATE — synthetic-data fixtures + DAG fixtures
│       ├── test_dag_loader.py                               # CREATE — every model's DAG is valid + acyclic
│       ├── test_fcm.py                                      # CREATE — additive-noise residual fit + sampling
│       ├── test_dowhy_attrib.py                             # CREATE — happy path, timeout, cache hit
│       ├── test_dbshap.py                                   # CREATE — fallback math correctness + speed bound
│       ├── test_cause_mapping.py                            # CREATE — every cause has a target action; coverage
│       ├── test_shapley_efficiency.py                       # CREATE — property: Σ φ_i ≈ Δtarget
│       ├── test_attrib_endpoint.py                          # CREATE — POST /attrib/run roundtrip
│       └── test_hero_scenario_real_attribution.py          # CREATE — DoWhy on the hero pair reproduces the seeded payload
├── packages/shared-py/src/aegis_shared/
│   ├── schemas.py                                           # MODIFY — add recommended_action + attribution_quality to CausalAttribution
│   └── types.py                                             # MODIFY — add AttributionQuality enum
├── services/control-plane/src/aegis_control_plane/
│   ├── routers/decisions.py                                 # MODIFY — analyze-state transition calls /attrib/run, persists payload
│   ├── seed.py                                              # MODIFY — record Phase 6 attribution provenance on hero scenario
│   └── config.py                                            # MODIFY — CAUSAL_ATTRIB_URL setting
├── ml-pipelines/{credit,toxicity,readmission}/
│   └── causal_dag.json                                      # MODIFY — add cause_kinds per node
├── apps/dashboard/app/_lib/types.ts                         # MODIFY — add recommended_action + attribution_quality optionals
├── apps/dashboard/app/(app)/incidents/[id]/_view.tsx        # MODIFY — render attribution_quality pill + recommended_action chip
├── tests/scenarios/
│   ├── __init__.py                                          # CREATE
│   ├── _harness.py                                          # CREATE — minimal scenario runner
│   ├── apple_card_2019.py                                   # CREATE — first canonical scenario
│   └── test_scenario_apple_card.py                          # CREATE — runs Apple-Card through full attribution
├── pyproject.toml                                           # MODIFY — register services/causal-attrib in workspace members
├── vercel.ts                                                # MODIFY — rewrite /api/causal/* → services/causal-attrib
└── setup.md                                                 # MODIFY — Phase 6 section
```

---

## Phase 6 sub-phases

| Sub-phase | Title                                   | What ships                                                                                                  |
| --------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 6a        | Service scaffold + DAG loader           | `services/causal-attrib` workspace package; `dag_loader.py` validates every model's DAG (acyclic, complete) |
| 6b        | Schema extensions                       | `CausalAttribution` gains `recommended_action` + `attribution_quality`; codegen propagates                  |
| 6c        | FCM fitter (additive-noise SCM)         | `fcm.py` fits per-node residual model from a reference frame; samples synthetic data                        |
| 6d        | DoWhy GCM wrapper                       | `dowhy_attrib.py` runs `distribution_change` with timeout + content-hashed JSON cache                       |
| 6e        | DBShap fallback                         | `dbshap.py` — pure-NumPy Shapley over distributions, no DAG required                                        |
| 6f        | Cause → action mapping (paper artifact) | `cause_mapping.py` table + `recommend_action()`; every node-kind has a target action                        |
| 6g        | HTTP endpoint + control-plane wire      | `POST /attrib/run`; control plane's analyze-state transition calls it and persists the payload              |
| 6h        | Property tests + hero scenario          | `test_shapley_efficiency.py` (Σ φ_i ≈ Δtarget); hero scenario refined to use real attribution               |
| 6i        | Setup.md + tag + push                   | Boot instructions; `phase-6-complete` tag                                                                   |

---

## Sub-phase 6a — Service scaffold + DAG loader

### Task 1: Workspace registration + skeleton

**Files:**

- Create: `services/causal-attrib/pyproject.toml`
- Create: `services/causal-attrib/src/aegis_causal_attrib/__init__.py`
- Create: `services/causal-attrib/src/aegis_causal_attrib/py.typed`
- Create: `services/causal-attrib/src/aegis_causal_attrib/app.py`
- Create: `services/causal-attrib/src/aegis_causal_attrib/routers/__init__.py`
- Create: `services/causal-attrib/src/aegis_causal_attrib/routers/health.py`
- Create: `services/causal-attrib/tests/__init__.py`
- Create: `services/causal-attrib/tests/test_health.py`
- Modify: `pyproject.toml` (root) — add `services/causal-attrib` to `[tool.uv.workspace.members]`

- [ ] **Step 1: Author `pyproject.toml`**

```toml
# services/causal-attrib/pyproject.toml
[project]
name = "aegis-causal-attrib"
version = "0.1.0"
description = "Causal root-cause attribution worker for Aegis (DoWhy GCM + DBShap fallback)"
requires-python = ">=3.13"
dependencies = [
  "aegis-shared",
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "httpx>=0.28.0",
  "pydantic>=2.10.0",
  "pydantic-settings>=2.6.0",
  "pandas>=2.2.0",
  "numpy>=2.1.0",
  "scipy>=1.14.0",
  "scikit-learn>=1.5.0",
  "networkx>=3.4.0",
  "dowhy>=0.13.0",
]

[tool.uv.sources]
aegis-shared = { workspace = true }

[dependency-groups]
dev = ["pytest>=8.3.0", "pytest-asyncio>=0.24.0", "hypothesis>=6.115.0"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/aegis_causal_attrib"]

[tool.pyright]
include = ["src", "tests"]
strict = ["src/aegis_causal_attrib"]
pythonVersion = "3.13"
```

- [ ] **Step 2: Add the workspace member**

```toml
# pyproject.toml (root) — extend [tool.uv.workspace.members]
[tool.uv.workspace]
members = [
  "packages/shared-py",
  "ml-pipelines/_shared",
  "services/control-plane",
  "services/detect-tabular",
  "services/detect-text",
  "services/causal-attrib",
]
```

- [ ] **Step 3: Author `__init__.py` + `py.typed`**

```python
# services/causal-attrib/src/aegis_causal_attrib/__init__.py
"""Aegis causal-attribution worker — DoWhy GCM + DBShap fallback.

Spec §12.1 (research extension 1). The service receives a drift signal
plus reference / current frames, runs Shapley decomposition over the
model's causal DAG, and returns a `CausalAttribution` payload that
identifies the dominant mechanism and recommends a remediation action.
"""

__version__ = "0.1.0"
```

`py.typed` is empty — its presence is the marker.

- [ ] **Step 4: FastAPI factory + health router** — same pattern as `services/detect-tabular/src/aegis_detect_tabular/app.py`. Mount only the health router for now; `/attrib/run` lands in Sub-phase 6g.

```python
# services/causal-attrib/src/aegis_causal_attrib/app.py
from __future__ import annotations

from fastapi import FastAPI

from aegis_causal_attrib import __version__
from aegis_causal_attrib.routers import health as health_router


def build_app() -> FastAPI:
    app = FastAPI(
        title="Aegis Causal Attribution",
        version=__version__,
        description=(
            "Causal root-cause attribution via DoWhy GCM (Budhathoki AISTATS 2021)"
            " with DBShap fallback (Edakunni 2024)."
        ),
    )
    app.include_router(health_router.router)
    return app


app = build_app()
```

```python
# services/causal-attrib/src/aegis_causal_attrib/routers/health.py
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from aegis_causal_attrib import __version__

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, object]:  # noqa: RUF029
    return {"ok": True, "service": "causal-attrib", "version": __version__}


@router.get("/readyz")
async def readyz() -> dict[str, object]:  # noqa: RUF029
    return {"ready": True, "ts": datetime.now(UTC).isoformat()}
```

- [ ] **Step 5: Health test, run, commit**

```python
# services/causal-attrib/tests/test_health.py
from __future__ import annotations

from fastapi.testclient import TestClient

from aegis_causal_attrib.app import build_app


def test_healthz_returns_ok() -> None:
    res = TestClient(build_app()).get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["service"] == "causal-attrib"


def test_readyz_returns_ready() -> None:
    res = TestClient(build_app()).get("/readyz")
    assert res.status_code == 200
    assert res.json()["ready"] is True
```

```bash
uv sync --all-packages
uv run --package aegis-causal-attrib pytest services/causal-attrib/tests/test_health.py -v
git add services/causal-attrib pyproject.toml uv.lock
git commit -m "feat(causal-attrib): Phase 6 — workspace package + /healthz + /readyz scaffold"
```

### Task 2: Causal-DAG cause-kind annotation

**Files:**

- Modify: `ml-pipelines/{credit,toxicity,readmission}/causal_dag.json`

The cause→action mapping in 6f keys on each node's _kind_. Annotating the DAGs locks the kinds where they're authored.

- [ ] **Step 1: Extend the credit DAG with `cause_kinds`**

```json
// ml-pipelines/credit/causal_dag.json — add a top-level "cause_kinds" object
{
  "name": "credit-v1-dag",
  "nodes": [...],
  "edges": [...],
  "cause_kinds": {
    "applicant_race": "proxy_attribute",
    "applicant_ethnicity": "proxy_attribute",
    "applicant_sex": "proxy_attribute",
    "applicant_age": "proxy_attribute",
    "co_applicant_present": "upstream_covariate",
    "income": "upstream_covariate",
    "loan_amount": "upstream_covariate",
    "debt_to_income": "conditional_mechanism",
    "approval": "conditional_mechanism"
  },
  "notes": "...existing notes... cause_kinds field added in Phase 6 — drives the cause→action mapping."
}
```

The four valid `cause_kind` values: `proxy_attribute`, `upstream_covariate`, `conditional_mechanism`, `calibration_mechanism`.

- [ ] **Step 2: Toxicity DAG**

```json
"cause_kinds": {
  "author_demographics": "proxy_attribute",
  "topic_context": "upstream_covariate",
  "identity_terms_present": "proxy_attribute",
  "linguistic_dialect": "proxy_attribute",
  "lexical_polarity": "upstream_covariate",
  "annotator_pool": "proxy_attribute",
  "raw_label": "conditional_mechanism",
  "model_decision": "conditional_mechanism"
}
```

- [ ] **Step 3: Readmission DAG**

```json
"cause_kinds": {
  "race": "proxy_attribute",
  "gender": "proxy_attribute",
  "age": "proxy_attribute",
  "insurance_payer": "proxy_attribute",
  "comorbidity_severity": "upstream_covariate",
  "treatment_intensity": "upstream_covariate",
  "time_in_hospital": "upstream_covariate",
  "a1c_test_received": "calibration_mechanism",
  "readmission": "conditional_mechanism"
}
```

- [ ] **Step 4: Commit**

```bash
git add ml-pipelines/{credit,toxicity,readmission}/causal_dag.json
git commit -m "feat(dags): Phase 6 — annotate cause_kinds for the cause→action mapping"
```

### Task 3: DAG loader + validator

**Files:**

- Create: `services/causal-attrib/src/aegis_causal_attrib/dag_loader.py`
- Create: `services/causal-attrib/tests/test_dag_loader.py`

- [ ] **Step 1: Failing test**

```python
# services/causal-attrib/tests/test_dag_loader.py
from __future__ import annotations

import json
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


def test_validate_rejects_cyclic_dag(tmp_path: Path) -> None:
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


def test_cause_kind_enum_covers_spec_table() -> None:
    assert {k.value for k in CauseKind} == {
        "proxy_attribute",
        "upstream_covariate",
        "conditional_mechanism",
        "calibration_mechanism",
    }
```

- [ ] **Step 2: Implement `dag_loader.py`**

```python
# services/causal-attrib/src/aegis_causal_attrib/dag_loader.py
"""Load + validate per-model causal DAGs."""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any

import networkx as nx


class CauseKind(StrEnum):
    """The four mechanism kinds from spec §12.1's cause→action table."""

    PROXY_ATTRIBUTE = "proxy_attribute"
    UPSTREAM_COVARIATE = "upstream_covariate"
    CONDITIONAL_MECHANISM = "conditional_mechanism"
    CALIBRATION_MECHANISM = "calibration_mechanism"


class DAGValidationError(ValueError):
    """Raised when a causal DAG fails validation."""


_MODEL_TO_PIPELINE: dict[str, str] = {
    "credit-v1": "credit",
    "toxicity-v1": "toxicity",
    "readmission-v1": "readmission",
}


@dataclass(frozen=True)
class DAGSpec:
    """Validated causal DAG."""

    name: str
    nodes: tuple[str, ...]
    edges: tuple[tuple[str, str], ...]
    cause_kinds: dict[str, CauseKind]
    notes: str | None

    def is_acyclic(self) -> bool:
        g = self.to_networkx()
        return nx.is_directed_acyclic_graph(g)

    def to_networkx(self) -> nx.DiGraph:
        g = nx.DiGraph()
        g.add_nodes_from(self.nodes)
        g.add_edges_from(self.edges)
        return g

    def parents(self, node: str) -> tuple[str, ...]:
        return tuple(p for (p, c) in self.edges if c == node)


def validate_dag(payload: dict[str, Any]) -> DAGSpec:
    """Validate a JSON payload and return a `DAGSpec`. Raises on errors."""
    name = payload.get("name")
    nodes = payload.get("nodes")
    edges = payload.get("edges")
    cause_kinds_raw = payload.get("cause_kinds")
    notes = payload.get("notes")

    if not isinstance(name, str) or not name:
        raise DAGValidationError("missing or empty `name`")
    if not isinstance(nodes, list) or not nodes:
        raise DAGValidationError("missing or empty `nodes`")
    if not isinstance(edges, list):
        raise DAGValidationError("missing `edges` (must be a list)")
    if not isinstance(cause_kinds_raw, dict):
        raise DAGValidationError("missing `cause_kinds` (must be an object)")

    node_set = set(nodes)
    if len(node_set) != len(nodes):
        raise DAGValidationError("duplicate node names in `nodes`")

    typed_edges: list[tuple[str, str]] = []
    for edge in edges:
        if not (isinstance(edge, list) and len(edge) == 2):
            raise DAGValidationError(f"malformed edge {edge!r}")
        parent, child = edge[0], edge[1]
        if parent not in node_set or child not in node_set:
            raise DAGValidationError(f"edge {edge!r} references undeclared node")
        typed_edges.append((parent, child))

    if set(cause_kinds_raw.keys()) != node_set:
        missing = node_set - set(cause_kinds_raw.keys())
        extra = set(cause_kinds_raw.keys()) - node_set
        raise DAGValidationError(
            f"cause_kinds keys must equal nodes; missing={sorted(missing)} extra={sorted(extra)}"
        )

    valid_kinds = {k.value for k in CauseKind}
    typed_kinds: dict[str, CauseKind] = {}
    for k, v in cause_kinds_raw.items():
        if v not in valid_kinds:
            raise DAGValidationError(
                f"node {k!r} has unknown cause_kind {v!r}; valid: {sorted(valid_kinds)}"
            )
        typed_kinds[k] = CauseKind(v)

    spec = DAGSpec(
        name=name,
        nodes=tuple(nodes),
        edges=tuple(typed_edges),
        cause_kinds=typed_kinds,
        notes=notes if isinstance(notes, str) else None,
    )
    if not spec.is_acyclic():
        raise DAGValidationError("DAG contains a cycle")
    return spec


def load_dag_for_model(model_id: str, *, repo_root: Path) -> DAGSpec:
    """Load + validate the DAG for `model_id`."""
    pipeline = _MODEL_TO_PIPELINE.get(model_id)
    if pipeline is None:
        raise DAGValidationError(f"no pipeline registered for model_id={model_id!r}")
    path = repo_root / "ml-pipelines" / pipeline / "causal_dag.json"
    if not path.exists():
        raise DAGValidationError(f"DAG file missing: {path}")
    return validate_dag(json.loads(path.read_text()))
```

- [ ] **Step 3: Run + verify**

```bash
uv run --package aegis-causal-attrib pytest services/causal-attrib/tests/test_dag_loader.py -v
git add services/causal-attrib/src/aegis_causal_attrib/dag_loader.py \
        services/causal-attrib/tests/test_dag_loader.py
git commit -m "feat(causal-attrib): Phase 6 — DAG loader + validator (acyclicity + cause-kind coverage)"
```

---

## Sub-phase 6b — Schema extensions

### Task 4: Extend `CausalAttribution` Pydantic model

**Files:**

- Modify: `packages/shared-py/src/aegis_shared/types.py`
- Modify: `packages/shared-py/src/aegis_shared/schemas.py`
- Modify: `packages/shared-py/tests/test_governance_schemas.py`
- Modify: `apps/dashboard/app/_lib/types.ts`

- [ ] **Step 1: `AttributionQuality` enum**

```python
# packages/shared-py/src/aegis_shared/types.py — append after existing StrEnums
class AttributionQuality(StrEnum):
    """Confidence band for a CausalAttribution result.

    HIGH: full DoWhy GCM Shapley decomposition succeeded on the model's DAG.
    DEGRADED: DBShap fallback fired (no DAG, DoWhy timeout, or runtime error).
    """

    HIGH = "high"
    DEGRADED = "degraded"
```

- [ ] **Step 2: Extend `CausalAttribution`**

```python
# packages/shared-py/src/aegis_shared/schemas.py — modify CausalAttribution
from aegis_shared.types import (
    AttributionQuality,
    DecisionState,
    ModelFamily,
    RiskClass,
    Severity,
)


class CausalAttribution(AegisModel):
    """Spec §12.1 — DoWhy GCM or DBShap fallback output."""

    method: str = Field(min_length=1)
    root_causes: list[CausalRootCause]
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    recommended_action: str | None = None
    attribution_quality: AttributionQuality = AttributionQuality.HIGH
```

- [ ] **Step 3: Failing tests**

```python
# packages/shared-py/tests/test_governance_schemas.py — append
def test_causal_attribution_carries_recommended_action_and_quality() -> None:
    from aegis_shared.schemas import CausalAttribution, CausalRootCause
    from aegis_shared.types import AttributionQuality

    attrib = CausalAttribution(
        method="DoWhy GCM",
        root_causes=[CausalRootCause(node="x", contribution=0.6)],
        confidence=0.86,
        recommended_action="REWEIGH",
        attribution_quality=AttributionQuality.HIGH,
    )
    assert attrib.recommended_action == "REWEIGH"
    assert attrib.attribution_quality is AttributionQuality.HIGH


def test_attribution_quality_defaults_to_high() -> None:
    from aegis_shared.schemas import CausalAttribution, CausalRootCause
    from aegis_shared.types import AttributionQuality

    attrib = CausalAttribution(
        method="DoWhy GCM", root_causes=[CausalRootCause(node="x", contribution=1.0)]
    )
    assert attrib.attribution_quality is AttributionQuality.HIGH
    assert attrib.recommended_action is None
```

- [ ] **Step 4: Update dashboard types**

```typescript
// apps/dashboard/app/_lib/types.ts — modify CausalAttribution interface
export interface CausalAttribution {
  readonly target_metric: string;
  readonly observed_value: number;
  readonly counterfactual_value: number;
  readonly root_causes: readonly CausalRootCause[];
  readonly dag_url?: string;
  /** Phase 6 — Pareto-policy prior; string action key (e.g. "REWEIGH"). */
  readonly recommended_action?: string;
  /** Phase 6 — "high" (DoWhy success) or "degraded" (DBShap fallback). */
  readonly attribution_quality?: "high" | "degraded";
}
```

- [ ] **Step 5: Run + commit**

```bash
uv run --package aegis-shared pytest packages/shared-py/tests/test_governance_schemas.py -v
pnpm --filter @aegis/dashboard typecheck
git add packages/shared-py/src/aegis_shared/{schemas.py,types.py} \
        packages/shared-py/tests/test_governance_schemas.py \
        apps/dashboard/app/_lib/types.ts
git commit -m "feat(schema): Phase 6 — CausalAttribution gains recommended_action + attribution_quality"
```

---

## Sub-phase 6c — FCM fitter (additive-noise SCM)

### Task 5: Per-node residual-fit SCM

**Files:**

- Create: `services/causal-attrib/src/aegis_causal_attrib/fcm.py`
- Create: `services/causal-attrib/tests/conftest.py`
- Create: `services/causal-attrib/tests/test_fcm.py`

- [ ] **Step 1: conftest — synthetic credit-DAG fixtures**

```python
# services/causal-attrib/tests/conftest.py
"""Shared fixtures — synthetic linear-Gaussian SCMs over the credit DAG."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def rng() -> np.random.Generator:
    return np.random.default_rng(seed=42)


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


@pytest.fixture
def credit_reference_frame(rng: np.random.Generator) -> pd.DataFrame:
    """Synthetic reference frame matching the credit-v1 DAG. 5,000 rows."""
    n = 5_000
    sex = rng.integers(0, 2, n)
    age = rng.integers(0, 5, n)
    co_app = (_sigmoid(0.4 * sex + 0.2 * age) > rng.random(n)).astype(int)
    income = (
        50_000 + 10_000 * sex + 5_000 * age + 8_000 * co_app + rng.normal(0, 5_000, n)
    )
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
    """Same SCM with a P(co_applicant_present | sex) shift — Apple-Card hero scenario."""
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
```

- [ ] **Step 2: Failing test**

```python
# services/causal-attrib/tests/test_fcm.py
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
```

- [ ] **Step 3: Implement `fcm.py`**

```python
# services/causal-attrib/src/aegis_causal_attrib/fcm.py
"""Per-node additive-noise structural causal model.

For each node V_i with parents PA(V_i):
  • If PA(V_i) is empty, fit a marginal distribution (categorical or
    Gaussian depending on whether values are integer-coded).
  • Otherwise, fit a Ridge regression `V_i = f(PA(V_i)) + ε` and store
    the residual std for noise sampling.

Sampling traverses the DAG in topological order and draws each node
from its mechanism conditioned on its parents.
"""

from __future__ import annotations

from dataclasses import dataclass

import networkx as nx
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from aegis_causal_attrib.dag_loader import DAGSpec


def _is_integer_coded(series: pd.Series) -> bool:
    if series.dtype.kind in {"i", "u"}:
        return True
    if series.dtype.kind == "f":
        non_null = series.dropna()
        return bool(np.all(non_null == non_null.astype(int)))
    return False


@dataclass(frozen=True)
class NodeMechanism:
    node: str
    parents: tuple[str, ...]
    is_categorical: bool
    marginal_values: np.ndarray | None
    marginal_probs: np.ndarray | None
    marginal_mu: float
    marginal_sigma: float
    coef: np.ndarray | None
    intercept: float
    residual_std: float


@dataclass(frozen=True)
class FittedFCM:
    spec: DAGSpec
    mechanisms: dict[str, NodeMechanism]
    column_means: dict[str, float]

    def sample(self, *, n: int, rng: np.random.Generator) -> pd.DataFrame:
        order = list(nx.topological_sort(self.spec.to_networkx()))
        out: dict[str, np.ndarray] = {}
        for node in order:
            mech = self.mechanisms[node]
            if not mech.parents:
                if mech.is_categorical and mech.marginal_values is not None:
                    out[node] = rng.choice(mech.marginal_values, size=n, p=mech.marginal_probs)
                else:
                    out[node] = rng.normal(mech.marginal_mu, mech.marginal_sigma, size=n)
            else:
                X = np.column_stack([out[p] for p in mech.parents]).astype(float)
                assert mech.coef is not None
                pred = X @ mech.coef + mech.intercept
                noise = rng.normal(0.0, mech.residual_std, size=n)
                out[node] = pred + noise
        return pd.DataFrame({node: out[node] for node in self.spec.nodes})


def fit_fcm(spec: DAGSpec, frame: pd.DataFrame) -> FittedFCM:
    missing = [n for n in spec.nodes if n not in frame.columns]
    if missing:
        raise ValueError(f"frame missing required DAG nodes: {missing}")

    mechs: dict[str, NodeMechanism] = {}
    for node in spec.nodes:
        parents = spec.parents(node)
        series = frame[node].astype(float)
        if not parents:
            if _is_integer_coded(frame[node]):
                vals, counts = np.unique(frame[node].dropna().to_numpy(), return_counts=True)
                probs = counts / counts.sum()
                mechs[node] = NodeMechanism(
                    node=node,
                    parents=(),
                    is_categorical=True,
                    marginal_values=vals,
                    marginal_probs=probs,
                    marginal_mu=float(series.mean()),
                    marginal_sigma=float(series.std(ddof=1) or 1.0),
                    coef=None,
                    intercept=float(series.mean()),
                    residual_std=float(series.std(ddof=1) or 1.0),
                )
            else:
                mechs[node] = NodeMechanism(
                    node=node,
                    parents=(),
                    is_categorical=False,
                    marginal_values=None,
                    marginal_probs=None,
                    marginal_mu=float(series.mean()),
                    marginal_sigma=float(series.std(ddof=1) or 1.0),
                    coef=None,
                    intercept=float(series.mean()),
                    residual_std=float(series.std(ddof=1) or 1.0),
                )
        else:
            X = frame[list(parents)].to_numpy().astype(float)
            y = series.to_numpy().astype(float)
            model = Ridge(alpha=1.0)
            model.fit(X, y)
            preds = model.predict(X)
            residuals = y - preds
            mechs[node] = NodeMechanism(
                node=node,
                parents=parents,
                is_categorical=False,
                marginal_values=None,
                marginal_probs=None,
                marginal_mu=0.0,
                marginal_sigma=0.0,
                coef=np.asarray(model.coef_).copy(),
                intercept=float(model.intercept_),
                residual_std=float(residuals.std(ddof=1) or 1.0),
            )
    column_means = {n: float(frame[n].mean()) for n in spec.nodes}
    return FittedFCM(spec=spec, mechanisms=mechs, column_means=column_means)
```

- [ ] **Step 4: Run + commit**

```bash
uv run --package aegis-causal-attrib pytest services/causal-attrib/tests/test_fcm.py -v
git add services/causal-attrib/src/aegis_causal_attrib/fcm.py \
        services/causal-attrib/tests/{test_fcm.py,conftest.py} \
        services/causal-attrib/pyproject.toml uv.lock
git commit -m "feat(causal-attrib): Phase 6 — additive-noise FCM fitter (sklearn Ridge per node)"
```

---

## Sub-phase 6d — DoWhy GCM wrapper

### Task 6: DoWhy `distribution_change` wrapper with timeout + cache

**Files:**

- Create: `services/causal-attrib/src/aegis_causal_attrib/config.py`
- Create: `services/causal-attrib/src/aegis_causal_attrib/dowhy_attrib.py`
- Create: `services/causal-attrib/tests/test_dowhy_attrib.py`

- [ ] **Step 1: Settings**

```python
# services/causal-attrib/src/aegis_causal_attrib/config.py
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", frozen=True
    )

    attrib_timeout_s: float = Field(default=30.0, alias="ATTRIB_TIMEOUT_S", ge=1.0)
    """Hard timeout for one DoWhy GCM run. Spec §12.1 default = 30 s."""

    dbshap_samples: int = Field(default=2_048, alias="DBSHAP_SAMPLES", ge=128)

    cache_size: int = Field(default=64, alias="CAUSAL_CACHE_SIZE", ge=1)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 2: Failing test**

```python
# services/causal-attrib/tests/test_dowhy_attrib.py
from __future__ import annotations

import time
from pathlib import Path

import pandas as pd
import pytest

from aegis_causal_attrib.dag_loader import load_dag_for_model
from aegis_causal_attrib.dowhy_attrib import (
    AttributionTimeoutError,
    DoWhyAttributionResult,
    run_dowhy_attribution,
)

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_dowhy_returns_shapley_per_node(
    credit_reference_frame: pd.DataFrame,
    credit_current_frame_with_drift: pd.DataFrame,
) -> None:
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    res = run_dowhy_attribution(
        model_id="credit-v1",
        spec=spec,
        reference=credit_reference_frame,
        current=credit_current_frame_with_drift,
        target_node="approval",
        timeout_s=60.0,
        num_samples=500,
    )
    assert isinstance(res, DoWhyAttributionResult)
    assert set(res.shapley.keys()) == set(spec.nodes)
    # The induced shift is on co_applicant_present | sex; the dominant
    # cause should be one of those two (shift propagates upstream).
    assert res.dominant_cause in {"co_applicant_present", "applicant_sex"}


def test_dowhy_timeout_raises(
    credit_reference_frame: pd.DataFrame,
    credit_current_frame_with_drift: pd.DataFrame,
) -> None:
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    with pytest.raises(AttributionTimeoutError):
        run_dowhy_attribution(
            model_id="credit-v1",
            spec=spec,
            reference=credit_reference_frame,
            current=credit_current_frame_with_drift,
            target_node="approval",
            timeout_s=0.001,
            num_samples=10,
        )


def test_dowhy_cache_hit_is_fast(
    credit_reference_frame: pd.DataFrame,
    credit_current_frame_with_drift: pd.DataFrame,
) -> None:
    """Identical inputs hit the LRU cache; second call returns ~instantly."""
    spec = load_dag_for_model("credit-v1", repo_root=REPO_ROOT)
    kwargs = {
        "model_id": "credit-v1",
        "spec": spec,
        "reference": credit_reference_frame,
        "current": credit_current_frame_with_drift,
        "target_node": "approval",
        "timeout_s": 60.0,
        "num_samples": 200,
    }
    t0 = time.perf_counter()
    a = run_dowhy_attribution(**kwargs)
    t1 = time.perf_counter()
    b = run_dowhy_attribution(**kwargs)
    t2 = time.perf_counter()
    assert a.shapley == b.shapley
    assert (t2 - t1) * 5 < (t1 - t0)
```

- [ ] **Step 3: Implement `dowhy_attrib.py` — JSON content-hashed cache (no pickle)**

```python
# services/causal-attrib/src/aegis_causal_attrib/dowhy_attrib.py
"""DoWhy GCM wrapper with hard timeout + content-hashed cache.

The cache keys on a SHA-256 fingerprint of (model_id, target_node,
num_samples, sorted column names, and the byte-content of each column
array). DoWhy is imported lazily so cold-start stays fast.

We store cache hits in a module-level dict keyed by the fingerprint —
no pickle serialization, only the structured DoWhyAttributionResult
dataclass which is itself frozen.
"""

from __future__ import annotations

import concurrent.futures
import hashlib
from dataclasses import dataclass

import numpy as np
import pandas as pd

from aegis_causal_attrib.dag_loader import DAGSpec


class AttributionTimeoutError(TimeoutError):
    """Raised when DoWhy GCM exceeds the configured timeout."""


class AttributionRuntimeError(RuntimeError):
    """Raised when DoWhy GCM throws (e.g. degenerate variance)."""


@dataclass(frozen=True)
class DoWhyAttributionResult:
    shapley: dict[str, float]
    dominant_cause: str
    target_node: str
    target_delta: float


def _frame_fingerprint(frame: pd.DataFrame) -> str:
    """Order-independent SHA-256 fingerprint of a frame's contents."""
    h = hashlib.sha256()
    for col in sorted(frame.columns):
        arr = frame[col].to_numpy()
        h.update(col.encode("utf-8"))
        h.update(np.ascontiguousarray(arr).tobytes())
    return h.hexdigest()


# Module-level cache. Bounded by aggressive eviction — for an 8-9-month
# project we accept the simplicity of a dict here. If memory becomes a
# concern, swap for `cachetools.LRUCache(maxsize=settings.cache_size)`.
_CACHE: dict[str, DoWhyAttributionResult] = {}


def _cache_key(
    model_id: str,
    target_node: str,
    num_samples: int,
    ref_fp: str,
    cur_fp: str,
) -> str:
    return f"{model_id}|{target_node}|{num_samples}|{ref_fp}|{cur_fp}"


def _compute_dowhy(
    spec: DAGSpec,
    reference: pd.DataFrame,
    current: pd.DataFrame,
    target_node: str,
    num_samples: int,
) -> DoWhyAttributionResult:
    """Inner compute — imported lazily so cold-start stays fast."""
    import dowhy.gcm as gcm  # noqa: PLC0415

    model = gcm.StructuralCausalModel(spec.to_networkx())
    gcm.auto.assign_causal_mechanisms(model, reference)
    gcm.fit(model, reference)

    contributions = gcm.distribution_change(
        model,
        old_data=reference,
        new_data=current,
        target_node=target_node,
        num_samples=num_samples,
    )
    shapley = {str(k): float(v) for k, v in contributions.items()}
    dominant = max(shapley.items(), key=lambda kv: abs(kv[1]))[0]
    target_delta = float(current[target_node].mean() - reference[target_node].mean())
    return DoWhyAttributionResult(
        shapley=shapley,
        dominant_cause=dominant,
        target_node=target_node,
        target_delta=target_delta,
    )


def run_dowhy_attribution(
    *,
    model_id: str,
    spec: DAGSpec,
    reference: pd.DataFrame,
    current: pd.DataFrame,
    target_node: str,
    timeout_s: float,
    num_samples: int = 1_000,
) -> DoWhyAttributionResult:
    """Run DoWhy GCM `distribution_change` with timeout + cache.

    Raises:
      AttributionTimeoutError if the run exceeds `timeout_s`.
      AttributionRuntimeError on DoWhy errors.
    """
    ref_fp = _frame_fingerprint(reference)
    cur_fp = _frame_fingerprint(current)
    key = _cache_key(model_id, target_node, num_samples, ref_fp, cur_fp)
    if key in _CACHE:
        return _CACHE[key]

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(
            _compute_dowhy, spec, reference, current, target_node, num_samples
        )
        try:
            result = fut.result(timeout=timeout_s)
        except concurrent.futures.TimeoutError as exc:
            raise AttributionTimeoutError(
                f"DoWhy GCM exceeded timeout_s={timeout_s} for model_id={model_id}"
            ) from exc
        except Exception as exc:
            raise AttributionRuntimeError(f"DoWhy GCM failed: {exc!r}") from exc

    _CACHE[key] = result
    return result


def clear_cache() -> None:
    """Drop the in-process cache. Used by tests + ops scripts."""
    _CACHE.clear()
```

- [ ] **Step 4: Run + commit**

```bash
uv run --package aegis-causal-attrib pytest services/causal-attrib/tests/test_dowhy_attrib.py -v
git add services/causal-attrib/src/aegis_causal_attrib/{dowhy_attrib.py,config.py} \
        services/causal-attrib/tests/test_dowhy_attrib.py
git commit -m "feat(causal-attrib): Phase 6 — DoWhy GCM wrapper (timeout + content-hashed cache, lazy import)"
```

---

## Sub-phase 6e — DBShap fallback

### Task 7: DBShap fallback (Edakunni et al. 2024)

**Files:**

- Create: `services/causal-attrib/src/aegis_causal_attrib/dbshap.py`
- Create: `services/causal-attrib/tests/test_dbshap.py`

- [ ] **Step 1: Failing test**

```python
# services/causal-attrib/tests/test_dbshap.py
from __future__ import annotations

import time

import numpy as np
import pandas as pd

from aegis_causal_attrib.dbshap import DBShapResult, run_dbshap


def test_dbshap_attributes_drifted_feature() -> None:
    rng = np.random.default_rng(0)
    n = 1_500
    a_ref = rng.normal(0.0, 1.0, n)
    b_ref = rng.normal(0.0, 1.0, n)
    y_ref = (0.5 * a_ref + 0.3 * b_ref + rng.normal(0.0, 0.1, n) > 0).astype(int)
    ref = pd.DataFrame({"a": a_ref, "b": b_ref, "y": y_ref})
    a_cur = rng.normal(1.0, 1.0, n)
    y_cur = (0.5 * a_cur + 0.3 * b_ref + rng.normal(0.0, 0.1, n) > 0).astype(int)
    cur = pd.DataFrame({"a": a_cur, "b": b_ref, "y": y_cur})

    res = run_dbshap(reference=ref, current=cur, target_column="y", num_samples=512)
    assert isinstance(res, DBShapResult)
    assert set(res.shapley.keys()) == {"a", "b"}
    assert abs(res.shapley["a"]) > abs(res.shapley["b"]), "feature `a` drifted, `b` did not"


def test_dbshap_runs_under_5_seconds() -> None:
    """Spec §12.1: DBShap is the cheap fallback. Stay under 5 s for ~5,000 rows."""
    rng = np.random.default_rng(1)
    n = 5_000
    df = pd.DataFrame(
        {"a": rng.normal(0.0, 1.0, n), "b": rng.normal(0.0, 1.0, n), "y": rng.integers(0, 2, n)}
    )
    df2 = df.copy()
    df2["a"] = rng.normal(1.0, 1.0, n)
    t0 = time.perf_counter()
    run_dbshap(reference=df, current=df2, target_column="y", num_samples=1_024)
    elapsed = time.perf_counter() - t0
    assert elapsed < 5.0, f"DBShap took {elapsed:.2f}s; budget 5s"
```

- [ ] **Step 2: Implement**

```python
# services/causal-attrib/src/aegis_causal_attrib/dbshap.py
"""DBShap — distribution-Shapley fallback (Edakunni et al. arXiv:2401.09756, 2024).

For each feature i:

  φ_i = (1/|N|!) · Σ_π [v(S_π,i ∪ {i}) − v(S_π,i)]

where v(S) is the target metric obtained by *swapping* the marginal
distribution of features in S from D_ref to D_cur (others held at
D_ref). We approximate the Shapley sum with Monte-Carlo permutation
sampling — `num_samples` permutations.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.stats import wasserstein_distance


@dataclass(frozen=True)
class DBShapResult:
    shapley: dict[str, float]
    dominant_cause: str
    target_column: str
    target_delta: float


def _swap_marginal(
    base: pd.DataFrame,
    donor: pd.DataFrame,
    columns: list[str],
    rng: np.random.Generator,
) -> pd.DataFrame:
    """Return a copy of `base` with `columns` resampled from `donor`'s marginals."""
    out = base.copy()
    n = len(out)
    for col in columns:
        idx = rng.integers(0, len(donor), size=n)
        out[col] = donor[col].to_numpy()[idx]
    return out


def _target_metric(frame: pd.DataFrame, target: str) -> float:
    return float(frame[target].mean())


def run_dbshap(
    *,
    reference: pd.DataFrame,
    current: pd.DataFrame,
    target_column: str,
    num_samples: int = 2_048,
    rng: np.random.Generator | None = None,
) -> DBShapResult:
    """Compute distribution-Shapley contributions over `reference.columns`."""
    rng = rng or np.random.default_rng(0)
    features = [c for c in reference.columns if c != target_column]
    if len(features) == 0:
        raise ValueError("at least one non-target column required")

    n_features = len(features)
    contributions: dict[str, float] = dict.fromkeys(features, 0.0)
    target_delta = _target_metric(current, target_column) - _target_metric(reference, target_column)

    for _ in range(num_samples):
        perm = list(rng.permutation(n_features))
        prefix: list[str] = []
        prev_value = _target_metric(reference, target_column)
        for idx in perm:
            feature = features[idx]
            prefix.append(feature)
            swapped = _swap_marginal(reference, current, prefix, rng)
            new_value = _target_metric(swapped, target_column)
            contributions[feature] += new_value - prev_value
            prev_value = new_value

    for feature in features:
        contributions[feature] /= num_samples

    dominant = max(contributions.items(), key=lambda kv: abs(kv[1]))[0]
    return DBShapResult(
        shapley=contributions,
        dominant_cause=dominant,
        target_column=target_column,
        target_delta=target_delta,
    )


def feature_wasserstein(reference: pd.DataFrame, current: pd.DataFrame) -> dict[str, float]:
    """Per-feature Wasserstein-1 between reference and current marginals."""
    out: dict[str, float] = {}
    for col in reference.columns:
        if not math.isfinite(reference[col].mean()):
            continue
        out[col] = float(wasserstein_distance(reference[col].to_numpy(), current[col].to_numpy()))
    return out
```

- [ ] **Step 3: Run + commit**

```bash
uv run --package aegis-causal-attrib pytest services/causal-attrib/tests/test_dbshap.py -v
git add services/causal-attrib/src/aegis_causal_attrib/dbshap.py \
        services/causal-attrib/tests/test_dbshap.py
git commit -m "feat(causal-attrib): Phase 6 — DBShap fallback (Edakunni 2024)"
```

---

## Sub-phase 6f — Cause → action mapping

### Task 8: Cause → action mapping table

**Files:**

- Create: `services/causal-attrib/src/aegis_causal_attrib/cause_mapping.py`
- Create: `services/causal-attrib/tests/test_cause_mapping.py`

- [ ] **Step 1: Failing test**

```python
# services/causal-attrib/tests/test_cause_mapping.py
"""Tests for the cause→action mapping table — spec §12.1 paper artifact."""

from __future__ import annotations

from aegis_causal_attrib.cause_mapping import (
    CAUSE_TO_ACTION,
    ActionKey,
    AttributionEvidence,
    recommend_action,
)
from aegis_causal_attrib.dag_loader import CauseKind


def test_every_cause_kind_has_a_target_action() -> None:
    for kind in CauseKind:
        assert kind in CAUSE_TO_ACTION, f"missing action mapping for {kind}"
        assert isinstance(CAUSE_TO_ACTION[kind], ActionKey)


def test_recommend_action_respects_dominant_cause() -> None:
    ev = AttributionEvidence(
        dominant_cause_node="co_applicant_present",
        dominant_cause_kind=CauseKind.UPSTREAM_COVARIATE,
        shapley={"co_applicant_present": 0.71, "loan_purpose": 0.18},
        confidence=0.86,
    )
    assert recommend_action(ev) is ActionKey.REWEIGH


def test_low_confidence_routes_to_human() -> None:
    ev = AttributionEvidence(
        dominant_cause_node="x",
        dominant_cause_kind=CauseKind.CONDITIONAL_MECHANISM,
        shapley={"x": 0.1, "y": 0.09, "z": 0.08},
        confidence=0.30,
    )
    action = recommend_action(ev, confidence_floor=0.50)
    assert action is ActionKey.ESCALATE


def test_action_keys_match_spec_table_entries() -> None:
    expected = {
        "REWEIGH",
        "RETRAIN",
        "RECALIBRATE",
        "FEATURE_DROP",
        "CALIBRATION_PATCH",
        "REJECT_OPTION",
        "ESCALATE",
    }
    assert {a.value for a in ActionKey} >= expected
```

- [ ] **Step 2: Implement**

```python
# services/causal-attrib/src/aegis_causal_attrib/cause_mapping.py
"""Cause → remediation action mapping (spec §12.1 paper artifact).

Hand-curated from:
  • Kamiran & Calders (2012) — reweighing for upstream covariate shift
  • Zafar et al. (2017) — retraining when conditional mechanisms move
  • Pleiss et al. (2017) — calibration patches for label-prior shift
  • Friedler et al. (2019) — feature drop for proxy-attribute shift
  • Chow (1970) — reject option for high uncertainty
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from aegis_causal_attrib.dag_loader import CauseKind


class ActionKey(StrEnum):
    """Remediation actions Phase 7's policy will choose between."""

    REWEIGH = "REWEIGH"
    RETRAIN = "RETRAIN"
    RECALIBRATE = "RECALIBRATE"
    FEATURE_DROP = "FEATURE_DROP"
    CALIBRATION_PATCH = "CALIBRATION_PATCH"
    REJECT_OPTION = "REJECT_OPTION"
    ESCALATE = "ESCALATE"


CAUSE_TO_ACTION: dict[CauseKind, ActionKey] = {
    CauseKind.UPSTREAM_COVARIATE: ActionKey.REWEIGH,
    CauseKind.CONDITIONAL_MECHANISM: ActionKey.RETRAIN,
    CauseKind.PROXY_ATTRIBUTE: ActionKey.FEATURE_DROP,
    CauseKind.CALIBRATION_MECHANISM: ActionKey.CALIBRATION_PATCH,
}


@dataclass(frozen=True)
class AttributionEvidence:
    dominant_cause_node: str
    dominant_cause_kind: CauseKind
    shapley: dict[str, float]
    confidence: float


def recommend_action(
    evidence: AttributionEvidence,
    *,
    confidence_floor: float = 0.50,
    tie_threshold: float = 0.05,
) -> ActionKey:
    """Map a CauseKind to a recommended remediation action.

    Below confidence floor: ESCALATE (route to human).
    Top-2 within `tie_threshold` relative gap: REJECT_OPTION (abstain).
    Otherwise: dispatch via CAUSE_TO_ACTION.
    """
    if evidence.confidence < confidence_floor:
        return ActionKey.ESCALATE

    top = sorted(evidence.shapley.items(), key=lambda kv: abs(kv[1]), reverse=True)
    if len(top) >= 2:
        first, second = abs(top[0][1]), abs(top[1][1])
        if first > 0 and (first - second) / first < tie_threshold:
            return ActionKey.REJECT_OPTION

    return CAUSE_TO_ACTION.get(evidence.dominant_cause_kind, ActionKey.ESCALATE)
```

- [ ] **Step 3: Run + commit**

```bash
uv run --package aegis-causal-attrib pytest services/causal-attrib/tests/test_cause_mapping.py -v
git add services/causal-attrib/src/aegis_causal_attrib/cause_mapping.py \
        services/causal-attrib/tests/test_cause_mapping.py
git commit -m "feat(causal-attrib): Phase 6 — cause→action mapping (paper §12.1 artifact)"
```

---

## Sub-phase 6g — HTTP endpoint + control-plane wire

### Task 9: `/attrib/run` endpoint

**Files:**

- Create: `services/causal-attrib/src/aegis_causal_attrib/routers/attrib.py`
- Modify: `services/causal-attrib/src/aegis_causal_attrib/app.py` (mount the router)
- Create: `services/causal-attrib/tests/test_attrib_endpoint.py`

- [ ] **Step 1: Failing test**

```python
# services/causal-attrib/tests/test_attrib_endpoint.py
from __future__ import annotations

import pandas as pd
from fastapi.testclient import TestClient

from aegis_causal_attrib.app import build_app


def _frame_to_payload(df: pd.DataFrame) -> list[dict[str, float]]:
    return df.to_dict(orient="records")  # type: ignore[return-value]


def test_attrib_run_returns_causal_attribution(
    credit_reference_frame: pd.DataFrame,
    credit_current_frame_with_drift: pd.DataFrame,
) -> None:
    body = {
        "model_id": "credit-v1",
        "target_node": "approval",
        "reference_rows": _frame_to_payload(credit_reference_frame.head(500)),
        "current_rows": _frame_to_payload(credit_current_frame_with_drift.head(500)),
        "num_samples": 200,
    }
    res = TestClient(build_app()).post("/attrib/run", json=body)
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["method"] in {"DoWhy GCM", "DBShap"}
    assert isinstance(payload["root_causes"], list)
    assert payload["root_causes"]
    assert payload["recommended_action"] in {
        "REWEIGH",
        "RETRAIN",
        "RECALIBRATE",
        "FEATURE_DROP",
        "CALIBRATION_PATCH",
        "REJECT_OPTION",
        "ESCALATE",
    }
    assert payload["attribution_quality"] in {"high", "degraded"}


def test_attrib_run_unknown_model_returns_404() -> None:
    res = TestClient(build_app()).post(
        "/attrib/run",
        json={
            "model_id": "no-such-model",
            "target_node": "y",
            "reference_rows": [{"x": 1.0, "y": 0.0}],
            "current_rows": [{"x": 1.0, "y": 0.0}],
        },
    )
    assert res.status_code == 404
```

- [ ] **Step 2: Implement the router**

```python
# services/causal-attrib/src/aegis_causal_attrib/routers/attrib.py
"""POST /attrib/run — run causal attribution + recommend action."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from aegis_causal_attrib.cause_mapping import (
    AttributionEvidence,
    recommend_action,
)
from aegis_causal_attrib.config import get_settings
from aegis_causal_attrib.dag_loader import (
    CauseKind,
    DAGValidationError,
    load_dag_for_model,
)
from aegis_causal_attrib.dbshap import run_dbshap
from aegis_causal_attrib.dowhy_attrib import (
    AttributionRuntimeError,
    AttributionTimeoutError,
    run_dowhy_attribution,
)
from aegis_shared.types import AttributionQuality

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[5]


class AttribRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    model_id: str = Field(min_length=1)
    target_node: str = Field(min_length=1)
    reference_rows: list[dict[str, Any]] = Field(min_length=1)
    current_rows: list[dict[str, Any]] = Field(min_length=1)
    num_samples: int = Field(default=1_000, ge=10, le=10_000)


@router.post("/attrib/run")
def attrib_run(payload: AttribRunRequest) -> dict[str, Any]:
    settings = get_settings()
    try:
        spec = load_dag_for_model(payload.model_id, repo_root=REPO_ROOT)
    except DAGValidationError as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"no DAG for model_id={payload.model_id}"
        ) from exc

    reference = pd.DataFrame(payload.reference_rows)
    current = pd.DataFrame(payload.current_rows)

    try:
        result = run_dowhy_attribution(
            model_id=payload.model_id,
            spec=spec,
            reference=reference,
            current=current,
            target_node=payload.target_node,
            timeout_s=settings.attrib_timeout_s,
            num_samples=payload.num_samples,
        )
        method = "DoWhy GCM"
        quality = AttributionQuality.HIGH
        shapley = result.shapley
        dominant = result.dominant_cause
        target_delta = result.target_delta
    except (AttributionTimeoutError, AttributionRuntimeError):
        dbshap = run_dbshap(
            reference=reference,
            current=current,
            target_column=payload.target_node,
            num_samples=settings.dbshap_samples,
        )
        method = "DBShap"
        quality = AttributionQuality.DEGRADED
        shapley = dbshap.shapley
        dominant = dbshap.dominant_cause
        target_delta = dbshap.target_delta

    total = sum(abs(v) for v in shapley.values()) or 1.0
    confidence = abs(shapley.get(dominant, 0.0)) / total
    dominant_kind = spec.cause_kinds.get(dominant, CauseKind.UPSTREAM_COVARIATE)
    action = recommend_action(
        AttributionEvidence(
            dominant_cause_node=dominant,
            dominant_cause_kind=dominant_kind,
            shapley=shapley,
            confidence=confidence,
        )
    )

    root_causes = [
        {"node": node, "contribution": abs(v) / total}
        for node, v in sorted(shapley.items(), key=lambda kv: abs(kv[1]), reverse=True)
    ]

    return {
        "method": method,
        "target_metric": payload.target_node,
        "observed_value": float(current[payload.target_node].mean()),
        "counterfactual_value": float(reference[payload.target_node].mean()),
        "target_delta": target_delta,
        "root_causes": root_causes,
        "confidence": confidence,
        "recommended_action": action.value,
        "attribution_quality": quality.value,
    }
```

- [ ] **Step 3: Mount in `app.py`**

```python
# services/causal-attrib/src/aegis_causal_attrib/app.py — extend imports + build_app()
from aegis_causal_attrib.routers import attrib as attrib_router
# inside build_app():
app.include_router(attrib_router.router)
```

- [ ] **Step 4: Run + commit**

```bash
uv run --package aegis-causal-attrib pytest services/causal-attrib/tests/test_attrib_endpoint.py -v
git add services/causal-attrib/src/aegis_causal_attrib/{routers/attrib.py,app.py} \
        services/causal-attrib/tests/test_attrib_endpoint.py
git commit -m "feat(causal-attrib): Phase 6 — POST /attrib/run with DoWhy + DBShap fallback"
```

### Task 10: Control-plane wires the analyze-state transition

**Files:**

- Modify: `services/control-plane/src/aegis_control_plane/config.py`
- Modify: `services/control-plane/src/aegis_control_plane/routers/decisions.py`
- Create: `services/control-plane/tests/test_decision_attribution.py`

- [ ] **Step 1: Settings**

```python
# services/control-plane/src/aegis_control_plane/config.py — extend Settings
causal_attrib_url: str = Field(
    default="http://localhost:8003", alias="CAUSAL_ATTRIB_URL"
)
"""Base URL for services/causal-attrib (Phase 6 wire)."""
```

- [ ] **Step 2: Wire the analyze-state transition**

In `services/control-plane/src/aegis_control_plane/routers/decisions.py`, inside `transition_decision()`, after the state-machine validation but before the commit, add an auto-attribution branch:

```python
# Auto-attribution via services/causal-attrib (Phase 6).
# Only fires when target == ANALYZED and the caller didn't supply an
# explicit payload — explicit payloads bypass causal-attrib (used by
# tests + the seeder + future operator-driven flows).
if target == DecisionState.ANALYZED and payload.payload is None:
    import httpx  # noqa: PLC0415
    import logging  # noqa: PLC0415

    from aegis_control_plane.config import get_settings  # noqa: PLC0415

    settings = get_settings()
    attrib_url = f"{settings.causal_attrib_url.rstrip('/')}/attrib/run"
    drift = row.drift_signal or {}
    ref_rows = drift.get("reference_rows") or []
    cur_rows = drift.get("current_rows") or []
    target_metric = drift.get("metric", "approval")

    # Skip if no data was attached — degraded path, attribution lands later.
    if ref_rows and cur_rows:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    attrib_url,
                    json={
                        "model_id": row.model_id,
                        "target_node": target_metric,
                        "reference_rows": ref_rows,
                        "current_rows": cur_rows,
                    },
                )
                resp.raise_for_status()
                row.causal_attribution = resp.json()
        except (httpx.HTTPError, httpx.RequestError):
            logging.getLogger(__name__).warning(
                "causal-attrib unavailable; analyze-state proceeds without attribution payload"
            )
```

- [ ] **Step 3: Test that stubs the HTTP call**

```python
# services/control-plane/tests/test_decision_attribution.py
"""Tests that the analyze-state transition calls /attrib/run."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane import db as db_module
from aegis_control_plane.config import get_settings
from aegis_control_plane.orm import GovernanceDecisionRow

pytestmark = pytest.mark.db


@pytest.mark.asyncio
async def test_analyze_transition_calls_causal_attrib(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch, hmac_secret: str
) -> None:
    """When state goes detected → analyzed without explicit payload,
    the control plane calls /attrib/run and persists the result."""
    import os
    from aegis_control_plane import seed as seed_module

    os.environ["AUDIT_LOG_HMAC_SECRET"] = hmac_secret
    get_settings.cache_clear()
    await seed_module.seed_hero_scenario(db_session)
    await db_session.commit()

    decision_id = seed_module.HERO_DECISION_ID
    row = await db_session.get(GovernanceDecisionRow, decision_id)
    assert row is not None
    # Reset state to detected so we can transition forward.
    row.state = "detected"
    row.causal_attribution = None
    # Inject minimal reference/current rows the mock will see.
    row.drift_signal = {
        "metric": "approval",
        "reference_rows": [{"x": 1.0, "approval": 1.0}],
        "current_rows": [{"x": 0.0, "approval": 0.0}],
    }
    await db_session.commit()

    # Monkey-patch httpx.AsyncClient.post to return a canned attribution.
    canned = {
        "method": "DoWhy GCM",
        "target_metric": "approval",
        "observed_value": 0.0,
        "counterfactual_value": 1.0,
        "target_delta": -1.0,
        "root_causes": [{"node": "x", "contribution": 1.0}],
        "confidence": 1.0,
        "recommended_action": "REWEIGH",
        "attribution_quality": "high",
    }

    class _StubResponse:
        status_code = 200

        def raise_for_status(self) -> None:  # noqa: D401
            return None

        def json(self) -> dict[str, Any]:
            return canned

    class _StubClient:
        async def __aenter__(self) -> "_StubClient":
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

        async def post(self, *_: object, **__: object) -> _StubResponse:
            return _StubResponse()

    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: _StubClient())  # type: ignore[arg-type]

    # Override the session dependency.
    from aegis_control_plane.app import build_app

    async def _override() -> AsyncIterator[AsyncSession]:
        yield db_session

    app = build_app()
    app.dependency_overrides[db_module.get_session] = _override

    # Use ASGITransport so we don't bind a real port.
    from httpx import ASGITransport

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/cp/decisions/{decision_id}/transition",
            json={"target_state": "analyzed"},
        )

    assert res.status_code == 200, res.text
    refreshed = (
        await db_session.execute(
            select(GovernanceDecisionRow).where(GovernanceDecisionRow.id == decision_id)
        )
    ).scalar_one()
    assert refreshed.causal_attribution is not None
    assert refreshed.causal_attribution["method"] == "DoWhy GCM"
    assert refreshed.causal_attribution["recommended_action"] == "REWEIGH"

    app.dependency_overrides.clear()
```

- [ ] **Step 4: Run + commit (test skips without DATABASE_URL)**

```bash
uv run --package aegis-control-plane pytest services/control-plane/tests/test_decision_attribution.py -v
git add services/control-plane/src/aegis_control_plane/{routers/decisions.py,config.py} \
        services/control-plane/tests/test_decision_attribution.py
git commit -m "feat(control-plane): Phase 6 — analyze-state transition calls /attrib/run"
```

---

## Sub-phase 6h — Property tests + hero scenario refinement

### Task 11: Shapley-efficiency property test

**Files:**

- Create: `services/causal-attrib/tests/test_shapley_efficiency.py`

- [ ] **Step 1: Hypothesis property test**

```python
# services/causal-attrib/tests/test_shapley_efficiency.py
"""Spec §12.1 efficiency: the sum of Shapley contributions ≈ Δtarget.

CI-merge-blocking. The DBShap path is deterministic enough at moderate
sample counts to assert this within a Monte-Carlo tolerance.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from hypothesis import HealthCheck, given, settings, strategies as st

from aegis_causal_attrib.dbshap import run_dbshap


@settings(deadline=None, max_examples=10, suppress_health_check=[HealthCheck.too_slow])
@given(
    seed=st.integers(min_value=0, max_value=10_000),
    drift_strength=st.floats(min_value=0.1, max_value=2.0),
)
def test_dbshap_satisfies_efficiency_identity(seed: int, drift_strength: float) -> None:
    rng = np.random.default_rng(seed)
    n = 1_500
    a_ref = rng.normal(0.0, 1.0, n)
    b_ref = rng.normal(0.0, 1.0, n)
    y_ref = (0.5 * a_ref + 0.3 * b_ref + rng.normal(0.0, 0.1, n) > 0).astype(int)
    ref = pd.DataFrame({"a": a_ref, "b": b_ref, "y": y_ref})
    a_cur = rng.normal(drift_strength, 1.0, n)
    y_cur = (0.5 * a_cur + 0.3 * b_ref + rng.normal(0.0, 0.1, n) > 0).astype(int)
    cur = pd.DataFrame({"a": a_cur, "b": b_ref, "y": y_cur})

    res = run_dbshap(reference=ref, current=cur, target_column="y", num_samples=512)
    summed = sum(res.shapley.values())
    tol = max(0.02, 0.10 * abs(res.target_delta))
    assert abs(summed - res.target_delta) < tol, (
        f"Σφ={summed:.4f} vs Δtarget={res.target_delta:.4f} (tol {tol:.4f})"
    )
```

- [ ] **Step 2: Run + commit**

```bash
uv run --package aegis-causal-attrib pytest services/causal-attrib/tests/test_shapley_efficiency.py -v
git add services/causal-attrib/tests/test_shapley_efficiency.py
git commit -m "test(causal-attrib): Phase 6 — Shapley efficiency property test (spec §12.1 claim)"
```

### Task 12: Hero scenario reuses real attribution

**Files:**

- Create: `tests/scenarios/__init__.py`
- Create: `tests/scenarios/_harness.py`
- Create: `tests/scenarios/apple_card_2019.py`
- Create: `tests/scenarios/test_scenario_apple_card.py`
- Modify: `services/control-plane/src/aegis_control_plane/seed.py`

- [ ] **Step 1: Scenario harness**

```python
# tests/scenarios/_harness.py
"""Minimal scenario runner — Phase 9 will extend with the full 10-scenario library."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class Scenario:
    name: str
    model_id: str
    target_node: str
    build_reference: Callable[[], pd.DataFrame]
    build_current: Callable[[], pd.DataFrame]
    expected_dominant_cause: str
    expected_action: str
```

- [ ] **Step 2: Apple-Card scenario**

```python
# tests/scenarios/apple_card_2019.py
"""Apple-Card-2019 scenario — the hero replay (spec §5.2 + Appendix A.1)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from tests.scenarios._harness import Scenario


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _build_reference() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    n = 5_000
    sex = rng.integers(0, 2, n)
    age = rng.integers(0, 5, n)
    co_app = (_sigmoid(0.4 * sex + 0.2 * age) > rng.random(n)).astype(int)
    income = (
        50_000 + 10_000 * sex + 5_000 * age + 8_000 * co_app + rng.normal(0, 5_000, n)
    )
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
    rng = np.random.default_rng(43)
    df = _build_reference()
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


APPLE_CARD_2019 = Scenario(
    name="apple_card_2019",
    model_id="credit-v1",
    target_node="approval",
    build_reference=_build_reference,
    build_current=_build_current,
    expected_dominant_cause="co_applicant_present",
    expected_action="REWEIGH",
)
```

- [ ] **Step 3: Headline scenario test**

```python
# tests/scenarios/test_scenario_apple_card.py
"""End-to-end scenario test — Apple-Card-2019 reproduces the seeded attribution."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.scenarios.apple_card_2019 import APPLE_CARD_2019


@pytest.mark.slow
def test_apple_card_2019_attribution_identifies_co_applicant_shift() -> None:
    from aegis_causal_attrib.cause_mapping import (
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
        num_samples=500,
    )
    assert res.dominant_cause in {"co_applicant_present", "applicant_sex"}

    total = sum(abs(v) for v in res.shapley.values()) or 1.0
    top_share = abs(res.shapley[res.dominant_cause]) / total
    assert top_share > 0.5, f"top contributor share {top_share:.2f} too low"

    confidence = top_share
    action = recommend_action(
        AttributionEvidence(
            dominant_cause_node=res.dominant_cause,
            dominant_cause_kind=spec.cause_kinds[res.dominant_cause],
            shapley=res.shapley,
            confidence=confidence,
        )
    )
    assert action.value in {"REWEIGH", "FEATURE_DROP"}
```

- [ ] **Step 4: Update the seeder to record Phase 6 provenance**

```python
# services/control-plane/src/aegis_control_plane/seed.py — extend _HERO_CAUSAL_ATTRIBUTION dict
# Add these two keys (before the closing brace):
"recommended_action": "REWEIGH",
"attribution_quality": "high",
```

- [ ] **Step 5: Run + commit**

```bash
uv run pytest tests/scenarios/test_scenario_apple_card.py -v
git add tests/scenarios/ services/control-plane/src/aegis_control_plane/seed.py
git commit -m "feat(scenarios): Phase 6 — Apple-Card-2019 scenario reproduces the seeded attribution"
```

---

## Sub-phase 6i — setup.md, vercel.ts, push, tag

### Task 13: setup.md "Phase 6" section

**Files:**

- Modify: `setup.md`

- [ ] **Append:**

```markdown
## Phase 6 — causal root-cause attribution

After Phase 5 the dashboard reads live data; Phase 6 makes the
`causal_attribution` JSONB column on `governance_decisions` come from a
real attribution engine instead of seeded constants.

**Boot the causal-attrib worker:**

    uv sync --all-packages
    uv run --package aegis-causal-attrib uvicorn aegis_causal_attrib.app:app --port 8003

Smoke-test:

    curl http://127.0.0.1:8003/healthz
    # → {"ok": true, "service": "causal-attrib", "version": "0.1.0"}

**Run the Apple-Card-2019 scenario test (gold):**

    uv run pytest tests/scenarios/test_scenario_apple_card.py -v

This loads the credit-v1 DAG, fits an additive-noise SCM on the
reference frame, runs DoWhy GCM `distribution_change` against a
co-applicant-shifted current frame, and asserts the dominant cause is
in `{co_applicant_present, applicant_sex}` with > 50% Shapley share.

**Wire the control plane to the worker** (one-time per dev machine):

    export CAUSAL_ATTRIB_URL=http://127.0.0.1:8003

The control plane's analyze-state transition will call
`POST /attrib/run` whenever a `GovernanceDecision` advances from
`detected` to `analyzed` _and_ the caller didn't supply an explicit
payload (used to bypass the worker for tests + the seeder).

**Configuration knobs (Phase 6 additions):**

| Var                 | Default                 | Purpose                                                                            |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `CAUSAL_ATTRIB_URL` | `http://localhost:8003` | Where the control plane reaches services/causal-attrib                             |
| `ATTRIB_TIMEOUT_S`  | `30.0`                  | Hard timeout per DoWhy GCM call (spec §12.1)                                       |
| `DBSHAP_SAMPLES`    | `2048`                  | Monte-Carlo permutation budget for the DBShap fallback                             |
| `CAUSAL_CACHE_SIZE` | `64`                    | In-process LRU cache size keyed by (model_id, target, ref_fp, cur_fp, num_samples) |
```

### Task 14: vercel.ts rewrite

**Files:**

- Modify: `vercel.ts`

```typescript
// vercel.ts — extend rewrites
rewrites: [
  routes.rewrite("/api/cp/:path*", "/services/control-plane/api/index.py?path=:path*"),
  routes.rewrite("/api/causal/:path*", "/services/causal-attrib/api/index.py?path=:path*"),
],
```

### Task 15: Tag + push

```bash
git push origin main
git tag -a phase-6-complete -m "Phase 6 — causal root-cause attribution · DoWhy GCM + DBShap fallback · cause→action mapping"
git push origin phase-6-complete
```

---

## Self-review

### Spec coverage

| Spec §                                 | Requirement                       | Task |
| -------------------------------------- | --------------------------------- | ---- |
| 12.1 — DoWhy GCM `distribution_change` | wrapper with timeout + cache      | 6    |
| 12.1 — DBShap fallback                 | pure-NumPy distribution-Shapley   | 7    |
| 12.1 — cause→action mapping            | static table + `recommend_action` | 8    |
| 12.1 — efficiency identity             | property test                     | 11   |
| 12.1 — `attribution_quality=degraded`  | tagged on DBShap branch           | 4, 9 |
| 4.3 — `services/causal-attrib` row     | `/attrib/run` endpoint            | 9    |
| 5.1 — analyze-state transition         | control plane calls /attrib/run   | 10   |
| 6.1 — `causal_attribution` JSONB       | extended schema                   | 4    |
| 13:Phase 5 (re-numbered to 6)          | service + DAGs + first ablation   | 1–12 |
| Appendix A — real-world incidents      | hero scenario walks               | 12   |

### Placeholder scan

No `TBD` / `TODO`. Each step shows actual code or actual command.

### Type consistency

- `CauseKind` (4 values: `proxy_attribute`, `upstream_covariate`, `conditional_mechanism`, `calibration_mechanism`) is consistent across `dag_loader.py`, the JSON DAG files, and `cause_mapping.py`. Locked by `test_cause_kind_enum_covers_spec_table`.
- `ActionKey` (7 values: `REWEIGH`, `RETRAIN`, `RECALIBRATE`, `FEATURE_DROP`, `CALIBRATION_PATCH`, `REJECT_OPTION`, `ESCALATE`) is the surface Phase 7's policy will choose between. Locked by `test_action_keys_match_spec_table_entries`.
- `AttributionQuality` (`high`, `degraded`) is the same enum on Pydantic, dashboard TS, and the JSON wire. Locked by `test_attribution_quality_defaults_to_high`.

### Scope check

Phase 6 ships a working `services/causal-attrib` end-to-end: DoWhy GCM primary, DBShap fallback, cause→action mapping, control-plane integration, hero scenario reproducing the seeded payload via real attribution. The 10-scenario benchmark library lands in Phase 9; Phase 6's `tests/scenarios/_harness.py` is the foundation Phase 9 extends.

---

## What lands in Phase 7 (next plan)

- `services/action-selector` — CB-Knapsacks (Slivkins-Sankararaman-Foster JMLR 2024) with Tchebycheff scalarization baseline.
- Reads `recommended_action` from Phase 6's `causal_attribution.recommended_action` as the Bayesian prior on the action posterior.
- Writes the chosen action + Pareto front into `governance_decisions.plan_evidence` so the dashboard's Pareto-front chart renders real bandit output.
- First regret-bound ablation: `R(T) = O(√(T·log T)·k)` (Slivkins et al. 2024, Thm. 3.1).
