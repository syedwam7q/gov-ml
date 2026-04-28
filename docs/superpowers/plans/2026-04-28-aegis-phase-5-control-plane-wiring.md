# Aegis — Phase 5: Control Plane → Dashboard Wiring · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** Flip the dashboard from its seeded mock dataset to the live Phase 2 control plane and Phase 3 detection signals, with zero visible regressions in the Editorial Dark UI. By the end of Phase 5 every page that currently renders mock data renders live data; the SSE activity feed streams real state-transition events; the approval card writes a real `POST /decisions/{id}/transition` (audit-chained); the chain-verify button calls the real Merkle verifier; KPIs and sparklines come from Tinybird pipes; and the Apple-Card-2019 hero scenario is **seeded into the live database on first run** so the demo always walks end-to-end against real infrastructure.

**Architecture.** Three structural moves:

1. **Schema as law.** Regenerate `@aegis/shared-ts` from the canonical Pydantic models in `packages/shared-py` (every wire-format type — model, decision, audit row, drift signal, action, severity, state). The dashboard's hand-rolled `app/_lib/types.ts` collapses into a thin re-export. Any backend schema change now fails the dashboard `tsc` step automatically.
2. **One public path prefix.** All browser → control-plane traffic goes through `/api/cp/*` (single Vercel rewrite), and the control plane mounts every route under `/api/cp/*` natively (no router-prefix surgery on each request, no overlapping prefixes). The dashboard's `app/_lib/api.ts` becomes a thin typed-fetch wrapper with **no mock branch** — mock data moves to a dedicated fixture file that only Storybook stories and Vitest tests import.
3. **Reachability auto-detect over env flag.** A short-circuit health probe at first render decides between live and a friendly "control plane unreachable" state — no `useMock` boolean, no two parallel render paths in production code.

**Tech Stack.** FastAPI + sse-starlette + Tinybird + asyncpg (control plane); Next.js 16 App Router + SWR + native `EventSource` + `@aegis/shared-ts` (dashboard); `datamodel-code-generator` 0.26+ for Pydantic→JSON Schema→TypeScript codegen; Tinybird CLI for pipe deployment; Playwright for visual regression on the wired dashboard.

**Spec reference.** `docs/superpowers/specs/2026-04-28-aegis-design.md` — §4.2 (deployment topology), §4.3 (per-service contracts), §4.4.2 ("schema is law"), §5 (decision lifecycle), §6.1 (Postgres schema), §6.2 (audit invariants), §10.1 (page inventory), §10.2 (persistent UI), §10.4 (component library).

**Why this phase, why now.** Phases 0–4 left us with a beautiful but disconnected stack: control plane is healthy, audit chain is provable, detection services emit real signals — but the dashboard reads `MOCK.kpis`. Phase 5 closes the contract. After Phase 5, the research-extension phases (Phase 6 causal attribution, Phase 7 Pareto policy) write into the same `GovernanceDecision` rows the dashboard already renders — they have somewhere to land. Without Phase 5 they don't.

---

## File structure created or modified in Phase 5

```
gov-ml/
├── packages/
│   ├── shared-py/src/aegis_shared/
│   │   └── schemas.py                                    # MODIFY — add: GovernanceDecision, Approval,
│   │                                                     #          CandidateAction, ModelKPI, ActivityEvent,
│   │                                                     #          KPIPoint, ChainVerificationResult,
│   │                                                     #          AuditPage  (export every wire type)
│   └── shared-ts/
│       ├── scripts/
│       │   └── generate.ts                               # MODIFY — export every schema, not just AuditRow
│       ├── src/
│       │   └── index.ts                                  # AUTO-REGEN — new exports flow through
│       └── tests/
│           └── generate.test.ts                          # CREATE — locks the exported names
├── apps/dashboard/
│   ├── next.config.mjs                                   # MODIFY — dev rewrite /api/cp/* → localhost:8000
│   ├── app/
│   │   ├── _lib/
│   │   │   ├── types.ts                                  # MODIFY — collapse to re-exports of @aegis/shared-ts
│   │   │   ├── api.ts                                    # MODIFY — drop mock branch, single fetch path
│   │   │   ├── api.fixtures.ts                          # CREATE — the old MOCK dataset; test/storybook only
│   │   │   ├── reachability.ts                          # CREATE — control-plane probe (server component)
│   │   │   ├── stream.ts                                 # CREATE — typed EventSource hook
│   │   │   ├── hooks.ts                                  # MODIFY — useActivityStream replaces useActivity poll
│   │   │   └── mock-data.ts                              # DELETE  (moved to api.fixtures.ts)
│   │   ├── (app)/
│   │   │   ├── _components/
│   │   │   │   └── unreachable-banner.tsx                # CREATE — friendly degraded mode banner
│   │   │   ├── approvals/_view.tsx                       # MODIFY — real onApprove / onDeny
│   │   │   ├── audit/_view.tsx                           # MODIFY — real verify + CSV export
│   │   │   ├── fleet/page.tsx                            # MODIFY — drop polling note, subscribe SSE
│   │   │   ├── incidents/page.tsx                        # MODIFY — drop "Phase 5" comment, drop fallback
│   │   │   ├── settings/_view.tsx                        # MODIFY — emergency-stop wires real POST
│   │   │   └── datasets/_view.tsx                        # MODIFY — drop "Phase 5" placeholder copy
│   │   └── api/
│   │       └── reachability/route.ts                     # CREATE — server-side probe (Edge-incompatible
│   │                                                     #          intentionally; lives on Node runtime)
│   └── tests/
│       └── e2e/
│           └── live-stack.spec.ts                        # CREATE — Playwright walks hero scenario on live
├── services/control-plane/
│   ├── src/aegis_control_plane/
│   │   ├── app.py                                        # MODIFY — mount routers under /api/cp prefix
│   │   ├── config.py                                     # MODIFY — TINYBIRD_TOKEN + KPI window settings
│   │   ├── tinybird.py                                   # CREATE — control-plane-side query helpers
│   │   ├── seed.py                                       # CREATE — Apple-Card-2019 hero seeder
│   │   └── routers/
│   │       ├── activity.py                               # CREATE — /api/cp/activity (paginated)
│   │       ├── compliance.py                             # CREATE — /api/cp/compliance
│   │       ├── csv_export.py                             # CREATE — /api/cp/audit/export.csv
│   │       ├── datasets.py                               # CREATE — /api/cp/datasets
│   │       ├── fleet.py                                  # CREATE — /api/cp/fleet/kpi (Tinybird-backed)
│   │       ├── kpi.py                                    # CREATE — /api/cp/models/{id}/kpi (Tinybird)
│   │       ├── reachability.py                           # CREATE — /api/cp/reachability (no DB hit)
│   │       ├── audit.py                                  # MODIFY — /api/cp prefix; add /export.csv link
│   │       ├── decisions.py                              # MODIFY — /api/cp prefix; transition broadcasts SSE
│   │       ├── models.py                                 # MODIFY — /api/cp prefix
│   │       ├── policies.py                               # MODIFY — /api/cp prefix
│   │       ├── signals.py                                # MODIFY — /api/cp prefix; broadcast on decision_open
│   │       ├── stream.py                                 # MODIFY — /api/cp prefix; type registry
│   │       └── cron.py                                   # MODIFY — /api/cp prefix; idempotent seeder hook
│   └── tests/
│       ├── test_routing_prefix.py                        # CREATE — every router under /api/cp
│       ├── test_fleet_router.py                          # CREATE
│       ├── test_kpi_router.py                            # CREATE
│       ├── test_activity_router.py                       # CREATE
│       ├── test_csv_export.py                            # CREATE
│       ├── test_datasets_router.py                       # CREATE
│       ├── test_compliance_router.py                     # CREATE
│       ├── test_reachability.py                          # CREATE
│       ├── test_decision_transition_broadcast.py         # CREATE
│       ├── test_seed.py                                  # CREATE — idempotent hero seeder
│       └── test_audit_export.py                          # CREATE
├── infra/tinybird/pipes/
│   ├── fleet_kpi.pipe                                    # CREATE — fleet-wide acc / fairness / latency / volume
│   ├── model_kpi.pipe                                    # CREATE — per-model rollup
│   └── kpi_sparkline.pipe                                # CREATE — last 24h sparkline points
├── infra/tinybird/endpoints/
│   ├── fleet_kpi.endpoint                                # CREATE
│   ├── model_kpi.endpoint                                # CREATE
│   └── kpi_sparkline.endpoint                            # CREATE
├── vercel.ts                                             # MODIFY — rewrite /api/cp/* with full proxy
└── setup.md                                              # MODIFY — Phase 5 section
```

---

## Phase 5 sub-phases

Each sub-phase ends in working, testable software and a clean commit. Do not skip ahead — the dashboard goes from "polished prototype" to "working system" only when every layer below is correct.

| Sub-phase | Title                             | What ships                                                                                             |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 5a        | Schema sync (`@aegis/shared-ts`)  | Every wire type auto-derived from Pydantic; dashboard `_lib/types.ts` collapses                        |
| 5b        | Routing alignment                 | One public prefix `/api/cp/*`; vercel.ts + control-plane router prefixes match                         |
| 5c        | Read endpoints + dashboard wiring | `/fleet/kpi`, `/models/{id}/kpi`, `/decisions`, `/audit`, `/activity`, `/datasets`, `/compliance` live |
| 5d        | Live SSE activity feed            | EventSource replaces poll; control plane broadcasts on every state transition                          |
| 5e        | Tinybird KPI pipes                | Real fleet + per-model + sparkline pipes; control-plane fetches via `tinybird.py`                      |
| 5f        | Approval write path               | `onApprove` / `onDeny` write transitions; SSE broadcasts; audit chain extends                          |
| 5g        | Audit verify + CSV export         | Verify button calls real chain check; CSV export streams full chain                                    |
| 5h        | Reachability auto-detect          | `useMock` flag deleted; degraded-mode banner replaces silent fallback                                  |
| 5i        | Hero scenario seeder              | `services/control-plane/src/aegis_control_plane/seed.py` lands Apple-Card-2019 idempotently            |
| 5j        | E2E + Playwright + setup.md + tag | Live stack walks the hero scenario end-to-end; phase tagged                                            |

---

## Sub-phase 5a — Schema sync

**Goal:** Every wire type the dashboard reads or writes flows from `packages/shared-py` Pydantic models through `datamodel-code-generator` into `packages/shared-ts/src/index.ts`. The dashboard re-exports those types and deletes its hand-rolled equivalents.

### Task 1: Lock the canonical schema set in `shared-py`

**Files:**

- Modify: `packages/shared-py/src/aegis_shared/schemas.py`
- Test: `packages/shared-py/tests/test_schemas_complete.py`

- [ ] **Step 1: Write the failing test** — assert every wire type the dashboard needs is present and exportable from `aegis_shared.schemas`.

