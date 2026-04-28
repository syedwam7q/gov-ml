# Aegis — Phase 2: Control Plane + Audit Log + Tinybird · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `services/control-plane` FastAPI service — the **MAPE-K orchestrator** at the centre of Aegis. By the end of Phase 2 the control plane is the single writer of the Merkle-chained audit log, exposes the REST + SSE API the dashboard will consume in Phase 4, has a complete Postgres schema migrated by Alembic, and ships Tinybird datasource definitions for the metrics fast-path. All of this is testable against an ephemeral Neon branch in CI.

**Architecture.** The control plane is a `services/control-plane` Python package, a uv workspace member, deployed as a Vercel Functions Python app. It's the **only writer** of `audit_log` rows (per the design's "single writer, single chain" rule) and the only place where `governance_decisions.state` is advanced. Schema lives in Alembic migrations; Pydantic schemas live in `packages/shared-py/aegis_shared.schemas` (and are mirrored to TypeScript via the existing generator). Tinybird configuration lives under `infra/tinybird/` as `.datasource` / `.pipe` / `.endpoint` files using the official Tinybird CLI's text format.

**Tech Stack.** FastAPI, asyncpg, Alembic, SQLAlchemy 2.x async, sse-starlette, Pydantic v2, pytest-asyncio, httpx (test client), Tinybird CLI configuration files. No frontend code in this phase.

**Spec reference:** `docs/superpowers/specs/2026-04-28-aegis-design.md` (sections 4.3, 4.4, 5, 6, 7, 8.1, 13:Phase 2).

---

## File structure created in Phase 2

```
gov-ml/
├── services/control-plane/
│   ├── pyproject.toml                                  ← Task 1
│   ├── alembic.ini                                     ← Task 4
│   ├── src/aegis_control_plane/
│   │   ├── __init__.py                                 ← Task 1
│   │   ├── py.typed                                    ← Task 1
│   │   ├── config.py                                   ← Task 2
│   │   ├── app.py                                      ← Task 3
│   │   ├── db.py                                       ← Task 5
│   │   ├── models.py                                   ← Task 5  (SQLAlchemy ORM)
│   │   ├── audit.py                                    ← Task 6
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── health.py                               ← Task 3
│   │   │   ├── models.py                               ← Task 7
│   │   │   ├── policies.py                             ← Task 8
│   │   │   ├── audit.py                                ← Task 9
│   │   │   ├── decisions.py                            ← Task 10
│   │   │   └── stream.py                               ← Task 11  (SSE)
│   │   └── alembic/
│   │       ├── env.py                                  ← Task 4
│   │       └── versions/
│   │           ├── 0001_models_and_versions.py         ← Task 4
│   │           ├── 0002_governance_decisions.py        ← Task 4
│   │           ├── 0003_audit_log.py                   ← Task 4
│   │           ├── 0004_approvals.py                   ← Task 4
│   │           ├── 0005_policies.py                    ← Task 4
│   │           └── 0006_action_history.py              ← Task 4
│   └── tests/
│       ├── conftest.py                                 ← Task 5  (db fixture)
│       ├── test_health.py                              ← Task 3
│       ├── test_audit_writer.py                        ← Task 6
│       ├── test_models_router.py                       ← Task 7
│       ├── test_policies_router.py                     ← Task 8
│       ├── test_audit_router.py                        ← Task 9
│       ├── test_decisions_router.py                    ← Task 10
│       └── test_stream.py                              ← Task 11
├── packages/shared-py/src/aegis_shared/
│   └── schemas.py                                      ← Task 2  (expanded)
├── packages/shared-py/tests/
│   └── test_governance_schemas.py                      ← Task 2
├── infra/tinybird/
│   ├── README.md                                       ← Task 12
│   ├── datasources/
│   │   ├── predictions.datasource                      ← Task 12
│   │   ├── signals.datasource                          ← Task 12
│   │   └── subgroup_counters.datasource                ← Task 12
│   ├── pipes/
│   │   ├── drift_window.pipe                           ← Task 12
│   │   ├── fairness_window.pipe                        ← Task 12
│   │   └── prediction_volume.pipe                      ← Task 12
│   └── endpoints/
│       ├── drift_window.endpoint                       ← Task 12
│       └── fairness_window.endpoint                    ← Task 12
└── vercel.ts                                           ← Task 13  (extended)
```

---

## Tasks

### Task 1: `services/control-plane` workspace package + skeleton

**Files:**

- Create: `services/control-plane/pyproject.toml`
- Create: `services/control-plane/src/aegis_control_plane/__init__.py`
- Create: `services/control-plane/src/aegis_control_plane/py.typed`
- Create: `services/control-plane/tests/.gitkeep` (placeholder; real tests in later tasks)
- Modify: `pyproject.toml` (root) — add to workspace
- Delete: `services/control-plane/.gitkeep`