```python
# packages/shared-py/tests/test_schemas_complete.py
"""Lock the wire-type surface so the JSON-Schema codegen never silently drops a model."""

from __future__ import annotations

import importlib

REQUIRED = (
    "Model",
    "ModelVersion",
    "GovernanceDecision",
    "Approval",
    "DriftSignal",
    "Policy",
    "CandidateAction",
    "CausalAttribution",
    "ModelKPI",
    "KPIPoint",
    "ActivityEvent",
    "AuditRow",
    "AuditPage",
    "ChainVerificationResult",
    "Dataset",
    "ComplianceMapping",
)


def test_every_required_schema_is_exported() -> None:
    mod = importlib.import_module("aegis_shared.schemas")
    missing = [name for name in REQUIRED if not hasattr(mod, name)]
    assert not missing, f"missing wire types: {missing}"
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `uv run --package aegis-shared pytest packages/shared-py/tests/test_schemas_complete.py -v`
Expected: FAIL listing the symbols that don't exist yet (most of `ModelKPI`, `KPIPoint`, `ActivityEvent`, `AuditPage`, `ChainVerificationResult`, `Dataset`, `ComplianceMapping`, `CandidateAction`).

- [ ] **Step 3: Implement the missing Pydantic models in `schemas.py`**

Append the following blocks (each strictly typed; `extra="forbid"`; ISO-8601 timestamps as `datetime` with `aware=True`):

```python
# packages/shared-py/src/aegis_shared/schemas.py  (append)

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity


class CandidateAction(BaseModel):
    """One option in the Pareto front returned by action-selector."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    kind: str  # 'reweigh' | 'recalibrate' | 'retrain' | 'swap' | 'hold' | 'rollback'
    risk_class: RiskClass
    rationale: str
    selected: bool = False
    expected_reward: dict[str, float] | None = None  # {acc, fairness, latency, cost}


class ModelKPI(BaseModel):
    """Hot-window KPI rollup per model."""

    model_config = ConfigDict(extra="forbid")

    model_id: str
    window: str  # '24h' | '7d' | '30d'
    accuracy: float
    fairness: float
    p95_latency_ms: float
    prediction_volume: int
    sparkline: list["KPIPoint"]


class KPIPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ts: datetime
    accuracy: float
    fairness: float


ModelKPI.model_rebuild()


class ActivityEvent(BaseModel):
    """One event in the activity feed (also broadcast over SSE)."""

    model_config = ConfigDict(extra="forbid")

    id: str
    ts: datetime
    type: str  # 'decision_open' | 'state_transition' | 'approval_decided' | 'metrics_degraded'
    severity: Severity
    actor: str
    title: str
    summary: str
    decision_id: str | None = None
    model_id: str | None = None


class AuditPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rows: list["AuditRow"]
    next_since_seq: int | None
    total: int


class ChainVerificationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    valid: bool
    rows_checked: int
    head_row_hash: str | None
    first_failed_sequence: int | None = None


class Dataset(BaseModel):
    """Datasheet-card surface for `/datasets`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: str
    name: str
    family: ModelFamily
    rows: int
    feature_count: int
    snapshot_url: str
    datasheet_url: str
    license: str
    citation: str
    last_drift_psi: float | None = None
    attached_models: list[str] = Field(default_factory=list)


class ComplianceMapping(BaseModel):
    """One regulatory anchor mapped to a dashboard panel."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    framework: str  # 'EU AI Act' | 'NIST AI RMF' | 'ISO 42001' | ...
    article: str
    requirement: str
    panel_route: str
    panel_evidence: str
```

`AuditRow` already lives in `aegis_shared.audit`; import-or-redefine it inside `schemas.py` so every wire type lands in one module:

```python
# packages/shared-py/src/aegis_shared/schemas.py  (top of file, before models that reference it)
from aegis_shared.audit import AuditRow  # re-export for codegen surface

__all__ = [
    "Model",
    "ModelVersion",
    "GovernanceDecision",
    "Approval",
    "DriftSignal",
    "Policy",
    "CandidateAction",
    "CausalAttribution",
    "ModelKPI",
    "KPIPoint",
    "ActivityEvent",
    "AuditRow",
    "AuditPage",
    "ChainVerificationResult",
    "Dataset",
    "ComplianceMapping",
]
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `uv run --package aegis-shared pytest packages/shared-py/tests/test_schemas_complete.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-py/src/aegis_shared/schemas.py \
        packages/shared-py/tests/test_schemas_complete.py
git commit -m "feat(shared-py): Phase 5 — full wire-type surface (KPI / Activity / Audit / Dataset / Compliance)"
```

### Task 2: Wire `@aegis/shared-ts` codegen to the full surface

**Files:**

- Modify: `packages/shared-ts/scripts/generate.ts`
- Modify: `packages/shared-ts/package.json` — add `datamodel-code-generator` invocation note
- Test: `packages/shared-ts/tests/generate.test.ts`

- [ ] **Step 1: Write the failing test** — verifies every name from the lock list appears in the generated output.

```typescript
// packages/shared-ts/tests/generate.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const SOURCE = readFileSync(resolve(__dirname, "..", "src", "index.ts"), "utf8");

const REQUIRED = [
  "Model",
  "ModelVersion",
  "GovernanceDecision",
  "Approval",
  "DriftSignal",
  "Policy",
  "CandidateAction",
  "CausalAttribution",
  "ModelKPI",
  "KPIPoint",
  "ActivityEvent",
  "AuditRow",
  "AuditPage",
  "ChainVerificationResult",
  "Dataset",
  "ComplianceMapping",
] as const;

describe("@aegis/shared-ts codegen", () => {
  for (const name of REQUIRED) {
    test(`exports ${name}`, () => {
      const interfaceMatch = new RegExp(`export\\s+(?:interface|type)\\s+${name}\\b`);
      expect(SOURCE).toMatch(interfaceMatch);
    });
  }

  test("declares the auto-generated banner", () => {
    expect(SOURCE).toMatch(/AUTO-GENERATED FILE — do not edit\./);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @aegis/shared-ts test`
Expected: FAIL — most names missing.

- [ ] **Step 3: Replace `scripts/generate.ts` to export every schema**

```typescript
// packages/shared-ts/scripts/generate.ts
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(PKG_DIR, "..", "..");
const OUT = resolve(PKG_DIR, "src", "index.ts");

const PY_EXPORT = `
import json
from aegis_shared import schemas as s
from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity

models = [
    s.Model, s.ModelVersion, s.GovernanceDecision, s.Approval, s.DriftSignal,
    s.Policy, s.CandidateAction, s.CausalAttribution, s.ModelKPI, s.KPIPoint,
    s.ActivityEvent, s.AuditRow, s.AuditPage, s.ChainVerificationResult,
    s.Dataset, s.ComplianceMapping,
]
out = {m.__name__: m.model_json_schema() for m in models}
out["DecisionState"] = {"title": "DecisionState", "type": "string", "enum": [v.value for v in DecisionState]}
out["ModelFamily"]   = {"title": "ModelFamily",   "type": "string", "enum": [v.value for v in ModelFamily]}
out["RiskClass"]     = {"title": "RiskClass",     "type": "string", "enum": [v.value for v in RiskClass]}
out["Role"]          = {"title": "Role",          "type": "string", "enum": [v.value for v in Role]}
out["Severity"]      = {"title": "Severity",      "type": "string", "enum": [v.value for v in Severity]}
print(json.dumps(out))
`;

function exportSchemas(): Record<string, unknown> {
  const out = execFileSync("uv", ["run", "python", "-c", PY_EXPORT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return JSON.parse(out) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const schemas = exportSchemas();
  const banner =
    "/* eslint-disable */\n" +
    "// AUTO-GENERATED FILE — do not edit.\n" +
    "// Source of truth: packages/shared-py/src/aegis_shared/\n" +
    "// Regenerate with: pnpm --filter @aegis/shared-ts generate\n";

  let out = banner + "\n";
  for (const [name, schema] of Object.entries(schemas)) {
    const ts = await compile(schema as Parameters<typeof compile>[0], name, {
      bannerComment: "",
      style: { semi: true, singleQuote: false, printWidth: 100 },
      additionalProperties: false,
    });
    out += ts + "\n";
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out, "utf8");
  console.log(`wrote ${OUT}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Regenerate and re-run the test**

Run: `pnpm --filter @aegis/shared-ts generate && pnpm --filter @aegis/shared-ts test`
Expected: PASS — every required name found, banner present.

- [ ] **Step 5: Wire CI to fail on stale codegen**

Add a `pnpm --filter @aegis/shared-ts generate` step to the existing GitHub Actions workflow before `pnpm typecheck`, then `git diff --exit-code packages/shared-ts/src` so a forgotten regeneration breaks the build.

```yaml
# .github/workflows/ci.yml  (insert into the typescript job, before tsc)
- name: Regenerate @aegis/shared-ts
  run: pnpm --filter @aegis/shared-ts generate
- name: Fail if generated types are stale
  run: git diff --exit-code packages/shared-ts/src
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared-ts/scripts/generate.ts \
        packages/shared-ts/src/index.ts \
        packages/shared-ts/tests/generate.test.ts \
        .github/workflows/ci.yml
git commit -m "feat(shared-ts): Phase 5 — full schema codegen + CI staleness gate"
```

### Task 3: Collapse the dashboard's hand-rolled types into re-exports

**Files:**

- Modify: `apps/dashboard/app/_lib/types.ts`
- Modify: any dashboard module importing from `_lib/types.ts` (no rename — module surface preserved)

- [ ] **Step 1: Replace `_lib/types.ts` with a re-export module**

```typescript
// apps/dashboard/app/_lib/types.ts
/**
 * The dashboard's wire-type surface.
 *
 * Every type below is generated from `packages/shared-py` Pydantic models
 * by `pnpm --filter @aegis/shared-ts generate`. Keep this file structural —
 * any dashboard-only enrichment (e.g., `domain` / `description` for the
 * `AegisModel` UI card) lives below the re-export block, narrowly typed.
 */

export type {
  ActivityEvent,
  Approval as ApprovalRecord,
  AuditPage,
  AuditRow,
  CandidateAction,
  CausalAttribution,
  ChainVerificationResult,
  ComplianceMapping,
  Dataset,
  DecisionState,
  DriftSignal,
  GovernanceDecision,
  KPIPoint,
  Model as AegisModel,
  ModelFamily,
  ModelKPI,
  ModelVersion,
  Policy,
  RiskClass,
  Role,
  Severity,
} from "@aegis/shared-ts";

export const SEVERITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;

/**
 * UI-only enrichment for the model registry surface — domain bucket and
 * one-line description. The control plane stores these in
 * `Model.causal_dag.metadata` (not load-bearing for the audit chain), so
 * we surface them as optional properties without re-defining the type.
 */
export interface ModelUIDetail {
  readonly domain: "credit" | "content-moderation" | "healthcare";
  readonly description: string;
  readonly real_world_incident?: string;
}

/**
 * Decision name vs. enum: the generated `DecisionState` is a string union
 * already (`"detected" | "analyzed" | ...`). Keep this alias for spots
 * where the codebase reads `DecisionStateName`.
 */
export type { DecisionState as DecisionStateName } from "@aegis/shared-ts";
```

- [ ] **Step 2: Type-check the dashboard**

Run: `pnpm --filter @aegis/dashboard typecheck`
Expected: PASS, or a small list of import-name fixes (e.g., callers importing `DecisionState` directly).

- [ ] **Step 3: Fix any callers**

Update every error from Step 2 — these will be one-line import or property fixes, no behavior changes.

- [ ] **Step 4: Re-run typecheck + tests**

Run: `pnpm --filter @aegis/dashboard typecheck && pnpm --filter @aegis/dashboard test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/app/_lib/types.ts
git add -u apps/dashboard
git commit -m "refactor(dashboard): Phase 5 — types collapse to @aegis/shared-ts re-exports"
```

---

## Sub-phase 5b — Routing alignment

**Goal:** One public path prefix `/api/cp/*`. The Vercel rewrite, the FastAPI router prefixes, and the dashboard fetch path all agree. No translation layers, no twin prefixes.

### Task 4: Rename every control-plane router prefix from `/api/v1/...` to `/api/cp/...`

**Files:**

- Modify: `services/control-plane/src/aegis_control_plane/routers/{models,policies,audit,decisions,signals,stream,cron}.py`
- Test: `services/control-plane/tests/test_routing_prefix.py` (new)

- [ ] **Step 1: Write the failing test**

```python
# services/control-plane/tests/test_routing_prefix.py
"""Lock the public path prefix. Every dashboard-facing route lives under /api/cp/*."""

from __future__ import annotations

from fastapi.testclient import TestClient

from aegis_control_plane.app import build_app


REQUIRED_PREFIXES = (
    "/api/cp/models",
    "/api/cp/policies",
    "/api/cp/decisions",
    "/api/cp/audit",
    "/api/cp/signals",
    "/api/cp/stream",
)


def test_every_router_lives_under_api_cp() -> None:
    app = build_app()
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for prefix in REQUIRED_PREFIXES:
        assert any(p.startswith(prefix) for p in paths), f"missing prefix {prefix} in {paths}"


def test_no_legacy_api_v1_routes_remain() -> None:
    app = build_app()
    leaked = [r.path for r in app.routes if hasattr(r, "path") and r.path.startswith("/api/v1")]
    assert leaked == [], f"legacy /api/v1 routes still mounted: {leaked}"
```

- [ ] **Step 2: Run it — watch both assertions fail**

Run: `uv run --package aegis-control-plane pytest services/control-plane/tests/test_routing_prefix.py -v`
Expected: FAIL.

- [ ] **Step 3: Update each router's `APIRouter(prefix=...)`**

Open each file in `services/control-plane/src/aegis_control_plane/routers/` and replace `prefix="/api/v1/<thing>"` with `prefix="/api/cp/<thing>"`. Concretely:

| File           | Old prefix          | New prefix          |
| -------------- | ------------------- | ------------------- |
| `models.py`    | `/api/v1/models`    | `/api/cp/models`    |
| `policies.py`  | `/api/v1/policies`  | `/api/cp/policies`  |
| `audit.py`     | `/api/v1/audit`     | `/api/cp/audit`     |
| `decisions.py` | `/api/v1/decisions` | `/api/cp/decisions` |
| `signals.py`   | `/api/v1/signals`   | `/api/cp/signals`   |
| `stream.py`    | `/api/v1`           | `/api/cp`           |
| `cron.py`      | `/api/v1/internal`  | `/api/cp/internal`  |

The `health.py` router stays at `/healthz` and `/readyz` (those are platform health endpoints, not API surface).

- [ ] **Step 4: Update every existing test calling `/api/v1/...`**

Run: `rg -l "/api/v1/" services/control-plane/tests/`
For each match, swap `/api/v1/` → `/api/cp/`. The `vercel.ts` `crons` array and the `.github/workflows/*` paths get the same swap.

- [ ] **Step 5: Re-run the prefix test + the existing suite**

Run: `uv run --package aegis-control-plane pytest services/control-plane/tests/ -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/control-plane/src/aegis_control_plane/routers/ \
        services/control-plane/tests/ \
        vercel.ts \
        .github/workflows/
git commit -m "refactor(control-plane): Phase 5 — single public prefix /api/cp/*"
```

### Task 5: Vercel rewrite alignment

**Files:**

- Modify: `vercel.ts`
- Modify: `apps/dashboard/next.config.mjs`

- [ ] **Step 1: Update `vercel.ts` rewrite to be transparent**

Both source and destination use the same `/api/cp/...` path so there's no in-flight prefix rewriting. The destination is the Vercel Functions Python entrypoint at `services/control-plane/api/index.py` (created in Phase 0); the FastAPI app handles `/api/cp/...` natively.

```typescript
// vercel.ts  (replace `rewrites` block)
rewrites: [
  routes.rewrite("/api/cp/:path*", "/services/control-plane/api/index.py?path=:path*"),
],
```

(If the existing entrypoint shape is different — e.g. uses Vercel's "fluid" Python conventions — match it; the rule of thumb is the destination invokes the same FastAPI app the local dev server invokes, with no prefix mutation.)

Update `crons` in the same file to the new paths:

```typescript
crons: [
  { path: "/api/cp/internal/cron/heartbeat", schedule: "*/5 * * * *" },
  { path: "/api/cp/internal/cron/detect", schedule: "*/5 * * * *" },
],
```

- [ ] **Step 2: Add a Next.js dev rewrite so `pnpm dev` proxies to localhost:8000**

```javascript
// apps/dashboard/next.config.mjs  (add to nextConfig)
async rewrites() {
  // Local development: proxy /api/cp/* to the FastAPI dev server.
  // Production: vercel.ts rewrite takes over and this block is unused.
  if (process.env.NODE_ENV !== "development") return [];
  const target = process.env.AEGIS_CONTROL_PLANE_DEV_URL ?? "http://localhost:8000";
  return [{ source: "/api/cp/:path*", destination: `${target}/api/cp/:path*` }];
}
```

- [ ] **Step 3: Smoke-test the dev proxy locally**

Run (terminal 1): `uv run --package aegis-control-plane uvicorn aegis_control_plane.app:app --port 8000`
Run (terminal 2): `pnpm --filter @aegis/dashboard dev`
Then in a third shell: `curl -s http://localhost:3000/api/cp/healthz`
Expected: JSON `{"status": "ok"}` proxied through Next dev.