- [ ] **Step 1: Create `services/control-plane/pyproject.toml`**

```toml
[project]
name = "aegis-control-plane"
version = "0.1.0"
description = "MAPE-K orchestrator + sole audit-log writer for Aegis"
requires-python = ">=3.13"
dependencies = [
  "aegis-shared",
  "fastapi>=0.115.0",
  "asyncpg>=0.30.0",
  "sqlalchemy[asyncio]>=2.0.36",
  "alembic>=1.14.0",
  "sse-starlette>=2.2.0",
  "pydantic>=2.10.0",
  "pydantic-settings>=2.6.0",
  "uvicorn[standard]>=0.32.0",
  "python-multipart>=0.0.20",
]

[tool.uv.sources]
aegis-shared = { workspace = true }

[dependency-groups]
dev = [
  "httpx>=0.28.0",
  "pytest-asyncio>=0.24.0",
  "asgi-lifespan>=2.1.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/aegis_control_plane"]
```

- [ ] **Step 2: Create `__init__.py` and `py.typed`**

`services/control-plane/src/aegis_control_plane/__init__.py`:

```python
"""Aegis control plane — the MAPE-K orchestrator and sole audit-log writer."""

__version__ = "0.1.0"
```

`services/control-plane/src/aegis_control_plane/py.typed`: empty file.

- [ ] **Step 3: Add to root `pyproject.toml` workspace**

Edit `pyproject.toml`:

```toml
[tool.uv.workspace]
members = [
  "packages/shared-py",
  "ml-pipelines/_shared",
  "services/control-plane",
]
```

- [ ] **Step 4: Remove the `services/control-plane/.gitkeep`**

```bash
rm services/control-plane/.gitkeep
```

- [ ] **Step 5: Sync and verify import**

```bash
PATH=$HOME/.local/bin:$PATH uv sync --all-packages
PATH=$HOME/.local/bin:$PATH uv run python -c "import aegis_control_plane; print(aegis_control_plane.__version__)"
```

Expected: `0.1.0`.

- [ ] **Step 6: Commit**

```bash
git add services/control-plane/ pyproject.toml uv.lock
git rm services/control-plane/.gitkeep
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(control-plane): scaffold workspace package"
```

---

### Task 2: Expand `aegis_shared.schemas` with governance Pydantic models

**Files:**

- Modify: `packages/shared-py/src/aegis_shared/schemas.py`
- Create: `packages/shared-py/tests/test_governance_schemas.py`
- Modify: `packages/shared-py/src/aegis_shared/__init__.py` (re-exports)

The schemas in this task are the contract between every Aegis service and the dashboard. Once added, `packages/shared-ts` regeneration will produce TypeScript types automatically.

- [ ] **Step 1: Write the failing tests**

Create `packages/shared-py/tests/test_governance_schemas.py`:

```python
"""Tests for the governance Pydantic schemas."""

from datetime import UTC, datetime

import pytest

from aegis_shared.schemas import (
    DriftSignal,
    GovernanceDecision,
    Model,
    ModelVersion,
    Policy,
)
from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Severity


def _now() -> datetime:
    return datetime(2026, 4, 28, 12, 0, 0, tzinfo=UTC)


def test_model_minimal_fields() -> None:
    m = Model(
        id="credit-v1",
        name="Credit risk classifier",
        family=ModelFamily.TABULAR,
        risk_class=RiskClass.HIGH,
        active_version="0.1.0",
        owner_id="user_test",
        model_card_url="https://example.com/card.json",
        created_at=_now(),
    )
    assert m.id == "credit-v1"
    assert m.family == ModelFamily.TABULAR


def test_model_version_round_trip() -> None:
    v = ModelVersion(
        id="00000000-0000-0000-0000-000000000001",
        model_id="credit-v1",
        version="0.1.0",
        artifact_url="blob://models/credit/0.1.0/model.json",
        training_data_snapshot_url="blob://snapshots/hmda-2017-ca.parquet",
        qc_metrics={"accuracy": 0.872, "auroc": 0.91},
        status="active",
        created_at=_now(),
    )
    j = v.model_dump_json()
    v2 = ModelVersion.model_validate_json(j)
    assert v2 == v


def test_drift_signal_severity_typed() -> None:
    s = DriftSignal(
        model_id="credit-v1",
        metric="demographic_parity_gender",
        value=0.71,
        baseline=0.94,
        severity=Severity.HIGH,
        observed_at=_now(),
    )
    assert s.severity == Severity.HIGH


def test_governance_decision_lifecycle_states() -> None:
    d = GovernanceDecision(
        id="00000000-0000-0000-0000-000000000042",
        model_id="credit-v1",
        policy_id="00000000-0000-0000-0000-000000000099",
        state=DecisionState.DETECTED,
        severity=Severity.HIGH,
        drift_signal={"metric": "DP_gender", "value": 0.71},
        observation_window_secs=3600,
        opened_at=_now(),
    )
    assert d.state == DecisionState.DETECTED
    # Transitioning state via model_copy is the only sanctioned mutation
    d2 = d.model_copy(update={"state": DecisionState.ANALYZED})
    assert d2.state == DecisionState.ANALYZED
    assert d.state == DecisionState.DETECTED  # original is frozen


def test_policy_dsl_string_round_trip() -> None:
    p = Policy(
        id="00000000-0000-0000-0000-000000000099",
        model_id="credit-v1",
        version=7,
        active=True,
        mode="dry_run",
        dsl_yaml="name: credit-fairness\ntriggers: []",
        parsed_ast={"name": "credit-fairness", "triggers": []},
        created_at=_now(),
        created_by="user_test",
    )
    j = p.model_dump_json()
    p2 = Policy.model_validate_json(j)
    assert p2 == p


def test_governance_decision_rejects_invalid_window() -> None:
    with pytest.raises(ValueError, match="observation_window_secs"):
        GovernanceDecision(
            id="00000000-0000-0000-0000-000000000042",
            model_id="credit-v1",
            policy_id="00000000-0000-0000-0000-000000000099",
            state=DecisionState.DETECTED,
            severity=Severity.HIGH,
            drift_signal={},
            observation_window_secs=-1,
            opened_at=_now(),
        )
```

- [ ] **Step 2: Run, verify fail**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest packages/shared-py/tests/test_governance_schemas.py -v
```

Expected: ImportError on `Model`, `ModelVersion`, etc.

- [ ] **Step 3: Implement the schemas**

Replace `packages/shared-py/src/aegis_shared/schemas.py`:

```python
"""Pydantic schemas for Aegis events, decisions, signals, and audit records.

This module is the single source of truth for the cross-service contract.
`packages/shared-ts` is generated from the JSON Schema produced here, so
adding or changing a field requires one edit here and one regenerate of
shared-ts (CI fails if shared-ts is out of date).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Severity


class AegisModel(BaseModel):
    """Base for all Aegis Pydantic models. Forbids extra fields and freezes instances."""

    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)


# -- Models registry ---------------------------------------------------------


class Model(AegisModel):
    """A registered ML model under Aegis governance."""

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    family: ModelFamily
    risk_class: RiskClass
    active_version: str = Field(min_length=1)
    owner_id: str = Field(min_length=1)
    causal_dag: dict[str, Any] | None = None
    model_card_url: str = Field(min_length=1)
    datasheet_url: str | None = None
    created_at: datetime


class ModelVersion(AegisModel):
    """One registered version of a model."""

    id: str  # uuid
    model_id: str
    version: str = Field(min_length=1)
    artifact_url: str = Field(min_length=1)
    training_data_snapshot_url: str = Field(min_length=1)
    qc_metrics: dict[str, float]
    status: str = Field(pattern=r"^(staged|canary|active|retired)$")
    created_at: datetime


# -- Detection signals -------------------------------------------------------


class DriftSignal(AegisModel):
    """One emitted detection signal — the trigger for opening a GovernanceDecision."""

    model_id: str
    metric: str = Field(min_length=1)
    value: float
    baseline: float
    severity: Severity
    observed_at: datetime
    subgroup: dict[str, str] | None = None


# -- The central artifact ----------------------------------------------------


class GovernanceDecision(AegisModel):
    """A governance event walking the MAPE-K lifecycle.

    Mutating fields advance through state transitions. Each state transition
    is mirrored by a Merkle-chained row in `audit_log`.
    """

    id: str  # uuid
    model_id: str
    policy_id: str  # uuid
    state: DecisionState
    severity: Severity
    drift_signal: dict[str, Any]
    causal_attribution: dict[str, Any] | None = None
    plan_evidence: dict[str, Any] | None = None
    action_result: dict[str, Any] | None = None
    reward_vector: dict[str, float] | None = None
    observation_window_secs: int = Field(ge=1)
    opened_at: datetime
    evaluated_at: datetime | None = None

    @field_validator("observation_window_secs")
    @classmethod
    def _validate_window(cls, v: int) -> int:
        if v < 1:
            msg = "observation_window_secs must be ≥ 1"
            raise ValueError(msg)
        return v


# -- Policies ----------------------------------------------------------------


class Policy(AegisModel):
    """A versioned governance policy expressed in YAML DSL."""

    id: str  # uuid
    model_id: str
    version: int = Field(ge=1)
    active: bool
    mode: str = Field(pattern=r"^(live|dry_run|shadow)$")
    dsl_yaml: str = Field(min_length=1)
    parsed_ast: dict[str, Any]
    created_at: datetime
    created_by: str


# -- Approvals ---------------------------------------------------------------


class Approval(AegisModel):
    """An approval request gating a high-risk action."""

    id: str  # uuid
    decision_id: str
    required_role: str = Field(pattern=r"^(operator|admin)$")
    requested_at: datetime
    decided_at: datetime | None = None
    decided_by: str | None = None
    decision: str | None = Field(default=None, pattern=r"^(approved|denied|held)$")
    justification: str | None = None


__all__ = [
    "AegisModel",
    "Approval",
    "DriftSignal",
    "GovernanceDecision",
    "Model",
    "ModelVersion",
    "Policy",
]
```

- [ ] **Step 4: Re-export from `__init__.py`**

Update `packages/shared-py/src/aegis_shared/__init__.py`:

```python
"""Aegis shared schemas + audit-log primitives."""

from aegis_shared.audit import (
    GENESIS_PREV_HASH,
    AuditRow,
    canonicalize_payload,
    compute_row_hash,
    sign_row,
    verify_chain,
    verify_signature,
)
from aegis_shared.schemas import (
    AegisModel,
    Approval,
    DriftSignal,
    GovernanceDecision,
    Model,
    ModelVersion,
    Policy,
)
from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity

__all__ = [
    "GENESIS_PREV_HASH",
    "AegisModel",
    "Approval",
    "AuditRow",
    "DecisionState",
    "DriftSignal",
    "GovernanceDecision",
    "Model",
    "ModelFamily",
    "ModelVersion",
    "Policy",
    "RiskClass",
    "Role",
    "Severity",
    "canonicalize_payload",
    "compute_row_hash",
    "sign_row",
    "verify_chain",
    "verify_signature",
]
```

- [ ] **Step 5: Re-run tests, verify pass**

```bash
PATH=$HOME/.local/bin:$PATH uv sync --all-packages
PATH=$HOME/.local/bin:$PATH uv run pytest packages/shared-py/tests/test_governance_schemas.py -v
```

Expected: 6 tests PASS.

- [ ] **Step 6: Regenerate shared-ts to confirm contract is consistent**

```bash
pnpm --filter @aegis/shared-ts generate
pnpm --filter @aegis/shared-ts test
```

The generator currently exports `AuditRow` only; we'll add the governance schemas to the export list in Task 3 of Phase 4 when the dashboard needs them. For now the test should still pass.

- [ ] **Step 7: Verify ruff + pyright clean**

```bash
PATH=$HOME/.local/bin:$PATH uv run ruff check packages/shared-py
PATH=$HOME/.local/bin:$PATH uv run pyright packages/shared-py
```

- [ ] **Step 8: Commit**

```bash
git add packages/shared-py/
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(shared-py): add governance Pydantic schemas (Model, GovernanceDecision, Policy, ...)"
```

---

### Task 3: FastAPI app skeleton + `/healthz` + `/readyz`

**Files:**

- Create: `services/control-plane/src/aegis_control_plane/app.py`
- Create: `services/control-plane/src/aegis_control_plane/routers/__init__.py`
- Create: `services/control-plane/src/aegis_control_plane/routers/health.py`
- Create: `services/control-plane/tests/test_health.py`

The control-plane app is a vanilla FastAPI app with one health router and one readiness router. The readiness check verifies the database is reachable (Phase 5 will add Tinybird and HF Spaces dependency checks).

- [ ] **Step 1: Write failing tests**

Create `services/control-plane/tests/test_health.py`:

```python
"""Tests for /healthz and /readyz."""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_healthz_returns_ok() -> None:
    from aegis_control_plane.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body


@pytest.mark.asyncio
async def test_readyz_returns_ok_with_no_deps() -> None:
    from aegis_control_plane.app import build_app

    app = build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/readyz")
    # Without DB configured, readyz reports degraded — still 200 OK so the
    # liveness probe doesn't restart us. Each dep is reported by name.
    assert resp.status_code == 200
    body = resp.json()
    assert "deps" in body
    assert "database" in body["deps"]


@pytest.mark.asyncio
async def test_root_redirects_to_healthz() -> None:
    from aegis_control_plane.app import build_app

    app = build_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as ac:
        resp = await ac.get("/")
    assert resp.status_code in (200, 307, 308)
```

- [ ] **Step 2: Run, verify fail**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest services/control-plane/tests/test_health.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement the health router**

`services/control-plane/src/aegis_control_plane/routers/__init__.py`: empty file.

`services/control-plane/src/aegis_control_plane/routers/health.py`:

```python
"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from aegis_control_plane import __version__

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness probe: always returns 200 if the process is reachable."""
    return {"status": "ok", "version": __version__, "service": "control-plane"}