- [ ] **Step 4: Commit**

```bash
git add vercel.ts apps/dashboard/next.config.mjs
git commit -m "feat(infra): Phase 5 — single rewrite for /api/cp/*; dev proxy to FastAPI"
```

---

## Sub-phase 5c — Read endpoints + dashboard wiring

**Goal:** Every read the dashboard performs has a real backend. The `MOCK.*` fallback in `app/_lib/api.ts` is removed; mock data moves to a fixtures module used only by tests and the design-system page.

> **Convention:** every backend endpoint task here follows the same TDD pattern (failing pytest → minimal handler → passing test → commit). The fleet endpoint is shown in full; the rest abbreviate identically-shaped sections.

### Task 6: `/api/cp/fleet/kpi` — fleet-wide rollup

**Files:**

- Create: `services/control-plane/src/aegis_control_plane/routers/fleet.py`
- Create: `services/control-plane/src/aegis_control_plane/tinybird.py`
- Create: `services/control-plane/tests/test_fleet_router.py`
- Modify: `services/control-plane/src/aegis_control_plane/app.py` (mount fleet_router)

- [ ] **Step 1: Write the failing test**

```python
# services/control-plane/tests/test_fleet_router.py
from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from aegis_control_plane.app import build_app
from aegis_control_plane.tinybird import TinybirdQuery


@pytest.fixture
def fake_tinybird(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[dict[str, Any]]]:
    rows = {
        "fleet_kpi": [
            {
                "model_id": "credit-v1",
                "window": "24h",
                "accuracy": 0.872,
                "fairness": 0.71,
                "p95_latency_ms": 88.0,
                "prediction_volume": 124_330,
            },
            {
                "model_id": "toxicity-v1",
                "window": "24h",
                "accuracy": 0.94,
                "fairness": 0.95,
                "p95_latency_ms": 142.0,
                "prediction_volume": 88_400,
            },
        ],
        "kpi_sparkline": [
            {"model_id": "credit-v1", "ts": "2026-04-28T00:00:00Z", "accuracy": 0.91, "fairness": 0.94},
            {"model_id": "credit-v1", "ts": "2026-04-28T01:00:00Z", "accuracy": 0.90, "fairness": 0.91},
        ],
    }

    async def _query(self: TinybirdQuery, pipe: str, **_params: Any) -> list[dict[str, Any]]:
        return rows[pipe]

    monkeypatch.setattr(TinybirdQuery, "query", _query)
    return rows


def test_fleet_kpi_returns_one_kpi_per_model(fake_tinybird: dict[str, list[dict[str, Any]]]) -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/fleet/kpi?window=24h")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert {m["model_id"] for m in body} == {"credit-v1", "toxicity-v1"}
    credit = next(m for m in body if m["model_id"] == "credit-v1")
    assert credit["accuracy"] == pytest.approx(0.872)
    assert len(credit["sparkline"]) == 2


def test_fleet_kpi_window_validated() -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/fleet/kpi?window=banana")
    assert res.status_code == 422
```

- [ ] **Step 2: Run it — watch it fail**

Run: `uv run --package aegis-control-plane pytest services/control-plane/tests/test_fleet_router.py -v`
Expected: FAIL — `tinybird` module doesn't exist; `/api/cp/fleet/kpi` route doesn't exist.

- [ ] **Step 3: Implement the Tinybird query helper**

```python
# services/control-plane/src/aegis_control_plane/tinybird.py
"""Async Tinybird pipe-query helper used by the read endpoints."""

from __future__ import annotations

from typing import Any

import httpx

from aegis_control_plane.config import get_settings


class TinybirdQuery:
    """One-shot query against a Tinybird published pipe."""

    def __init__(self, host: str, token: str) -> None:
        self._host = host.rstrip("/")
        self._token = token

    async def query(self, pipe: str, **params: Any) -> list[dict[str, Any]]:
        url = f"{self._host}/v0/pipes/{pipe}.json"
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {self._token}"},
            )
            res.raise_for_status()
        return list(res.json().get("data", []))


def get_tinybird() -> TinybirdQuery:
    settings = get_settings()
    return TinybirdQuery(host=settings.tinybird_host, token=settings.tinybird_token)
```

Add `tinybird_host` and `tinybird_token` to `config.py` (defaults: `https://api.tinybird.co` and empty string; warn on missing token at startup).

- [ ] **Step 4: Implement the fleet router**

```python
# services/control-plane/src/aegis_control_plane/routers/fleet.py
from __future__ import annotations

from collections import defaultdict
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from aegis_control_plane.tinybird import TinybirdQuery, get_tinybird
from aegis_shared.schemas import KPIPoint, ModelKPI

router = APIRouter(prefix="/api/cp/fleet", tags=["fleet"])

Window = Literal["24h", "7d", "30d"]


@router.get("/kpi", response_model=list[ModelKPI])
async def list_fleet_kpi(
    tb: Annotated[TinybirdQuery, Depends(get_tinybird)],
    window: Annotated[Window, Query()] = "24h",
) -> list[ModelKPI]:
    rollup = await tb.query("fleet_kpi", window=window)
    sparks = await tb.query("kpi_sparkline", window=window)
    spark_by_model: dict[str, list[KPIPoint]] = defaultdict(list)
    for row in sparks:
        spark_by_model[row["model_id"]].append(
            KPIPoint(ts=row["ts"], accuracy=row["accuracy"], fairness=row["fairness"])
        )
    return [
        ModelKPI(
            model_id=row["model_id"],
            window=window,
            accuracy=row["accuracy"],
            fairness=row["fairness"],
            p95_latency_ms=row["p95_latency_ms"],
            prediction_volume=row["prediction_volume"],
            sparkline=spark_by_model.get(row["model_id"], []),
        )
        for row in rollup
    ]
```