@router.get("/readyz")
async def readyz() -> dict[str, object]:
    """Readiness probe: reports each dependency's state.

    Phase 2 wires only the database; Phase 3+ adds Tinybird and HF Spaces.
    Returns 200 with `deps` even when degraded — degradation isn't a reason
    for a Kubernetes-style restart, just a signal to the dashboard.
    """
    return {
        "status": "ok",
        "deps": {
            "database": "not-configured",  # filled in Task 5
            "tinybird": "not-applicable-phase-2",
        },
    }
```

- [ ] **Step 4: Implement `app.py`**

`services/control-plane/src/aegis_control_plane/app.py`:

```python
"""FastAPI application factory for the control plane."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from aegis_control_plane import __version__
from aegis_control_plane.routers import health as health_router


def build_app() -> FastAPI:
    """Construct a fresh FastAPI app. Used in production and in tests."""
    app = FastAPI(
        title="Aegis Control Plane",
        version=__version__,
        description=(
            "MAPE-K orchestrator and sole audit-log writer for the Aegis ML "
            "governance platform."
        ),
    )

    app.include_router(health_router.router)

    @app.get("/", include_in_schema=False)
    async def _root() -> RedirectResponse:
        return RedirectResponse(url="/healthz")

    return app


app = build_app()
```

- [ ] **Step 5: Run tests, verify pass**

```bash
PATH=$HOME/.local/bin:$PATH uv sync --all-packages
PATH=$HOME/.local/bin:$PATH uv run pytest services/control-plane/tests/test_health.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 6: Boot the app locally to confirm**

```bash
PATH=$HOME/.local/bin:$PATH uv run uvicorn aegis_control_plane.app:app --port 8000 &
sleep 1
curl -sf http://localhost:8000/healthz | jq .
kill %1
```

Expected: `{"status": "ok", "version": "0.1.0", "service": "control-plane"}`.

- [ ] **Step 7: Add to pytest testpaths**

Edit root `pyproject.toml`:

```toml
testpaths = [
  "packages/shared-py/tests",
  "ml-pipelines/_shared/tests",
  "ml-pipelines/credit/tests",
  "ml-pipelines/readmission/tests",
  "ml-pipelines/toxicity/tests",
  "services/control-plane/tests",
  "services",
  "tests",
]
```

And to pyright include:

```toml
include = [
  "packages/shared-py/src",
  "ml-pipelines/_shared/src",
  "services/control-plane/src",
  "services",
]
```

- [ ] **Step 8: Commit**

```bash
git add services/control-plane/ pyproject.toml
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(control-plane): FastAPI app skeleton with /healthz and /readyz"
```

---

### Task 4: Postgres schema via Alembic migrations

**Files:**

- Create: `services/control-plane/alembic.ini`
- Create: `services/control-plane/src/aegis_control_plane/alembic/env.py`
- Create: `services/control-plane/src/aegis_control_plane/alembic/script.py.mako` (Alembic template)
- Create: `services/control-plane/src/aegis_control_plane/alembic/versions/0001_models_and_versions.py`
- Create: `services/control-plane/src/aegis_control_plane/alembic/versions/0002_governance_decisions.py`
- Create: `services/control-plane/src/aegis_control_plane/alembic/versions/0003_audit_log.py`
- Create: `services/control-plane/src/aegis_control_plane/alembic/versions/0004_approvals.py`
- Create: `services/control-plane/src/aegis_control_plane/alembic/versions/0005_policies.py`
- Create: `services/control-plane/src/aegis_control_plane/alembic/versions/0006_action_history.py`

The migration files mirror the spec's section 6.1 schema verbatim. Each migration is short and reversible. Audit log gets `RULE`s blocking UPDATE / DELETE.

- [ ] **Step 1: `alembic.ini`**

```ini
[alembic]
script_location = src/aegis_control_plane/alembic
prepend_sys_path = .

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 2: Alembic `env.py`**

`services/control-plane/src/aegis_control_plane/alembic/env.py`:

```python
"""Alembic environment — configured for our async SQLAlchemy engine."""

from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _get_url() -> str:
    return os.environ.get("DATABASE_URL", "postgresql+asyncpg://localhost/aegis_dev")


def run_migrations_offline() -> None:
    context.configure(
        url=_get_url(),
        target_metadata=None,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=None)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    config.set_main_option("sqlalchemy.url", _get_url())
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: `script.py.mako`**

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
${upgrades if upgrades else "    pass"}


def downgrade() -> None:
${downgrades if downgrades else "    pass"}
```

- [ ] **Step 4: Migration 0001 — models + versions**

`services/control-plane/src/aegis_control_plane/alembic/versions/0001_models_and_versions.py`:

```python
"""models + versions

Revision ID: 0001_models_and_versions
Revises:
Create Date: 2026-04-28 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_models_and_versions"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "models",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("family", sa.Text(), nullable=False),
        sa.Column("risk_class", sa.Text(), nullable=False),
        sa.Column("active_version", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Text(), nullable=False),
        sa.Column("causal_dag", sa.JSON()),
        sa.Column("model_card_url", sa.Text(), nullable=False),
        sa.Column("datasheet_url", sa.Text()),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "family IN ('tabular', 'text')", name="models_family_check"
        ),
        sa.CheckConstraint(
            "risk_class IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="models_risk_class_check",
        ),
    )
    op.create_table(
        "model_versions",
        sa.Column(
            "id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True
        ),
        sa.Column("model_id", sa.Text(), sa.ForeignKey("models.id"), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("artifact_url", sa.Text(), nullable=False),
        sa.Column("training_data_snapshot_url", sa.Text(), nullable=False),
        sa.Column("qc_metrics", sa.JSON(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("model_id", "version", name="model_versions_model_version_key"),
        sa.CheckConstraint(
            "status IN ('staged', 'canary', 'active', 'retired')",
            name="model_versions_status_check",
        ),
    )


def downgrade() -> None:
    op.drop_table("model_versions")
    op.drop_table("models")
```

- [ ] **Step 5: Migration 0002 — governance_decisions**

`services/control-plane/src/aegis_control_plane/alembic/versions/0002_governance_decisions.py`:

```python
"""governance_decisions

Revision ID: 0002_governance_decisions
Revises: 0001_models_and_versions
Create Date: 2026-04-28 12:01:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_governance_decisions"
down_revision: str | None = "0001_models_and_versions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "governance_decisions",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("model_id", sa.Text(), sa.ForeignKey("models.id"), nullable=False),
        sa.Column(
            "policy_id",
            sa.dialects.postgresql.UUID(as_uuid=False),
            nullable=False,
        ),
        sa.Column("state", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("drift_signal", sa.JSON(), nullable=False),
        sa.Column("causal_attribution", sa.JSON()),
        sa.Column("plan_evidence", sa.JSON()),
        sa.Column("action_result", sa.JSON()),
        sa.Column("reward_vector", sa.JSON()),
        sa.Column("observation_window_secs", sa.Integer(), nullable=False),
        sa.Column(
            "opened_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("evaluated_at", sa.TIMESTAMP(timezone=True)),
        sa.CheckConstraint(
            "state IN ('detected', 'analyzed', 'planned', 'awaiting_approval', 'executing', 'evaluated')",
            name="decisions_state_check",
        ),
        sa.CheckConstraint(
            "severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="decisions_severity_check",
        ),
        sa.CheckConstraint(
            "observation_window_secs >= 1", name="decisions_window_check"
        ),
    )
    op.create_index("decisions_model_state_idx", "governance_decisions", ["model_id", "state"])


def downgrade() -> None:
    op.drop_index("decisions_model_state_idx", table_name="governance_decisions")
    op.drop_table("governance_decisions")
```

- [ ] **Step 6: Migration 0003 — audit_log (with append-only RULEs)**

`services/control-plane/src/aegis_control_plane/alembic/versions/0003_audit_log.py`:

```python
"""audit_log + append-only RULEs

Revision ID: 0003_audit_log
Revises: 0002_governance_decisions
Create Date: 2026-04-28 12:02:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_audit_log"
down_revision: str | None = "0002_governance_decisions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column("sequence_n", sa.BigInteger(), primary_key=True),
        sa.Column(
            "decision_id",
            sa.dialects.postgresql.UUID(as_uuid=False),
            sa.ForeignKey("governance_decisions.id"),
        ),
        sa.Column(
            "ts",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("actor", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("prev_hash", sa.Text(), nullable=False),
        sa.Column("row_hash", sa.Text(), nullable=False),
        sa.Column("signature", sa.Text(), nullable=False),
    )
    op.execute(
        "CREATE SEQUENCE IF NOT EXISTS audit_log_sequence_n_seq OWNED BY audit_log.sequence_n"
    )
    op.execute(
        "ALTER TABLE audit_log ALTER COLUMN sequence_n "
        "SET DEFAULT nextval('audit_log_sequence_n_seq')"
    )
    # The append-only invariant: no UPDATE, no DELETE on audit_log, ever.
    op.execute("CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING")
    op.execute("CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING")
    op.create_index("audit_log_decision_id_idx", "audit_log", ["decision_id"])
    op.create_index("audit_log_ts_idx", "audit_log", ["ts"])


def downgrade() -> None:
    # Best-effort downgrade — the RULEs prevent normal removal so we drop the
    # table directly and let CASCADE handle things.
    op.execute("DROP RULE IF EXISTS audit_log_no_update ON audit_log")
    op.execute("DROP RULE IF EXISTS audit_log_no_delete ON audit_log")
    op.drop_index("audit_log_ts_idx", table_name="audit_log")
    op.drop_index("audit_log_decision_id_idx", table_name="audit_log")
    op.drop_table("audit_log")
    op.execute("DROP SEQUENCE IF EXISTS audit_log_sequence_n_seq")
```

- [ ] **Step 7: Migrations 0004, 0005, 0006 — approvals, policies, action_history**

`0004_approvals.py`:

```python
"""approvals

Revision ID: 0004_approvals
Revises: 0003_audit_log
Create Date: 2026-04-28 12:03:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_approvals"
down_revision: str | None = "0003_audit_log"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "approvals",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "decision_id",
            sa.dialects.postgresql.UUID(as_uuid=False),
            sa.ForeignKey("governance_decisions.id"),
            nullable=False,
        ),
        sa.Column("required_role", sa.Text(), nullable=False),
        sa.Column(
            "requested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("decided_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("decided_by", sa.Text()),
        sa.Column("decision", sa.Text()),
        sa.Column("justification", sa.Text()),
        sa.CheckConstraint(
            "required_role IN ('operator', 'admin')", name="approvals_role_check"
        ),
        sa.CheckConstraint(
            "decision IS NULL OR decision IN ('approved', 'denied', 'held')",
            name="approvals_decision_check",
        ),
    )


def downgrade() -> None:
    op.drop_table("approvals")
```

`0005_policies.py`:

```python
"""policies

Revision ID: 0005_policies
Revises: 0004_approvals
Create Date: 2026-04-28 12:04:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_policies"
down_revision: str | None = "0004_approvals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "policies",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("model_id", sa.Text(), sa.ForeignKey("models.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "mode",
            sa.Text(),
            nullable=False,
            server_default="dry_run",
        ),
        sa.Column("dsl_yaml", sa.Text(), nullable=False),
        sa.Column("parsed_ast", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.UniqueConstraint("model_id", "version", name="policies_model_version_key"),
        sa.CheckConstraint(
            "mode IN ('live', 'dry_run', 'shadow')", name="policies_mode_check"
        ),
    )


def downgrade() -> None:
    op.drop_table("policies")
```

`0006_action_history.py`:

```python
"""action_history

Revision ID: 0006_action_history
Revises: 0005_policies
Create Date: 2026-04-28 12:05:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_action_history"
down_revision: str | None = "0005_policies"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "action_history",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "decision_id",
            sa.dialects.postgresql.UUID(as_uuid=False),
            sa.ForeignKey("governance_decisions.id"),
            nullable=False,
        ),
        sa.Column("model_id", sa.Text(), nullable=False),
        sa.Column("context", sa.JSON(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("reward", sa.JSON()),
        sa.Column("observed_at", sa.TIMESTAMP(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("action_history")
```

- [ ] **Step 8: Verify Alembic config is wired**

```bash
cd services/control-plane
PATH=$HOME/.local/bin:$PATH uv run alembic check  # validates migrations are consistent
PATH=$HOME/.local/bin:$PATH uv run alembic --offline upgrade head  # dry-run
```

Expected: both succeed.

- [ ] **Step 9: Commit**

```bash
git add services/control-plane/
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(control-plane): Alembic migrations 0001–0006 (full Postgres schema)"
```

---

### Tasks 5–13

These tasks build on the foundation above. Each follows the same TDD shape (write failing test → run → implement → run → commit) used in Phases 0 and 1.

| #   | Task                                                                            | Highlights                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | DB engine factory + ORM models + ephemeral test DB fixture                      | `db.py` async-engine factory; `models.py` SQLAlchemy ORM mirroring the migrations; `conftest.py` provides an ephemeral Neon branch (or local Postgres) per test session and runs `alembic upgrade head` against it.                                                                            |
| 6   | Audit-log writer service                                                        | `audit.py` — the _single_ function that appends a row to `audit_log`, sourced from `aegis_shared.audit` for hash construction. CI test: write 100 rows then assert `verify_chain(rows, secret)` returns True.                                                                                  |
| 7   | `routers/models.py` — REST CRUD on `Model` + `ModelVersion`                     | `GET /api/v1/models`, `GET /api/v1/models/{id}`, `POST /api/v1/models`, `POST /api/v1/models/{id}/versions`. Pydantic `Model` + `ModelVersion` for I/O. Tests exercise round-trips against the test DB.                                                                                        |
| 8   | `routers/policies.py` — REST CRUD on `Policy` (DSL + `dry_run`/`live`/`shadow`) | DSL is YAML; parsed at write time into `parsed_ast`. New / changed policies start in `dry_run` per the design. CI test: changing a `live` policy without a `dry_run` history fails the API call.                                                                                               |
| 9   | `routers/audit.py` — read-only audit-log API + `verify_chain` endpoint          | `GET /api/v1/audit?since_seq={n}&limit={k}` paginates. `POST /api/v1/audit/verify` runs `verify_chain` over the live rows server-side and returns the result.                                                                                                                                  |
| 10  | `routers/decisions.py` — REST + state-transition endpoints                      | `GET /api/v1/decisions/{id}` returns the full lifecycle. `POST /api/v1/decisions/{id}/transition` advances state (every transition writes an audit row via the writer from Task 6). Tests: invalid state transition returns 409.                                                               |
| 11  | `routers/stream.py` — SSE broadcast                                             | One internal `asyncio.Queue` per connection; `POST /api/v1/internal/broadcast` (HMAC-protected) fans events out. Tests use `httpx`-streaming to verify a sent event arrives at a connected client.                                                                                             |
| 12  | `infra/tinybird/` — datasource + pipe + endpoint definitions                    | Three datasources (`predictions`, `signals`, `subgroup_counters`), three pipes (`drift_window`, `fairness_window`, `prediction_volume`), two endpoints exposing windowed aggregates as REST. README documents the `tb push` flow (run once, no real data yet).                                 |
| 13  | `vercel.ts` extension + setup.md updates                                        | Add the control-plane to `vercel.ts` `crons` (every 5 min — Phase 3 actually wires the cron handler) and add a route binding `services/control-plane → /api/cp/*` rewrite. Setup.md gains a "Control plane" section: how to run locally, how to run migrations, how to point at a Neon branch. |

For each task, the per-step structure is identical to Tasks 1-4 above: write failing test, run pytest to confirm fail, implement, re-run tests, commit. **Every task in this plan ends in a commit. Every commit passes `pnpm format:check`, `pnpm lint`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pyright`, and `uv run pytest --ignore=ml-pipelines/toxicity` (the pre-push hook discipline).**

---

## Self-review

**Spec coverage:**

| Spec §                  | Requirement                                                | Task                                       |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| 4.3 (control-plane row) | Routes, service contract                                   | 3, 7, 8, 9, 10, 11                         |
| 4.4                     | Schema-is-law (shared-py → shared-ts), single audit writer | 2, 6                                       |
| 5                       | GovernanceDecision lifecycle, 5 states                     | 2, 4, 10                                   |
| 6.1                     | Postgres schema                                            | 4                                          |
| 6.2                     | Merkle audit log invariants (chain, HMAC, append-only)     | 4, 6, 9                                    |
| 6.3                     | Policy DSL parsed/validated at write time                  | 8                                          |
| 7.4                     | Rate limits / cooldowns                                    | partially in 8 (defaults), full in Phase 7 |
| 8.1                     | CI tier (integration tests against ephemeral Neon)         | 5 (test DB fixture), 6, 7, 8, 9, 10, 11    |
| 13:Phase 2              | "Control plane + Postgres + audit log + Tinybird"          | 1–13                                       |

**Placeholder scan:** No `TBD`/`TODO`/`fill in details`. Tasks 5–13 are summarized but every task name is concrete and every "Highlights" line is actionable (no "etc." or "and so on").

**Type consistency:** `Model`, `ModelVersion`, `GovernanceDecision`, `Policy`, `Approval`, `DriftSignal` defined in Task 2 are referenced in Tasks 7, 8, 9, 10, and (via `audit.py`) Task 6. The Pydantic schemas are the single source of truth.

**Scope check:** Phase 2 produces a working, testable artifact: a control-plane service with green CI, full schema migrated, audit-log writer + REST + SSE all integration-tested against an ephemeral DB. No detection / orchestration logic yet — that's Phase 3+.

---

## What lands in Phase 3 (next plan)

- `services/detect-tabular` (Evidently + NannyML CBPE).
- `services/detect-text` (Alibi-Detect MMD on `all-MiniLM-L6-v2` embeddings).
- A scheduled Vercel Cron that calls each detector and posts severity events to the control plane.
- First end-to-end Detect→Decision lifecycle: cron fires → detector runs → severity event → control-plane creates `GovernanceDecision` in `state=detected` → audit row written. _No remediation yet_.