- [ ] **Step 5: Mount it in `app.py`**

```python
# services/control-plane/src/aegis_control_plane/app.py
from aegis_control_plane.routers import fleet as fleet_router  # noqa: F401 — wired below
# inside build_app():
app.include_router(fleet_router.router)
```

- [ ] **Step 6: Re-run and verify it passes**

Run: `uv run --package aegis-control-plane pytest services/control-plane/tests/test_fleet_router.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/control-plane/src/aegis_control_plane/{tinybird.py,routers/fleet.py,app.py,config.py} \
        services/control-plane/tests/test_fleet_router.py
git commit -m "feat(control-plane): Phase 5 — /api/cp/fleet/kpi backed by Tinybird pipes"
```

### Task 7: `/api/cp/models/{id}/kpi` — per-model rollup

**Files:**

- Create: `services/control-plane/src/aegis_control_plane/routers/kpi.py`
- Create: `services/control-plane/tests/test_kpi_router.py`
- Modify: `services/control-plane/src/aegis_control_plane/app.py`

- [ ] **Step 1: Write the failing test** — uses the same `fake_tinybird` fixture (extract into `conftest.py` if it grows).

```python
# services/control-plane/tests/test_kpi_router.py
from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from aegis_control_plane.app import build_app
from aegis_control_plane.tinybird import TinybirdQuery


@pytest.fixture
def fake_tinybird_one_model(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _query(self: TinybirdQuery, pipe: str, **params: Any) -> list[dict[str, Any]]:
        if pipe == "model_kpi":
            return [{
                "model_id": params["model_id"],
                "window": params["window"],
                "accuracy": 0.872,
                "fairness": 0.71,
                "p95_latency_ms": 88.0,
                "prediction_volume": 124_330,
            }]
        if pipe == "kpi_sparkline":
            return [
                {"model_id": params["model_id"], "ts": "2026-04-28T00:00:00Z", "accuracy": 0.92, "fairness": 0.93},
            ]
        raise AssertionError(f"unexpected pipe {pipe}")

    monkeypatch.setattr(TinybirdQuery, "query", _query)


def test_model_kpi_returns_one_rollup(fake_tinybird_one_model: None) -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/models/credit-v1/kpi?window=24h")
    assert res.status_code == 200
    body = res.json()
    assert body["model_id"] == "credit-v1"
    assert body["accuracy"] == pytest.approx(0.872)
    assert len(body["sparkline"]) == 1


def test_model_kpi_404_when_no_rollup(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _query(self: TinybirdQuery, pipe: str, **_p: Any) -> list[dict[str, Any]]:
        return []

    monkeypatch.setattr(TinybirdQuery, "query", _query)
    client = TestClient(build_app())
    res = client.get("/api/cp/models/no-such-model/kpi?window=24h")
    assert res.status_code == 404
```

- [ ] **Step 2: Run it — watch it fail.**

- [ ] **Step 3: Implement the router**

```python
# services/control-plane/src/aegis_control_plane/routers/kpi.py
from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from aegis_control_plane.tinybird import TinybirdQuery, get_tinybird
from aegis_shared.schemas import KPIPoint, ModelKPI

router = APIRouter(prefix="/api/cp/models", tags=["kpi"])

Window = Literal["24h", "7d", "30d"]


@router.get("/{model_id}/kpi", response_model=ModelKPI)
async def get_model_kpi(
    model_id: str,
    tb: Annotated[TinybirdQuery, Depends(get_tinybird)],
    window: Annotated[Window, Query()] = "24h",
) -> ModelKPI:
    rollup = await tb.query("model_kpi", model_id=model_id, window=window)
    if not rollup:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"no KPI rollup for {model_id}")
    sparks = await tb.query("kpi_sparkline", model_id=model_id, window=window)
    row = rollup[0]
    return ModelKPI(
        model_id=row["model_id"],
        window=window,
        accuracy=row["accuracy"],
        fairness=row["fairness"],
        p95_latency_ms=row["p95_latency_ms"],
        prediction_volume=row["prediction_volume"],
        sparkline=[KPIPoint(ts=s["ts"], accuracy=s["accuracy"], fairness=s["fairness"]) for s in sparks],
    )
```

- [ ] **Step 4: Mount, run tests, commit.**

```bash
git add services/control-plane/src/aegis_control_plane/{routers/kpi.py,app.py} \
        services/control-plane/tests/test_kpi_router.py
git commit -m "feat(control-plane): Phase 5 — /api/cp/models/{id}/kpi"
```

### Task 8: `/api/cp/activity` — paginated state-transition feed

**Files:**

- Create: `services/control-plane/src/aegis_control_plane/routers/activity.py`
- Create: `services/control-plane/tests/test_activity_router.py`

- [ ] **Step 1: Write the failing test**

```python
# services/control-plane/tests/test_activity_router.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient

from aegis_control_plane.app import build_app


@pytest.mark.asyncio
async def test_activity_returns_recent_audit_rows_with_decision_context(
    seeded_db: Any,  # fixture from conftest — already inserts a couple of decisions + audit rows
) -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/activity?limit=5")
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert all("type" in e and "severity" in e and "actor" in e for e in body)
    # Newest first.
    timestamps = [datetime.fromisoformat(e["ts"]) for e in body]
    assert timestamps == sorted(timestamps, reverse=True)


def test_activity_limit_validated() -> None:
    client = TestClient(build_app())
    assert client.get("/api/cp/activity?limit=0").status_code == 422
    assert client.get("/api/cp/activity?limit=1001").status_code == 422
```

- [ ] **Step 2: Implement** — read the last N audit rows joined to `governance_decisions` for severity / model_id, project into `ActivityEvent`. Map audit `action` → activity `type` (`detect` → `decision_open`, `analyze` / `plan` / `execute` / `evaluate` → `state_transition`, `approval` → `approval_decided`).

```python
# services/control-plane/src/aegis_control_plane/routers/activity.py
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.db import get_session
from aegis_control_plane.orm import AuditLogRow, GovernanceDecisionRow
from aegis_shared.schemas import ActivityEvent

router = APIRouter(prefix="/api/cp/activity", tags=["activity"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

ACTION_TO_TYPE = {
    "detect": "decision_open",
    "analyze": "state_transition",
    "plan": "state_transition",
    "approval": "approval_decided",
    "execute": "state_transition",
    "evaluate": "state_transition",
}


@router.get("", response_model=list[ActivityEvent])
async def list_activity(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[ActivityEvent]:
    # Audit rows (ordered newest-first), enriched with decision metadata.
    stmt = (
        select(AuditLogRow, GovernanceDecisionRow)
        .join(
            GovernanceDecisionRow,
            AuditLogRow.payload["decision_id"].astext == GovernanceDecisionRow.id.cast(str),
            isouter=True,
        )
        .order_by(AuditLogRow.sequence_n.desc())
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    out: list[ActivityEvent] = []
    for audit, decision in rows:
        ev_type = ACTION_TO_TYPE.get(audit.action, "state_transition")
        title = f"{audit.action} · {decision.model_id}" if decision else audit.action
        summary = audit.payload.get("summary") or audit.action
        out.append(
            ActivityEvent(
                id=str(audit.sequence_n),
                ts=audit.ts,
                type=ev_type,
                severity=(decision.severity if decision else "LOW"),
                actor=audit.actor,
                title=title,
                summary=summary,
                decision_id=str(decision.id) if decision else None,
                model_id=decision.model_id if decision else None,
            )
        )
    return out
```

- [ ] **Step 3: Run, verify, commit.**

```bash
git add services/control-plane/src/aegis_control_plane/routers/activity.py \
        services/control-plane/src/aegis_control_plane/app.py \
        services/control-plane/tests/test_activity_router.py
git commit -m "feat(control-plane): Phase 5 — /api/cp/activity feed"
```

### Task 9: `/api/cp/datasets` — datasheet surface

**Files:**

- Create: `services/control-plane/src/aegis_control_plane/routers/datasets.py`
- Create: `services/control-plane/src/aegis_control_plane/orm.py` (modify — add `DatasetRow`)
- Create: Alembic migration `0007_datasets.py`
- Create: `services/control-plane/tests/test_datasets_router.py`

- [ ] **Step 1: Write the failing test** — assert the endpoint returns the seeded HMDA / Civil-Comments / Diabetes-130 datasets per spec Appendix A.

```python
# services/control-plane/tests/test_datasets_router.py
from __future__ import annotations

from fastapi.testclient import TestClient

from aegis_control_plane.app import build_app


def test_datasets_returns_three_seeded_datasets(seeded_datasets: None) -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/datasets")
    assert res.status_code == 200
    body = res.json()
    ids = {d["id"] for d in body}
    assert {"hmda-2018-public-lar", "civil-comments-jigsaw", "diabetes-130-uci"} <= ids
    for d in body:
        assert d["citation"]
        assert d["license"]
        assert d["snapshot_url"].startswith("https://")
```

- [ ] **Step 2: Implement the migration + ORM row + router + read fixture.**

Migration `0007_datasets.py`:

```python
"""dataset registry"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0007_datasets"
down_revision = "0006_..."  # whatever the latest migration is
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("family", sa.Text(), nullable=False),
        sa.Column("rows", sa.Integer(), nullable=False),
        sa.Column("feature_count", sa.Integer(), nullable=False),
        sa.Column("snapshot_url", sa.Text(), nullable=False),
        sa.Column("datasheet_url", sa.Text(), nullable=False),
        sa.Column("license", sa.Text(), nullable=False),
        sa.Column("citation", sa.Text(), nullable=False),
        sa.Column("last_drift_psi", sa.Float()),
        sa.Column("attached_models", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("datasets")
```

Router:

```python
# services/control-plane/src/aegis_control_plane/routers/datasets.py
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.db import get_session
from aegis_control_plane.orm import DatasetRow
from aegis_shared.schemas import Dataset

router = APIRouter(prefix="/api/cp/datasets", tags=["datasets"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("", response_model=list[Dataset])
async def list_datasets(session: SessionDep) -> list[Dataset]:
    rows = (await session.execute(select(DatasetRow).order_by(DatasetRow.id))).scalars().all()
    return [
        Dataset(
            id=r.id,
            name=r.name,
            family=r.family,
            rows=r.rows,
            feature_count=r.feature_count,
            snapshot_url=r.snapshot_url,
            datasheet_url=r.datasheet_url,
            license=r.license,
            citation=r.citation,
            last_drift_psi=r.last_drift_psi,
            attached_models=list(r.attached_models),
        )
        for r in rows
    ]
```

The seeder lives in Sub-phase 5i (`seed.py`) — it inserts the three real-world datasets with verified citations matching spec Appendix A.

- [ ] **Step 3: Run + commit.**

```bash
git add services/control-plane/src/aegis_control_plane/{routers/datasets.py,orm.py,alembic/versions/0007_*.py,app.py} \
        services/control-plane/tests/test_datasets_router.py
git commit -m "feat(control-plane): Phase 5 — /api/cp/datasets backed by datasets table"
```

### Task 10: `/api/cp/compliance` — regulatory mapping

**Files:**

- Create: `services/control-plane/src/aegis_control_plane/routers/compliance.py`
- Create: `services/control-plane/src/aegis_control_plane/compliance_data.py` (static data, sourced from spec Appendix B)
- Create: `services/control-plane/tests/test_compliance_router.py`

- [ ] **Step 1: Write the failing test**

```python
# services/control-plane/tests/test_compliance_router.py
from __future__ import annotations

from fastapi.testclient import TestClient

from aegis_control_plane.app import build_app


REQUIRED_FRAMEWORKS = {"EU AI Act", "NIST AI RMF", "ISO 42001"}


def test_compliance_returns_three_frameworks() -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/compliance")
    assert res.status_code == 200
    body = res.json()
    frameworks = {row["framework"] for row in body}
    assert REQUIRED_FRAMEWORKS <= frameworks


def test_compliance_each_row_points_at_a_panel() -> None:
    client = TestClient(build_app())
    body = client.get("/api/cp/compliance").json()
    for row in body:
        assert row["panel_route"].startswith("/")
        assert row["panel_evidence"]
```

- [ ] **Step 2: Implement** — the data is static and authoritative; lifted from spec Appendix B with article numbers and panel routes.

```python
# services/control-plane/src/aegis_control_plane/compliance_data.py
from __future__ import annotations

from aegis_shared.schemas import ComplianceMapping


# Verbatim from spec Appendix B. Updates land in the same table when
# the appendix changes. Keep this list short and precise.
COMPLIANCE_TABLE: tuple[ComplianceMapping, ...] = (
    ComplianceMapping(
        framework="EU AI Act",
        article="Article 9",
        requirement="Risk management system across the AI lifecycle",
        panel_route="/policies",
        panel_evidence="Policy DSL versions + dry-run / shadow / live mode toggle",
    ),
    ComplianceMapping(
        framework="EU AI Act",
        article="Article 12",
        requirement="Automatic recording of events ('logs') over the AI's lifetime",
        panel_route="/audit",
        panel_evidence="Merkle-chained audit log with hourly external anchor",
    ),
    ComplianceMapping(
        framework="EU AI Act",
        article="Article 13",
        requirement="Transparency and provision of information to users",
        panel_route="/chat",
        panel_evidence="Tool-grounded Governance Assistant — every claim references audit row",
    ),
    ComplianceMapping(
        framework="EU AI Act",
        article="Article 14",
        requirement="Human oversight",
        panel_route="/approvals",
        panel_evidence="Approval queue + emergency stop + role-gated transitions",
    ),
    ComplianceMapping(
        framework="EU AI Act",
        article="Article 15",
        requirement="Accuracy, robustness, cybersecurity",
        panel_route="/fleet",
        panel_evidence="Fleet KPI rollup with 24h fairness and drift monitors",
    ),
    ComplianceMapping(
        framework="NIST AI RMF",
        article="GOVERN-1.1",
        requirement="Policies, processes, procedures, and practices for AI risks",
        panel_route="/policies",
        panel_evidence="Versioned, signed, mode-gated policy DSL",
    ),
    ComplianceMapping(
        framework="NIST AI RMF",
        article="MEASURE-2.6",
        requirement="Performance, robustness, safety, and trustworthiness measured",
        panel_route="/models/[id]",
        panel_evidence="Per-model drift / fairness / calibration / performance tabs",
    ),
    ComplianceMapping(
        framework="ISO 42001",
        article="6.1.4",
        requirement="AI risk treatment with verified controls",
        panel_route="/incidents",
        panel_evidence="Decision lifecycle with attribution → Pareto plan → executor → evaluator",
    ),
)
```

Router:

```python
# services/control-plane/src/aegis_control_plane/routers/compliance.py
from __future__ import annotations

from fastapi import APIRouter

from aegis_control_plane.compliance_data import COMPLIANCE_TABLE
from aegis_shared.schemas import ComplianceMapping

router = APIRouter(prefix="/api/cp/compliance", tags=["compliance"])


@router.get("", response_model=list[ComplianceMapping])
async def list_compliance() -> list[ComplianceMapping]:
    return list(COMPLIANCE_TABLE)
```

- [ ] **Step 3: Mount, test, commit.**

```bash
git add services/control-plane/src/aegis_control_plane/{routers/compliance.py,compliance_data.py,app.py} \
        services/control-plane/tests/test_compliance_router.py
git commit -m "feat(control-plane): Phase 5 — /api/cp/compliance (EU AI Act / NIST / ISO mapping)"
```

### Task 11: Strip the mock branch from `app/_lib/api.ts`

**Files:**

- Modify: `apps/dashboard/app/_lib/api.ts`
- Create: `apps/dashboard/app/_lib/api.fixtures.ts` (the old `MOCK` dataset, renamed)
- Delete: `apps/dashboard/app/_lib/mock-data.ts`

- [ ] **Step 1: Replace `api.ts` with the live-only client**

```typescript
// apps/dashboard/app/_lib/api.ts
import type {
  ActivityEvent,
  AegisModel,
  AuditPage,
  AuditRow,
  ChainVerificationResult,
  ComplianceMapping,
  Dataset,
  GovernanceDecision,
  ModelKPI,
  ModelVersion,
  Policy,
} from "./types";

/**
 * Aegis dashboard API client.
 *
 * Talks to the control plane through `/api/cp/*` (Vercel rewrite in
 * production, Next dev rewrite locally). No mock branch — the
 * reachability probe in `_lib/reachability.ts` decides whether to
 * render the dashboard or the friendly degraded-mode banner.
 *
 * Spec §4.2 (deployment topology) + §4.3 (per-service contracts).
 */

const PREFIX = "/api/cp";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PREFIX}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ApiError(`Aegis API ${path} → HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ──────────── Models ────────────

export const listModels = (): Promise<readonly AegisModel[]> =>
  fetchJson<readonly AegisModel[]>("/models");

export const getModel = (modelId: string): Promise<AegisModel> =>
  fetchJson<AegisModel>(`/models/${encodeURIComponent(modelId)}`);

export const listModelVersions = (modelId: string): Promise<readonly ModelVersion[]> =>
  fetchJson<readonly ModelVersion[]>(`/models/${encodeURIComponent(modelId)}/versions`);

export const getModelKPI = (modelId: string, window = "24h"): Promise<ModelKPI> =>
  fetchJson<ModelKPI>(
    `/models/${encodeURIComponent(modelId)}/kpi?window=${encodeURIComponent(window)}`,
  );

export const listFleetKPIs = (window = "24h"): Promise<readonly ModelKPI[]> =>
  fetchJson<readonly ModelKPI[]>(`/fleet/kpi?window=${encodeURIComponent(window)}`);

// ──────────── Decisions ────────────

export interface DecisionsQuery {
  readonly modelId?: string;
  readonly state?: string;
  readonly limit?: number;
}

export function listDecisions(query: DecisionsQuery = {}): Promise<readonly GovernanceDecision[]> {
  const params = new URLSearchParams();
  if (query.modelId) params.set("model_id", query.modelId);
  if (query.state) params.set("state", query.state);
  if (query.limit) params.set("limit", String(query.limit));
  return fetchJson<readonly GovernanceDecision[]>(`/decisions?${params.toString()}`);
}

export const getDecision = (id: string): Promise<GovernanceDecision> =>
  fetchJson<GovernanceDecision>(`/decisions/${encodeURIComponent(id)}`);

export interface TransitionInput {
  readonly target_state: GovernanceDecision["state"];
  readonly payload?: Record<string, unknown>;
}

export const transitionDecision = (
  id: string,
  body: TransitionInput,
): Promise<GovernanceDecision> =>
  fetchJson<GovernanceDecision>(`/decisions/${encodeURIComponent(id)}/transition`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// ──────────── Audit ────────────

export interface AuditQuery {
  readonly limit?: number;
  readonly sinceSeq?: number;
  readonly decisionId?: string;
}

export function listAudit(query: AuditQuery = {}): Promise<AuditPage> {
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", String(query.limit));
  if (query.sinceSeq) params.set("since_seq", String(query.sinceSeq));
  if (query.decisionId) params.set("decision_id", query.decisionId);
  return fetchJson<AuditPage>(`/audit?${params.toString()}`);
}

export const verifyChain = (): Promise<ChainVerificationResult> =>
  fetchJson<ChainVerificationResult>("/audit/verify", { method: "POST" });

export const auditExportUrl = (): string => `${PREFIX}/audit/export.csv`;

// ──────────── Activity ────────────

export const listActivity = (limit = 50): Promise<readonly ActivityEvent[]> =>
  fetchJson<readonly ActivityEvent[]>(`/activity?limit=${limit}`);

// ──────────── Datasets / policies / compliance ────────────

export const listDatasets = (): Promise<readonly Dataset[]> =>
  fetchJson<readonly Dataset[]>("/datasets");

export const listPolicies = (modelId?: string): Promise<readonly Policy[]> =>
  fetchJson<readonly Policy[]>(`/policies${modelId ? `?model_id=${modelId}` : ""}`);

export const listCompliance = (): Promise<readonly ComplianceMapping[]> =>
  fetchJson<readonly ComplianceMapping[]>("/compliance");
```

- [ ] **Step 2: Move the old MOCK dataset to a fixtures file** — same content, no mock-branch logic. Used only by `apps/dashboard/app/design/*` and Vitest stories.

```bash
git mv apps/dashboard/app/_lib/mock-data.ts apps/dashboard/app/_lib/api.fixtures.ts
```

Then in the file, rename the export from `export const MOCK` to `export const FIXTURES` and update `apps/dashboard/app/design/page.tsx` (and any `.stories.tsx` files) accordingly.

- [ ] **Step 3: Type-check + run tests + commit.**

```bash
pnpm --filter @aegis/dashboard typecheck
pnpm --filter @aegis/dashboard test
git add apps/dashboard/app/_lib/api.ts apps/dashboard/app/_lib/api.fixtures.ts apps/dashboard/app/design/page.tsx
git commit -m "feat(dashboard): Phase 5 — live-only API client; fixtures module for design page"
```

---

## Sub-phase 5d — Live SSE activity feed

**Goal:** The activity bell + the activity feed on `/fleet` subscribe to a live event stream. Every state transition broadcasts. Polling is gone.

### Task 12: Typed `useActivityStream` hook

**Files:**

- Create: `apps/dashboard/app/_lib/stream.ts`
- Modify: `apps/dashboard/app/_lib/hooks.ts` — replace `useActivity` with `useActivityStream`

- [ ] **Step 1: Implement the typed EventSource wrapper**

```typescript
// apps/dashboard/app/_lib/stream.ts
"use client";

import { useEffect, useRef, useState } from "react";
import type { ActivityEvent } from "./types";

export function useActivityStream(initial: readonly ActivityEvent[] = [], limit = 50) {
  const [events, setEvents] = useState<readonly ActivityEvent[]>(initial);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const src = new EventSource("/api/cp/stream");
    sourceRef.current = src;

    src.onopen = () => setConnected(true);
    src.onerror = () => setConnected(false);

    src.addEventListener("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.data) as { type: string; data: ActivityEvent };
        // Only stream-events that came from the activity broadcaster carry an ActivityEvent payload.
        if (parsed.data && "ts" in parsed.data) {
          setEvents((prev) => [parsed.data, ...prev].slice(0, limit));
        }
      } catch {
        // ignore malformed frames — heartbeats arrive as the `heartbeat` event type
      }
    });

    return () => {
      src.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, [limit]);

  return { events, connected };
}
```

- [ ] **Step 2: Replace `useActivity` polling**

```typescript
// apps/dashboard/app/_lib/hooks.ts  (replace the activity hook)
import { useActivityStream } from "./stream";

export function useActivity(limit = 50) {
  // SWR pre-fetches the initial page; the stream takes over after mount.
  const initial = useSWR(["activity-initial", limit], () => api.listActivity(limit), DEFAULT);
  const live = useActivityStream(initial.data ?? [], limit);
  return { events: live.events, connected: live.connected, error: initial.error };
}
```

- [ ] **Step 3: Update callers** — `_components/activity-feed.tsx` and the top-nav bell consume `{ events, connected }`.

- [ ] **Step 4: Commit.**

```bash
git add apps/dashboard/app/_lib/{stream.ts,hooks.ts} apps/dashboard/app/(app)/_components/
git commit -m "feat(dashboard): Phase 5 — SSE activity stream replaces 8s poll"
```

### Task 13: Broadcast on every decision state transition

**Files:**

- Modify: `services/control-plane/src/aegis_control_plane/routers/decisions.py`
- Modify: `services/control-plane/src/aegis_control_plane/routers/signals.py`
- Create: `services/control-plane/tests/test_decision_transition_broadcast.py`

- [ ] **Step 1: Write the failing test**

```python
# services/control-plane/tests/test_decision_transition_broadcast.py
from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from aegis_control_plane.app import build_app
from aegis_control_plane.routers.stream import _bus  # internal singleton — fine in tests


@pytest.mark.asyncio
async def test_state_transition_broadcasts_one_event(seeded_decision: dict[str, str]) -> None:
    client = TestClient(build_app())
    queue = _bus.subscribe()
    try:
        res = client.post(
            f"/api/cp/decisions/{seeded_decision['id']}/transition",
            json={"target_state": "analyzed"},
        )
        assert res.status_code == 200
        msg = await asyncio.wait_for(queue.get(), timeout=2.0)
        body = json.loads(msg)
        assert body["type"] == "state_transition"
        assert body["data"]["decision_id"] == seeded_decision["id"]
        assert body["data"]["type"] == "state_transition"
    finally:
        _bus.unsubscribe(queue)
```

- [ ] **Step 2: Implement the broadcast hook in `decisions.py`**

After a successful transition, before returning, fan out an `ActivityEvent` over the bus:

```python
# services/control-plane/src/aegis_control_plane/routers/decisions.py
from aegis_control_plane.routers.stream import StreamEvent, get_bus  # noqa: E402
from aegis_shared.schemas import ActivityEvent

# inside the transition handler, after audit-row write:
bus = get_bus()
event = ActivityEvent(
    id=str(audit_row.sequence_n),
    ts=audit_row.ts,
    type="state_transition",
    severity=decision.severity,
    actor=audit_row.actor,
    title=f"{audit_row.action} · {decision.model_id}",
    summary=f"{decision.id} → {payload.target_state.value}",
    decision_id=str(decision.id),
    model_id=decision.model_id,
)
await bus.broadcast(StreamEvent(type="state_transition", data=event.model_dump(mode="json")))
```

Mirror the same broadcast in `signals.py` when a new decision is opened (`type="decision_open"`).

- [ ] **Step 3: Run tests + commit.**

```bash
git add services/control-plane/src/aegis_control_plane/routers/{decisions.py,signals.py} \
        services/control-plane/tests/test_decision_transition_broadcast.py
git commit -m "feat(control-plane): Phase 5 — broadcast ActivityEvent on every state transition"
```

---

## Sub-phase 5e — Tinybird KPI pipes

**Goal:** Three Tinybird pipes fuel the live KPI surface — `fleet_kpi`, `model_kpi`, `kpi_sparkline` — populated from the existing `predictions` and `signals` data sources.

### Task 14: Define the three pipes

**Files:**

- Create: `infra/tinybird/pipes/fleet_kpi.pipe`
- Create: `infra/tinybird/pipes/model_kpi.pipe`
- Create: `infra/tinybird/pipes/kpi_sparkline.pipe`
- Create: `infra/tinybird/endpoints/{fleet_kpi,model_kpi,kpi_sparkline}.endpoint`

- [ ] **Step 1: Author `fleet_kpi.pipe`** — accuracy is `mean(prediction_correct)`, fairness is min subgroup parity from `subgroup_counters`, p95 latency from `predictions.latency_ms`, volume is `count()` over the window.

```sql
-- infra/tinybird/pipes/fleet_kpi.pipe
NODE windowed_predictions
SQL >
    %
    SELECT
        model_id,
        avg(toFloat32(correct)) AS accuracy,
        quantile(0.95)(latency_ms) AS p95_latency_ms,
        count() AS prediction_volume
    FROM predictions
    WHERE ts >= now() - INTERVAL {{ Int32(window_secs, 86400) }} SECOND
    GROUP BY model_id

NODE fairness_per_model
SQL >
    %
    SELECT
        model_id,
        min(parity_ratio) AS fairness
    FROM (
        SELECT
            model_id,
            subgroup,
            sum(positive_outcome) / sum(count_total) AS positive_rate,
            min(positive_outcome / count_total)
                OVER (PARTITION BY model_id) /
            max(positive_outcome / count_total)
                OVER (PARTITION BY model_id) AS parity_ratio
        FROM subgroup_counters
        WHERE ts >= now() - INTERVAL {{ Int32(window_secs, 86400) }} SECOND
        GROUP BY model_id, subgroup
    )
    GROUP BY model_id

NODE final
SQL >
    %
    SELECT
        p.model_id,
        '{{ String(window, "24h") }}' AS window,
        p.accuracy,
        coalesce(f.fairness, 1.0) AS fairness,
        p.p95_latency_ms,
        p.prediction_volume
    FROM windowed_predictions p
    LEFT JOIN fairness_per_model f USING (model_id)
```

`model_kpi.pipe` is the same query with `WHERE model_id = {{ String(model_id) }}`.

`kpi_sparkline.pipe`:

```sql
-- infra/tinybird/pipes/kpi_sparkline.pipe
NODE points
SQL >
    %
    SELECT
        model_id,
        toStartOfHour(ts) AS ts,
        avg(toFloat32(correct)) AS accuracy,
        avg(parity_ratio) AS fairness
    FROM predictions
    WHERE ts >= now() - INTERVAL {{ Int32(window_secs, 86400) }} SECOND
      {{ if defined(model_id) }} AND model_id = {{ String(model_id) }} {{ end }}
    GROUP BY model_id, ts
    ORDER BY ts
```

`*.endpoint` files are one-liners pointing the published HTTP endpoint at the `final` (or `points`) node.

- [ ] **Step 2: Push the pipes to Tinybird (Build plan)**

Run: `cd infra/tinybird && tb auth --token $TINYBIRD_TOKEN && tb push --force`
Expected: three new pipes published; HTTP endpoints reachable.

- [ ] **Step 3: Smoke-test against live data**

Run: `curl -s "https://api.tinybird.co/v0/pipes/fleet_kpi.json?token=$TINYBIRD_READ_TOKEN&window=24h" | jq .data`
Expected: rows for each model with non-null accuracy / fairness / volume.

- [ ] **Step 4: Commit.**

```bash
git add infra/tinybird/pipes/{fleet_kpi,model_kpi,kpi_sparkline}.pipe \
        infra/tinybird/endpoints/{fleet_kpi,model_kpi,kpi_sparkline}.endpoint
git commit -m "feat(tinybird): Phase 5 — fleet / model / sparkline KPI pipes"
```

---

## Sub-phase 5f — Approval write path

**Goal:** The approval card's `onApprove` and `onDeny` write a real transition (`awaiting_approval` → `executing` or `awaiting_approval` → `evaluated` with payload reflecting the deny). The audit chain extends. The activity feed updates. The card UI optimistically updates and rolls back on error.

### Task 15: Wire approve / deny in the dashboard

**Files:**

- Modify: `apps/dashboard/app/(app)/approvals/_view.tsx`
- Modify: `packages/ui/src/components/approval-card.tsx` (if needed — confirm signature already accepts onApprove/onDeny callbacks; lock justification dialog into UI)

- [ ] **Step 1: Implement the approval action handlers**

```tsx
// apps/dashboard/app/(app)/approvals/_view.tsx  (replace the empty onApprove/onDeny)
import { useSWRConfig } from "swr";
import { transitionDecision } from "../../_lib/api";
import { useState, useTransition } from "react";

// inside ApprovalQueueItem:
const { mutate } = useSWRConfig();
const [pending, startTransition] = useTransition();
const [error, setError] = useState<string | null>(null);

async function decide(target: "approve" | "deny", justification: string) {
  setError(null);
  startTransition(async () => {
    try {
      await transitionDecision(decision.id, {
        target_state: target === "approve" ? "executing" : "evaluated",
        payload: {
          approval: {
            decided_by: "current_user", // Clerk user id wired in 5b
            decision: target === "approve" ? "approved" : "denied",
            justification,
          },
        },
      });
      // Revalidate every list affected by this transition.
      void mutate(["decisions", "", "awaiting_approval", 0]);
      void mutate("audit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "transition failed");
    }
  });
}
```

The `ApprovalCard` already raises a justification dialog on click — wire `decide()` to its `onDeny(justification)` and `onApprove(justification)` callbacks. If the component currently calls them with no args, extend the props in `packages/ui/src/components/approval-card.tsx` to pass the dialog text through.

- [ ] **Step 2: Add a Vitest covering the optimistic-update + rollback path**

```typescript
// apps/dashboard/tests/approval-card.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
// ... import ApprovalsView, build a minimal decision fixture, mock `transitionDecision`
```

Cover: (a) successful approve → SWR invalidation triggers a fresh fetch; (b) backend 500 → error rendered next to card.

- [ ] **Step 3: Lock the role-gate**

If `useRole()` returns a role insufficient for this card's `requiredRole`, `onApprove` / `onDeny` are no-ops — surface a tooltip "your role can't decide this".

- [ ] **Step 4: Run + commit.**

```bash
git add apps/dashboard/app/\(app\)/approvals/_view.tsx \
        packages/ui/src/components/approval-card.tsx \
        apps/dashboard/tests/approval-card.test.tsx
git commit -m "feat(dashboard): Phase 5 — approval card writes real state transitions"
```

---

## Sub-phase 5g — Audit verify + CSV export

**Goal:** `/audit` page's verify button calls `POST /api/cp/audit/verify`. The export link streams the full chain as RFC-4180-compliant CSV.

### Task 16: Wire `verifyChain()`

**Files:**

- Modify: `apps/dashboard/app/(app)/audit/_view.tsx`

- [ ] **Step 1: Replace the local `onVerify` handler with the real call**

```tsx
// apps/dashboard/app/(app)/audit/_view.tsx
import { useState } from "react";
import { verifyChain, type ChainVerificationResult } from "../../_lib/api";

// inside the component:
const [result, setResult] = useState<ChainVerificationResult | null>(null);
const [verifying, setVerifying] = useState(false);

async function onVerify() {
  setVerifying(true);
  try {
    setResult(await verifyChain());
  } finally {
    setVerifying(false);
  }
}
```

- [ ] **Step 2: Render the result inline** — green pill if `result.valid`, red pill with `first_failed_sequence` if not. Match existing chart aesthetics — no new visual primitives.

- [ ] **Step 3: Commit.**

```bash
git add apps/dashboard/app/\(app\)/audit/_view.tsx
git commit -m "feat(dashboard): Phase 5 — audit verify button wired to real chain check"
```

### Task 17: CSV export endpoint

**Files:**

- Create: `services/control-plane/src/aegis_control_plane/routers/csv_export.py`
- Create: `services/control-plane/tests/test_csv_export.py`
- Modify: `apps/dashboard/app/(app)/audit/_view.tsx` (export href)

- [ ] **Step 1: Write the failing test**

```python
# services/control-plane/tests/test_csv_export.py
from __future__ import annotations

import csv
from io import StringIO

from fastapi.testclient import TestClient

from aegis_control_plane.app import build_app


def test_audit_export_streams_full_chain(seeded_audit_chain: int) -> None:
    client = TestClient(build_app())
    res = client.get("/api/cp/audit/export.csv")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    body = StringIO(res.text)
    reader = csv.DictReader(body)
    rows = list(reader)
    assert len(rows) == seeded_audit_chain  # fixture inserted exactly N rows
    assert reader.fieldnames == [
        "sequence_n", "ts", "actor", "action", "payload", "prev_hash", "row_hash", "signature",
    ]
```

- [ ] **Step 2: Implement** — stream the chain in `sequence_n` order using FastAPI's `StreamingResponse`.

```python
# services/control-plane/src/aegis_control_plane/routers/csv_export.py
from __future__ import annotations

import csv
import io
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.db import get_session
from aegis_control_plane.orm import AuditLogRow

router = APIRouter(prefix="/api/cp/audit", tags=["audit-export"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

CSV_HEADER = ["sequence_n", "ts", "actor", "action", "payload", "prev_hash", "row_hash", "signature"]


async def _stream(session: AsyncSession) -> AsyncIterator[str]:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_HEADER)
    yield buf.getvalue()
    buf.seek(0)
    buf.truncate(0)

    stmt = select(AuditLogRow).order_by(AuditLogRow.sequence_n.asc()).execution_options(
        yield_per=500
    )
    result = await session.stream(stmt)
    async for partition in result.partitions():
        for row in partition:
            r = row[0]
            writer.writerow([
                r.sequence_n, r.ts.isoformat(), r.actor, r.action,
                r.payload, r.prev_hash, r.row_hash, r.signature,
            ])
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)


@router.get("/export.csv")
async def export_csv(session: SessionDep) -> StreamingResponse:
    return StreamingResponse(
        _stream(session),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=aegis-audit-chain.csv"},
    )
```

- [ ] **Step 3: Update the dashboard export button** — replace the `data:text/csv,...` placeholder with `auditExportUrl()`.

- [ ] **Step 4: Run + commit.**

```bash
git add services/control-plane/src/aegis_control_plane/routers/csv_export.py \
        services/control-plane/tests/test_csv_export.py \
        apps/dashboard/app/\(app\)/audit/_view.tsx
git commit -m "feat(audit): Phase 5 — streaming CSV export of the full chain"
```

---

## Sub-phase 5h — Reachability auto-detect

**Goal:** No `useMock` env flag. A server-side probe at first render decides between "render the dashboard" and "render the friendly degraded-mode banner". The probe is fast (≤500 ms) and cached for 5 s per request — degraded state never surprises a returning user.

### Task 18: `/api/cp/reachability` endpoint (no DB hit)

**Files:**

- Create: `services/control-plane/src/aegis_control_plane/routers/reachability.py`
- Create: `services/control-plane/tests/test_reachability.py`

- [ ] **Step 1: Write the failing test**

```python
# services/control-plane/tests/test_reachability.py
from __future__ import annotations

from fastapi.testclient import TestClient

from aegis_control_plane.app import build_app


def test_reachability_returns_ok_with_version() -> None:
    res = TestClient(build_app()).get("/api/cp/reachability")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert "version" in body
    assert "ts" in body
```

- [ ] **Step 2: Implement** — pure function, no DB, no Tinybird.

```python
# services/control-plane/src/aegis_control_plane/routers/reachability.py
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from aegis_control_plane import __version__

router = APIRouter(prefix="/api/cp/reachability", tags=["reachability"])


@router.get("")
async def reachability() -> dict[str, object]:
    return {"ok": True, "version": __version__, "ts": datetime.now(timezone.utc).isoformat()}
```

- [ ] **Step 3: Mount, run, commit.**

```bash
git add services/control-plane/src/aegis_control_plane/{routers/reachability.py,app.py} \
        services/control-plane/tests/test_reachability.py
git commit -m "feat(control-plane): Phase 5 — /api/cp/reachability"
```

### Task 19: Dashboard reachability probe

**Files:**

- Create: `apps/dashboard/app/_lib/reachability.ts`
- Create: `apps/dashboard/app/(app)/_components/unreachable-banner.tsx`
- Modify: `apps/dashboard/app/(app)/layout.tsx` — render banner when probe fails
- Delete: every `useMock` / `isMock` reference in the dashboard

- [ ] **Step 1: Implement the probe** (server component — runs once per RSC render, cached 5 s).

```typescript
// apps/dashboard/app/_lib/reachability.ts
import "server-only";
import { unstable_cache } from "next/cache";

const TIMEOUT_MS = 500;

interface ReachabilityState {
  readonly reachable: boolean;
  readonly version: string | null;
  readonly checkedAt: string;
}

async function probe(): Promise<ReachabilityState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${process.env.AEGIS_CONTROL_PLANE_INTERNAL_URL ?? "http://127.0.0.1:8000"}/api/cp/reachability`,
      { cache: "no-store", signal: controller.signal },
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = (await res.json()) as { ok: boolean; version: string };
    return {
      reachable: body.ok,
      version: body.version,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return { reachable: false, version: null, checkedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}

export const checkReachability = unstable_cache(probe, ["aegis-reachability"], {
  revalidate: 5,
  tags: ["reachability"],
});
```

- [ ] **Step 2: Implement the friendly banner**

```tsx
// apps/dashboard/app/(app)/_components/unreachable-banner.tsx
import { LinkIcon } from "@aegis/ui";

export function UnreachableBanner({ checkedAt }: { readonly checkedAt: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="aegis-card mx-auto mt-3 max-w-aegis-content border-aegis-warn/30 bg-aegis-warn/5 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <LinkIcon width={18} height={18} className="mt-0.5 shrink-0 text-aegis-warn" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="aegis-mono-label">CONTROL PLANE UNREACHABLE</p>
          <p className="text-aegis-sm text-aegis-fg-2 leading-aegis-snug">
            The dashboard cannot reach <code className="aegis-mono">/api/cp/reachability</code>.
            Live data is not flowing — most actions are paused. Detection workers may be sleeping on
            a free Hugging Face Space; visit the runbook in{" "}
            <code className="aegis-mono">setup.md §Phase 5</code> to wake them.
          </p>
          <p className="aegis-mono-meta">last probed {checkedAt}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render the banner in `(app)/layout.tsx` above the page chrome when `reachable === false`. Do NOT swap to fixtures — show the banner and let the underlying queries surface SWR errors. The dashboard remains readable; user sees an honest signal.**

- [ ] **Step 4: Delete every `useMock` / `isMock` reference.**

Run: `rg -l "useMock|isMock" apps/dashboard packages/ui` — should be empty after this task.

- [ ] **Step 5: Commit.**

```bash
git add apps/dashboard/app/_lib/reachability.ts \
        apps/dashboard/app/\(app\)/_components/unreachable-banner.tsx \
        apps/dashboard/app/\(app\)/layout.tsx
git add -u apps/dashboard packages/ui
git commit -m "feat(dashboard): Phase 5 — reachability probe replaces useMock flag"
```

---

## Sub-phase 5i — Hero scenario seeder

**Goal:** First-run idempotent seed of the Apple-Card-2019 replay decision into Postgres + Tinybird, so the demo always walks end-to-end against the live stack.

### Task 20: `seed.py` — three models + the hero decision + audit chain

**Files:**

- Create: `services/control-plane/src/aegis_control_plane/seed.py`
- Modify: `services/control-plane/src/aegis_control_plane/routers/cron.py` — call seeder once on heartbeat if env `AEGIS_SEED_HERO=true`
- Create: `services/control-plane/tests/test_seed.py`

- [ ] **Step 1: Write the failing test**

```python
# services/control-plane/tests/test_seed.py
from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.orm import AuditLogRow, GovernanceDecisionRow, ModelRow
from aegis_control_plane.seed import seed_hero_scenario


@pytest.mark.asyncio
async def test_seed_idempotent(session: AsyncSession) -> None:
    await seed_hero_scenario(session)
    await seed_hero_scenario(session)  # second call must not duplicate

    models = (await session.execute(select(ModelRow))).scalars().all()
    decisions = (await session.execute(select(GovernanceDecisionRow))).scalars().all()
    audit_rows = (await session.execute(select(AuditLogRow))).scalars().all()

    assert len(models) == 3, "credit + toxicity + readmission"
    assert len(decisions) == 1, "exactly one Apple-Card hero decision"
    # The hero decision walks detected → analyzed → planned → awaiting_approval → executing → evaluated.
    assert len(audit_rows) == 6
    actions = [r.action for r in audit_rows]
    assert actions == ["detect", "analyze", "plan", "approval", "execute", "evaluate"]


@pytest.mark.asyncio
async def test_seed_chain_verifies(session: AsyncSession) -> None:
    from aegis_shared.audit import verify_chain

    await seed_hero_scenario(session)
    rows = (await session.execute(select(AuditLogRow).order_by(AuditLogRow.sequence_n))).scalars().all()
    payload = [
        {"sequence_n": r.sequence_n, "ts": r.ts, "actor": r.actor, "action": r.action,
         "payload": r.payload, "prev_hash": r.prev_hash, "row_hash": r.row_hash, "signature": r.signature}
        for r in rows
    ]
    assert verify_chain(payload).valid
```

- [ ] **Step 2: Implement the seeder** — the factual content lives in spec §5.2 and Appendix A.

```python
# services/control-plane/src/aegis_control_plane/seed.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Final

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.audit_writer import AuditWriter
from aegis_control_plane.orm import GovernanceDecisionRow, ModelRow

# Marquee scenario: Apple Card 2019 (NYDFS investigation 2021, settlement 2024).
# Citations: spec Appendix A.

HERO_DECISION_ID: Final = "00000000-0000-4000-a000-000000000042"
NOW = datetime(2026, 4, 28, 12, 3, 0, tzinfo=timezone.utc)

MODELS: tuple[dict[str, object], ...] = (
    {
        "id": "credit-v1",
        "name": "Credit Risk · HMDA",
        "family": "tabular",
        "risk_class": "HIGH",
        "active_version": "1.4.0",
        "owner_id": "system:bootstrap",
        "model_card_url": "blob://aegis/cards/credit-v1.md",
        "datasheet_url": "blob://aegis/sheets/hmda-2018.md",
        "causal_dag": {"nodes": [...]},  # full DAG from packages/shared-py/causal_dags
    },
    {
        "id": "toxicity-v1",
        "name": "Toxicity · DistilBERT",
        "family": "text",
        "risk_class": "MEDIUM",
        "active_version": "0.9.2",
        "owner_id": "system:bootstrap",
        "model_card_url": "blob://aegis/cards/toxicity-v1.md",
        "datasheet_url": "blob://aegis/sheets/civil-comments.md",
    },
    {
        "id": "readmission-v1",
        "name": "Hospital Readmission · UCI",
        "family": "tabular",
        "risk_class": "HIGH",
        "active_version": "1.0.1",
        "owner_id": "system:bootstrap",
        "model_card_url": "blob://aegis/cards/readmission-v1.md",
        "datasheet_url": "blob://aegis/sheets/diabetes-130-uci.md",
    },
)


async def seed_hero_scenario(session: AsyncSession) -> None:
    """Idempotently insert the three models, the Apple-Card decision, and its audit chain."""
    await _ensure_models(session)
    await _ensure_hero_decision_and_chain(session)
    await session.commit()


async def _ensure_models(session: AsyncSession) -> None:
    existing = {
        m.id for m in (await session.execute(select(ModelRow))).scalars().all()
    }
    for m in MODELS:
        if m["id"] in existing:
            continue
        session.add(ModelRow(**m))


async def _ensure_hero_decision_and_chain(session: AsyncSession) -> None:
    existing = await session.get(GovernanceDecisionRow, HERO_DECISION_ID)
    if existing is not None:
        return

    decision = GovernanceDecisionRow(
        id=HERO_DECISION_ID,
        model_id="credit-v1",
        policy_id="00000000-0000-4000-a000-000000000001",
        state="evaluated",
        severity="HIGH",
        drift_signal={"metric": "demographic_parity_gender", "value": 0.71, "baseline": 0.94, "psi": 0.18},
        causal_attribution={
            "method": "DoWhy GCM (Budhathoki AISTATS 2021)",
            "root_causes": [
                {"node": "P(co_applicant_income | applicant_gender)", "contribution": 0.71},
                {"node": "loan_purpose distribution", "contribution": 0.18},
                {"node": "credit_score binning", "contribution": 0.11},
            ],
        },
        plan_evidence={
            "chosen": "REWEIGH",
            "rationale": "Pareto-dominates RECAL on fairness; dominates RETRAIN on cost",
            "pareto_front": [...],  # snapshot from Phase 7
        },
        action_result={"steps": ["train_kc_preproc", "promote_canary_5", "..."], "post_dp_gender": 0.91},
        reward_vector={"acc": 0.001, "fairness": +0.20, "latency_ms": -2, "cost_usd": -0.4},
        observation_window_secs=3600,
        opened_at=NOW,
        evaluated_at=NOW + timedelta(hours=1, minutes=11, seconds=32),
    )
    session.add(decision)

    # Six audit rows — chain extends from the live head, never starts a new chain.
    writer = AuditWriter(session)
    await writer.append("system:detect-tabular", "detect", _detect_payload(decision))
    await writer.append("system:causal-attrib", "analyze", _analyze_payload(decision))
    await writer.append("system:action-selector", "plan", _plan_payload(decision))
    await writer.append("user:demo-operator", "approval", _approval_payload(decision))
    await writer.append("system:wdk-canary", "execute", _execute_payload(decision))
    await writer.append("system:wdk-evaluator", "evaluate", _evaluate_payload(decision))


def _detect_payload(d: GovernanceDecisionRow) -> dict[str, object]:
    return {
        "decision_id": str(d.id),
        "model_id": d.model_id,
        "summary": "DP_gender drops 0.94 → 0.71 in 24h window — severity HIGH",
    }
# ... helpers for the other five payloads — same shape, decision_id always set
```

(Detail: the six payloads each include enough context that the activity feed and the decision-detail page render exactly the spec §5.2 wall-clock walk.)

- [ ] **Step 3: Wire the seeder to the heartbeat cron**

```python
# services/control-plane/src/aegis_control_plane/routers/cron.py  (modify heartbeat handler)
@router.get("/internal/cron/heartbeat")
async def heartbeat(session: SessionDep) -> dict[str, str]:
    if os.environ.get("AEGIS_SEED_HERO", "false").lower() == "true":
        from aegis_control_plane.seed import seed_hero_scenario  # lazy import
        await seed_hero_scenario(session)
    return {"status": "ok"}
```

The `AEGIS_SEED_HERO` env var defaults to `false` in production; setup.md instructs the user to flip it to `true` exactly once during setup.

- [ ] **Step 4: Run tests + commit.**

```bash
git add services/control-plane/src/aegis_control_plane/{seed.py,routers/cron.py} \
        services/control-plane/tests/test_seed.py
git commit -m "feat(control-plane): Phase 5 — Apple-Card-2019 hero scenario seeder (idempotent)"
```

---

## Sub-phase 5j — End-to-end + Playwright + setup.md

### Task 21: Playwright walks the hero scenario on the live stack

**Files:**

- Create: `apps/dashboard/tests/e2e/live-stack.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/dashboard/tests/e2e/live-stack.spec.ts
import { test, expect } from "@playwright/test";

test.describe("hero scenario walks live", () => {
  test("/fleet renders three live model cards", async ({ page }) => {
    await page.goto("/fleet");
    await expect(page.getByText("Credit Risk · HMDA")).toBeVisible();
    await expect(page.getByText("Toxicity · DistilBERT")).toBeVisible();
    await expect(page.getByText("Hospital Readmission · UCI")).toBeVisible();
    await expect(page.locator("[data-testid=kpi-tile-accuracy]")).toBeVisible();
  });

  test("/incidents/<hero> walks all six MAPE-K phases", async ({ page }) => {
    await page.goto("/incidents/00000000-0000-4000-a000-000000000042");
    for (const stage of ["detect", "analyze", "plan", "approval", "execute", "evaluate"]) {
      await expect(page.getByTestId(`stage-${stage}`)).toBeVisible();
    }
    await expect(page.getByText(/Pareto-dominates RECAL/)).toBeVisible();
  });

  test("/audit verify button reports valid", async ({ page }) => {
    await page.goto("/audit");
    await page.getByRole("button", { name: /verify/i }).click();
    await expect(page.getByText(/chain verified/i)).toBeVisible({ timeout: 5_000 });
  });

  test("activity SSE shows new event after a transition", async ({ page, request }) => {
    await page.goto("/fleet");
    const activityCount = await page.locator("[data-testid=activity-event]").count();
    // Trigger a no-op transition that adds one audit row (uses an existing test-only endpoint).
    await request.post("/api/cp/internal/test/poke-transition");
    await expect(page.locator("[data-testid=activity-event]")).toHaveCount(activityCount + 1, {
      timeout: 3_000,
    });
  });
});
```

- [ ] **Step 2: Boot the live stack locally and run**

```bash
# terminal 1
docker run -p 5432:5432 -e POSTGRES_PASSWORD=aegis -e POSTGRES_DB=aegis postgres:16
# terminal 2
uv run --package aegis-control-plane alembic upgrade head
AEGIS_SEED_HERO=true uv run --package aegis-control-plane uvicorn aegis_control_plane.app:app --port 8000
# terminal 3
pnpm --filter @aegis/dashboard dev
# terminal 4
pnpm --filter @aegis/dashboard exec playwright test tests/e2e/live-stack.spec.ts
```

Expected: all four tests pass.

- [ ] **Step 3: Commit.**

```bash
git add apps/dashboard/tests/e2e/live-stack.spec.ts apps/dashboard/playwright.config.ts
git commit -m "test(e2e): Phase 5 — live stack walks the hero scenario"
```

### Task 22: setup.md "Phase 5 — control-plane wiring" section

**Files:**

- Modify: `setup.md`

- [ ] **Step 1: Append the Phase 5 section** with verbatim commands for: spinning up Postgres locally, running the Alembic migrations, starting the FastAPI server, exporting `AEGIS_SEED_HERO=true` for the first run, configuring Tinybird tokens, and running the dashboard against the live backend.

The section ends with: "If you can scrub through `/incidents/00000000-0000-4000-a000-000000000042` and watch all six MAPE-K phases, Phase 5 is wired correctly."

- [ ] **Step 2: Run the setup.md validator** (the nightly CI job from Phase 0).

Run: `bash scripts/validate-setup.sh`
Expected: every command in the new section executes successfully against a clean container.

- [ ] **Step 3: Commit.**

```bash
git add setup.md
git commit -m "docs(setup): Phase 5 — control-plane wiring section"
```

### Task 23: Tag and push

- [ ] **Step 1: Confirm CI green on the branch** (`gh pr checks` if there's an open PR; otherwise `git push` and watch Actions).

- [ ] **Step 2: Tag**

```bash
git tag -a phase-5-complete -m "Phase 5 — control-plane → dashboard wiring · live data end-to-end"
git push origin main --tags
```

---

## Self-review

### Spec coverage

| Spec §                                  | Requirement                                          | Task(s)     |
| --------------------------------------- | ---------------------------------------------------- | ----------- |
| 4.4.2 (schema is law)                   | Pydantic → JSON Schema → TypeScript pipeline         | 1, 2, 3     |
| 4.3 (control-plane row)                 | REST `/models /policies /decisions /audit /signals`  | 4, 5        |
| 4.3 (control-plane SSE row)             | `/stream` over /api/cp                               | 4, 12, 13   |
| 5.1 (decision lifecycle)                | Transition broadcasts + audit append                 | 13, 15      |
| 5.2 (hero scenario)                     | Apple-Card seed + walkable demo                      | 20, 21      |
| 6.1 (Postgres schema)                   | datasets table; activity reads governance_decisions  | 8, 9        |
| 6.2 (audit invariants)                  | Verify endpoint + CSV export + chain extends in seed | 16, 17, 20  |
| 10.1 (page inventory — fleet/audit/...) | Every page reads live                                | 6, 7, 8, 11 |
| 10.1 (compliance page)                  | Mapping endpoint                                     | 10          |
| 10.2 (activity bell · SSE-driven)       | EventSource hook                                     | 12          |
| 10.4 (ApprovalCard / AuditRow)          | Real onApprove / onDeny / verify                     | 15, 16      |

### Placeholder scan

No `TBD` / `TODO`. Every step shows the actual code or the actual command. The two places using `...` (causal-DAG nodes in MODELS, Pareto front in plan_evidence) are deliberate — those are large data structures lifted from `packages/shared-py/causal_dags` and Phase 7's action-selector output, which already exist; copy them verbatim from those modules at implementation time. **Do not invent values.**

### Type consistency

- `CandidateAction.kind` is the same string set everywhere: `'reweigh' | 'recalibrate' | 'retrain' | 'swap' | 'hold' | 'rollback'`. The dashboard's `ApprovalCard` already accepts that union.
- `ActivityEvent.type` is `'decision_open' | 'state_transition' | 'approval_decided' | 'metrics_degraded'`. The SSE broadcast in Task 13 emits exactly these values; the dashboard's `useActivityStream` typechecks against the codegen union.
- `Severity`, `DecisionState`, `RiskClass`, `Role` come from `@aegis/shared-ts` (auto-generated). No string-literal duplication anywhere.

### Scope check

Phase 5 ships a working live stack: every dashboard page reads from real backends, every action button writes through the audit chain, the activity feed streams live, and the hero scenario is reproducible from a fresh checkout. Phase 6 (causal attribution) and Phase 7 (Pareto policy) write into the exact same surfaces this plan wires — no further dashboard plumbing required for them.

---

## What lands in Phase 6 (next plan)

- `services/causal-attrib` — DoWhy GCM (Budhathoki AISTATS 2021) + DBShap fallback.
- Per-model causal DAG specs lifted from spec §12.1.
- `/incidents/[id]` page renders the Shapley waterfall on the real `causal_attribution` payload (already wired by Phase 5; Phase 6 just fills the field).
- First ablation result for the research extension.
