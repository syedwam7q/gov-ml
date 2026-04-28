# Aegis — Autonomous Self-Healing Governance for ML Systems

**Design Document**
**Date:** 2026-04-28
**Author:** syedwam7q
**Repo:** github.com/syedwam7q/gov-ml
**Status:** Approved at brainstorm completion · pre-implementation

---

## 0. One-paragraph summary

Aegis is a multi-domain ML governance platform that closes the **MAPE-K loop** autonomously — it monitors a fleet of three production models (credit risk, toxicity, hospital readmission) for drift, bias/fairness, calibration, and operational issues; attributes detected drift to specific _causal mechanisms_ via DoWhy GCM; selects a _Pareto-optimal_ remediation action via a contextual bandit with knapsack constraints; executes the action under canary rollout with KPI guards and approval gates for high-risk changes; and evaluates the outcome to feed back into the bandit's posterior. Everything runs on free-tier services. Every state transition writes a Merkle-chained audit log row. The combined system targets a research paper at FAccT / AIES / NeurIPS Datasets & Benchmarks; the **two novel research contributions** are the _cause → remediation mapping_ via causal-DAG attribution and the _Pareto-optimal action selection with regret bounds_ — neither has been combined in a closed-loop ML governance system before.

## 1. Goals & non-goals

**Goal.** Build, document, and benchmark a governance platform whose autonomous remediation decisions are (a) explainable via causal attribution, (b) Pareto-optimal across accuracy / fairness / latency / cost, (c) safe by construction (canary, audit log, approval gates), and (d) compliant by construction with EU AI Act high-risk requirements (Articles 9, 12, 13, 14, 15, 17, 72, 73), NIST AI RMF 1.0, and ISO/IEC 42001:2023.

**Non-goals.**

- Not a model-training platform — training is offline, in `ml-pipelines/`.
- Not a generic observability tool — Aegis is governance-specific.
- Not a model-hosting product — Aegis governs models, it doesn't sell hosting.
- Not LLM-application observability — Aegis works on classical/ML and DistilBERT-class transformer models; LLM-app observability is out of scope (SHML covers that with LLMs-as-diagnosticians).

**Quality bar.** "Perfection down to the last detail" — both the dashboard frontend and the governance/ML backend. Real-world citations only; no fabricated examples. Visual quality and information density both matter.

**Hard constraint.** $0 budget — only forever-free tiers; no trial credit, no paid plans.

## 2. Committed scope

| Dimension | Locked decision                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tier      | Tier 2 baseline + Tier 3 research extensions (causal attribution + Pareto-optimal action selection)                                                      |
| Topology  | Modular Platform (Option B from brainstorm): each MAPE-K phase is its own service                                                                        |
| Models    | 3 — `credit-v1` (XGBoost on HMDA / Lending Club), `toxicity-v3` (DistilBERT on Jigsaw Civil Comments), `readmission-v2` (XGBoost on Diabetes 130-US UCI) |
| Time      | 8–9 months                                                                                                                                               |
| Brand     | **Aegis** (display name) — repo stays `gov-ml`                                                                                                           |
| Aesthetic | Editorial Dark (Linear/Vercel/Anthropic-research style)                                                                                                  |
| Auth      | Clerk OTP (email) + 3-role RBAC (`viewer` / `operator` / `admin`)                                                                                        |
| Hosting   | Vercel Hobby (frontend + light Python services + workflows) + Hugging Face Spaces (DistilBERT + sentence-transformers) — free-tier only                  |

## 3. Conceptual framework — MAPE-K

The system follows the **MAPE-K** reference loop from Kephart & Chess (IBM, IEEE Computer 2003): _Monitor, Analyze, Plan, Execute_, sharing a _Knowledge_ plane. Each phase is a separate service in our deployment.

```
              ┌─────────────────── KNOWLEDGE ───────────────────┐
              │  Postgres (Neon): models, policies, audit log,  │
              │  decisions  ·  Tinybird: metrics  ·  Blob: art. │
              └─────────────────────────────────────────────────┘
                  ▲           ▲            ▲           ▲
                  │           │            │           │
              ┌───┴───┐   ┌───┴───┐    ┌───┴───┐   ┌───┴───┐
              │MONITOR│ → │ANALYZE│ →  │ PLAN  │ → │EXECUTE│
              └───────┘   └───────┘    └───────┘   └───────┘
              detect-{   causal-       action-      WDK
              tabular,   attrib        selector     workflows
              text}      (DoWhy)       (CB-Knap)    (canary,
              + NannyML  + DBShap      + Tchebychev  retrain,
              + Evidently fallback     baseline)     rollback)
```

The closest prior work — **SHML** (Rauba, Seedat, Kacprzyk, van der Schaar; NeurIPS 2024; arXiv:2411.00186) — uses LLM-driven diagnosis. Aegis differentiates along three orthogonal axes: causal-DAG attribution (vs. LLM diagnosis), Pareto-optimal action selection with regret bounds (vs. heuristic action choice), and a publicly reproducible benchmark suite of 10 induced-failure scenarios tied to real-world incidents.

## 4. Architecture

### 4.1 Repo layout

```
gov-ml/                                      github.com/syedwam7q/gov-ml
├── apps/
│   ├── dashboard/                           Next.js 16 — governance UI
│   │   ├── app/(chat)/chat/page.tsx         dedicated assistant page
│   │   └── components/assistant-drawer.tsx  Cmd+K slide-out
│   └── landing/                             Next.js 16 — public landing
├── services/
│   ├── control-plane/                       FastAPI · MAPE-K orchestrator
│   ├── detect-tabular/                      Evidently + NannyML + Fairlearn
│   ├── detect-text/                         Alibi-Detect MMD on embeddings
│   ├── causal-attrib/                       DoWhy GCM + DBShap            ★ research ext. 1
│   ├── action-selector/                     CB-Knapsack + Pareto front     ★ research ext. 2
│   ├── assistant/                           Vercel AI SDK + @ai-sdk/groq
│   ├── inference-credit/                    XGBoost on HMDA/Lending Club
│   ├── inference-readmission/               XGBoost on Diabetes 130-US
│   └── inference-toxicity/                  DistilBERT — runs on HF Spaces
├── packages/
│   ├── shared-py/                           Pydantic schemas + audit-chain writer
│   ├── shared-ts/                           TS types generated from shared-py
│   └── ui/                                  shared shadcn theme + components
├── workflows/                               Vercel WDK functions
│   ├── retrain.ts
│   ├── canary.ts
│   ├── rollback.ts
│   └── approval-gate.ts
├── ml-pipelines/                            offline notebook → script
│   ├── credit/
│   ├── readmission/
│   └── toxicity/
├── data/                                    download scripts; payloads gitignored
├── infra/
│   ├── tinybird/                            .datasource, .pipe, .endpoint
│   └── vercel/                              vercel.ts (typed config)
├── tests/
│   ├── safety/                              17 safety CI tests
│   ├── scenarios/                           10 induced-failure scenarios
│   ├── property/                            Hypothesis-based property tests
│   └── e2e/                                 Playwright
├── docs/
│   ├── superpowers/specs/                   design docs (this file)
│   ├── paper/                               LaTeX paper draft
│   └── compliance/                          EU AI Act / NIST / ISO mapping
├── setup.md                                 verbatim install + run instructions (CI-validated)
├── pnpm-workspace.yaml · turbo.json
├── pyproject.toml (uv workspace)
└── vercel.ts                                project config
```

### 4.2 Deployment topology — free-tier

| Service                                                                                                                                  | Hosted on                       | Free-tier confirmed                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/dashboard`, `apps/landing`                                                                                                         | Vercel Hobby                    | 100 GB-hr Functions, 100 GB bandwidth, 2 cron jobs                                                    |
| `services/control-plane`, `detect-tabular`, `causal-attrib`, `action-selector`, `assistant`, `inference-credit`, `inference-readmission` | Vercel Functions Python (Fluid) | within Hobby                                                                                          |
| `services/detect-text`, `services/inference-toxicity` (DistilBERT)                                                                       | Hugging Face Spaces             | unlimited free CPU Spaces, 16 GB RAM, persistent disk; sleep mitigated by Vercel Cron keep-alive ping |
| Workflows                                                                                                                                | Vercel WDK                      | billed as regular Vercel Function time                                                                |
| Hot metrics                                                                                                                              | Tinybird Build plan             | 10 GB/month processed, SQL→REST endpoints                                                             |
| Metadata + audit log                                                                                                                     | Neon Postgres                   | 0.5 GB storage, 191.9 compute-hours/month                                                             |
| Model artifacts, datasheets, snapshots                                                                                                   | Vercel Blob                     | 1 GB on Hobby                                                                                         |
| Cold archive                                                                                                                             | DuckDB on Vercel Blob           | within Blob limit                                                                                     |
| Auth                                                                                                                                     | Clerk                           | 10K MAUs, OTP, RBAC                                                                                   |
| LLM (Assistant)                                                                                                                          | Groq dev tier                   | Llama 3.3 70B + Llama 3.1 8B; daily token quotas adequate                                             |
| CI                                                                                                                                       | GitHub Actions                  | unlimited minutes (repo public)                                                                       |

### 4.3 Per-service component contracts

| #   | Service                          | Role                                                                 | Exposes                                                                                             | Reads                                 | Writes                                              | Key libs                                                            |
| --- | -------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `apps/dashboard`                 | Governance UI                                                        | 14 routes (Section 10)                                                                              | control-plane REST, Tinybird, SSE     | user actions → control-plane                        | Next.js 16, shadcn/ui, ECharts, Clerk, SWR                          |
| 2   | `apps/landing`                   | Public landing                                                       | `/`, `/about`, `/research`, `/docs/*`, `/login`                                                     | static MDX                            | —                                                   | Next.js 16 SSG, MDX, framer-motion                                  |
| 3   | `services/control-plane`         | MAPE-K orchestrator + RBAC + sole audit-log writer + SSE broadcaster | REST `/api/v1/{models,policies,incidents,decisions,audit,approvals,actions}` + SSE `/api/v1/stream` | Neon, Tinybird                        | Neon (audit + decisions), WDK triggers, SSE         | FastAPI, asyncpg, pydantic, sse-starlette                           |
| 4   | `services/detect-tabular`        | Drift + fairness + calibration on tabular                            | `/detect/run`, `/detect/backfill`                                                                   | Tinybird, Blob                        | Tinybird signals, control-plane events              | Evidently, NannyML CBPE, Fairlearn                                  |
| 5   | `services/detect-text`           | Text drift via MMD on embeddings + subgroup FPR                      | `/detect/text/run`                                                                                  | Tinybird, Blob, Neon                  | Tinybird signals, control-plane events              | alibi-detect, sentence-transformers (`all-MiniLM-L6-v2`), Fairlearn |
| 6   | `services/causal-attrib`         | Cause attribution (research ext. 1)                                  | `/attrib/run`                                                                                       | causal DAG (Postgres), Tinybird, Blob | attribution result → control-plane                  | `dowhy.gcm.distribution_change`, networkx, custom DBShap            |
| 7   | `services/action-selector`       | Pareto action selection (research ext. 2)                            | `/select`                                                                                           | action history (Postgres)             | chosen action → control-plane                       | custom CB-Knapsack, pymoo, Tchebycheff                              |
| 8   | `services/assistant`             | Groq-powered tool-using agent                                        | `/chat` (SSE stream)                                                                                | control-plane, Tinybird, Postgres     | conversation log → Postgres                         | Vercel AI SDK, `@ai-sdk/groq`                                       |
| 9   | `services/inference-credit`      | XGBoost credit-risk                                                  | `/predict`, `/model-card`                                                                           | model artifact (Blob)                 | predictions → Tinybird                              | xgboost, scikit-learn, fastapi                                      |
| 10  | `services/inference-readmission` | XGBoost readmission                                                  | same shape                                                                                          | same                                  | same                                                | same                                                                |
| 11  | `services/inference-toxicity`    | DistilBERT toxicity (HF Spaces)                                      | `/predict`, `/model-card`                                                                           | model artifact (HF Hub or Space disk) | predictions → Tinybird                              | transformers, torch, fastapi                                        |
| 12  | `workflows/*` (Vercel WDK)       | Durable orchestration: retrain, canary, rollback, approval-gate      | WDK function entrypoints                                                                            | Blob, control-plane                   | new model versions, traffic-shift, approval records | `@vercel/workflow`                                                  |

**Shared packages.** `packages/shared-py` owns the single source-of-truth Pydantic schemas for every event/decision/audit record/signal, plus the Merkle-chained audit-log writer. `packages/shared-ts` mirrors those schemas as TypeScript types (auto-generated via `datamodel-code-generator`) — drift between services is impossible. `packages/ui` owns shadcn theme + reusable governance components.

### 4.4 Cross-cutting design rules

1. **Single writer, single chain.** Only `control-plane` writes the audit log; every other service emits an event that control-plane validates and chains.
2. **Schema is law.** Schema change in `shared-py` auto-regenerates `shared-ts`, fails frontend `tsc` if dashboard not updated. No silent contract drift.
3. **Inter-service auth.** Function-to-Function via short-lived HMAC tokens with rotating Vercel-env secrets. Browser-to-control-plane via Clerk session tokens. HF Spaces calls via signed URLs.
4. **All state in three places only:** Tinybird (hot metrics), Neon (metadata + audit), Blob (artifacts). No service has its own DB.
5. **Every service exposes `/healthz` + `/readyz`** with three-state readiness (deps OK / degraded / down). The dashboard's fleet-health tile reads these.
6. **`setup.md` is a CI artifact.** A nightly GitHub Action runs `setup.md`'s commands in a clean container and fails the build if any step breaks.

## 5. Data flow — `GovernanceDecision` lifecycle

The central artifact is `GovernanceDecision`, with five durable states: `detected → analyzed → planned → executing → evaluated`. Every state transition appends one Merkle-chained audit row. The full lifecycle is the MAPE-K loop in motion.

### 5.1 The seven phases

| #   | Phase                                                         | Trigger                                                    | Services involved                                                | Audit row(s) appended                             |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| 0   | Continuous logging                                            | Every prediction                                           | inference-\* → Tinybird                                          | none (predictions live in Tinybird)               |
| 1   | **Monitor**                                                   | Vercel Cron every 5 min, or threshold-event from inference | control-plane → detect-tabular / detect-text → Tinybird          | `detect` row when severity ≥ MEDIUM               |
| 2   | **Analyze**                                                   | New decision in `detected` state                           | control-plane → causal-attrib                                    | `analyze` row with attribution payload            |
| 3   | **Plan**                                                      | New decision in `analyzed` state                           | control-plane → action-selector                                  | `plan` row with chosen action + Pareto front      |
| 4   | **Approval gate** _(if action.risk_class ∈ {HIGH, CRITICAL})_ | Plan stage produced a high-risk action                     | control-plane → WDK (`approval-gate`) → dashboard SSE → operator | `approval` row with operator id + justification   |
| 5   | **Execute**                                                   | Approval granted (or auto if LOW/MEDIUM risk)              | WDK workflow → inference-\*                                      | `execute` row(s) — one per WDK step               |
| 6   | **Evaluate**                                                  | After fixed observation window                             | WDK → detect-\* re-run → action-selector reward update           | `evaluate` row — chain _closed_ for this decision |

### 5.2 Hero scenario — Apple-Card-2019 replay

The replay is the marquee demo and the opening figure of the paper:

```
12:03:00  detect-tabular runs scheduled check on inference-credit
          DP_gender drops 0.94 → 0.71 in 24h window
          severity=HIGH                        → state=detected

12:03:04  causal-attrib loads credit-DAG, runs DoWhy GCM
          71% of the drift is attributed to a SHIFT IN
          P(co_applicant_income | applicant_gender)
          (a recent marketing campaign targeted single-applicant women)
                                                → state=analyzed

12:03:07  action-selector runs CB-Knapsack with constraints
          {acc_floor=0.86, fair_floor=0.80, lat_ceil=120ms, cost_ceil=$5}
          chosen=REWEIGH (Pareto-dominates RECAL on fairness;
          dominates RETRAIN on cost; SWAP rejected — no healthier challenger
          on this slice)                         → state=planned

12:03:09  REWEIGH risk_class=MEDIUM → bypasses approval gate
          WDK workflow starts: train Kamiran-Calders preproc on rolling
          window → emit candidate model

12:14:32  candidate passes QC; canary 5%→25%→50%→100%
          (auto-rollback armed throughout)       → state=executing

13:14:32  observation window closes; post-action DP_gender = 0.91
          reward vector written; CB-Knapsack posterior updated
                                                → state=evaluated · chain closed

  Total wall-clock: 1h 11m, fully autonomous, fully audited.
  Compare to industry: Apple Card 2019 → NYDFS 2021 → CFPB fine 2024 = ~5 years.
```

The dashboard's `/incidents/0042` page lets a user scrub through every phase of this replay, with all artifacts (drift signature, Shapley waterfall, Pareto front, audit chain) on screen.

## 6. Knowledge plane

### 6.1 Postgres schema (structurally significant columns)

```sql
CREATE TABLE models (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  family          text NOT NULL,                 -- 'tabular' | 'text'
  risk_class      text NOT NULL,                 -- 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  active_version  text NOT NULL,
  owner_id        text NOT NULL,                 -- Clerk user id
  causal_dag      jsonb,                         -- per-model DAG used by causal-attrib
  model_card_url  text NOT NULL,                 -- Vercel Blob, Mitchell 2019 schema
  datasheet_url   text,                          -- Vercel Blob, Gebru 2021 schema
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE model_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id        text NOT NULL REFERENCES models(id),
  version         text NOT NULL,
  artifact_url    text NOT NULL,                 -- Vercel Blob
  training_data_snapshot_url text NOT NULL,
  qc_metrics      jsonb NOT NULL,                -- accuracy, fairness, calibration at promotion
  status          text NOT NULL,                 -- 'staged' | 'canary' | 'active' | 'retired'
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(model_id, version)
);

CREATE TABLE governance_decisions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id                 text NOT NULL REFERENCES models(id),
  policy_id                uuid NOT NULL REFERENCES policies(id),
  state                    text NOT NULL,        -- 'detected' | 'analyzed' | 'planned' |
                                                  --  'awaiting_approval' | 'executing' | 'evaluated'
  severity                 text NOT NULL,
  drift_signal             jsonb NOT NULL,
  causal_attribution       jsonb,                -- filled at state=analyzed
  plan_evidence            jsonb,                -- chosen action + Pareto front + rationale
  action_result            jsonb,                -- what executed
  reward_vector            jsonb,                -- closed loop
  observation_window_secs  int  NOT NULL,        -- fixed at decision time
  opened_at                timestamptz NOT NULL DEFAULT now(),
  evaluated_at             timestamptz
);

CREATE TABLE audit_log (
  sequence_n      bigserial PRIMARY KEY,
  decision_id     uuid REFERENCES governance_decisions(id),
  ts              timestamptz NOT NULL DEFAULT now(),
  actor           text NOT NULL,                 -- 'system:control-plane' | 'user:<clerk_id>'
  action          text NOT NULL,
  payload         jsonb NOT NULL,                -- canonicalized
  prev_hash       text NOT NULL,                 -- hex
  row_hash        text NOT NULL,                 -- sha256(prev || canon(payload) || ts || actor || action || sequence_n)
  signature       text NOT NULL                  -- HMAC-SHA256(row_hash, $AUDIT_LOG_HMAC_SECRET)
);
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

CREATE TABLE approvals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id     uuid NOT NULL REFERENCES governance_decisions(id),
  required_role   text NOT NULL,                 -- 'operator' | 'admin'
  requested_at    timestamptz NOT NULL DEFAULT now(),
  decided_at      timestamptz,
  decided_by      text,                          -- Clerk user id
  decision        text,                          -- 'approved' | 'denied' | 'held'
  justification   text                           -- required free-text
);

CREATE TABLE policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id        text NOT NULL REFERENCES models(id),
  version         int  NOT NULL,
  active          bool NOT NULL DEFAULT false,
  mode            text NOT NULL DEFAULT 'dry_run',  -- 'live' | 'dry_run' | 'shadow'
  dsl_yaml        text NOT NULL,
  parsed_ast      jsonb NOT NULL,                -- compiled at write time
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL,
  UNIQUE(model_id, version)
);

CREATE TABLE action_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id     uuid NOT NULL REFERENCES governance_decisions(id),
  model_id        text NOT NULL,
  context         jsonb NOT NULL,                -- drift signature + cause vector
  action          text NOT NULL,
  reward          jsonb,                         -- {Δacc, Δfairness, Δlatency, Δcost}
  observed_at     timestamptz
);

CREATE TABLE assistant_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,                 -- Clerk user id
  context         jsonb,                         -- e.g., scoped to /incidents/{id}
  messages        jsonb NOT NULL,                -- array of {role, content, tool_calls}
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### 6.2 Audit log invariants

1. **Append-only at DB level** — `RULE`s block UPDATE / DELETE.
2. **Hash chain** — `row_hash = SHA256(prev_hash ‖ canonical_json(payload) ‖ ts ‖ actor ‖ action ‖ sequence_n)`. Genesis `prev_hash = "0".repeat(64)`.
3. **HMAC signature** — `signature = HMAC-SHA256(row_hash, $AUDIT_LOG_HMAC_SECRET)`. Secret rotates yearly; rotation is itself an audit-log event.
4. **External anchor (daily).** A nightly GitHub Action (`.github/workflows/chain-anchor.yml`) reads the current `row_hash` of the latest audit-log entry and posts it to a public Actions artifact, providing external timestamping. Tampering with rows older than the last anchor would require breaking the external GitHub record.
5. **CI test** — `tests/safety/test_chain_invariant.py::test_chain_integrity_random_tampering` runs `verify_chain()` over the entire log and is merge-blocking.
6. **Retention** — ≥ 180 days online (Postgres) + ≥ 5 years cold (DuckDB on Vercel Blob with the same chain). Satisfies EU AI Act Art. 12 (≥ 6 months) with margin.

### 6.3 Policy DSL

YAML-based, parsed and type-checked at write time, stored as `dsl_yaml` (source) + `parsed_ast` (compiled AST) in `policies`. Example:

```yaml
name: credit-risk-fairness
model_id: credit-v1
version: 7
active: true
mode: live # 'dry_run' | 'shadow' | 'live'  · default 'dry_run'

triggers:
  - signal: demographic_parity_gender
    op: less_than
    threshold: 0.80
    severity: HIGH
    window: 24h
  - signal: equal_opportunity_race
    op: less_than
    threshold: 0.85
    severity: HIGH
    window: 24h
  - signal: psi_total
    op: greater_than
    threshold: 0.20
    severity: MEDIUM
    window: 7d

preconditions:
  model_state: active
  cooldown: 1h
  max_actions_per_day: 5

constraints: # passed to action-selector
  accuracy_floor: 0.86
  fairness_floor: 0.80
  latency_ceiling_ms: 120
  cost_ceiling_usd: 5.00

allowed_actions:
  - recalibrate
  - reweigh
  - reject_option
  - feature_drop:
      protected_features: [zip5_proxy]
  - retrain:
      requires_approval: { role: operator }
  - champion_swap:
      requires_approval: { role: admin }
  - rollback # always autonomous; rollback IS the safety net

emergency_stop:
  on_signal: catastrophic_drift
  action: quarantine_and_route_to_fallback
```

The DSL is parsed into a typed AST at write time; syntax errors fail the API call. Each `signal` is type-checked against the model's known signal taxonomy; each `action` against the action-selector's action set. **`policies` is the only mutable governance config in the system** — everything else is append-only.

## 7. Safety, error handling, canary mechanics

### 7.1 Eight-layer safety stack

**L1. Action-level invariants.** Every action is _idempotent_ (`idempotency_key = sha256(decision_id ‖ action_type ‖ nonce)`), _reversible_ (every mutating action stores its undo record in `action_result.undo`), _bounded_ (declared max-runtime / max-cost / max-traffic-shift; WDK enforces deadlines via `step.run({ timeout })`), and _audited_ (no execution without a preceding `state=planned` audit row whose `row_hash` matches the action's claim).

**L2. Risk-class table.**

| Action                    | Risk     | Approval                               | Rollback strategy               |
| ------------------------- | -------- | -------------------------------------- | ------------------------------- |
| `no_op`                   | LOW      | —                                      | —                               |
| `rollback`                | LOW      | —                                      | —                               |
| `recalibrate`             | LOW      | —                                      | revert threshold                |
| `reject_option`           | LOW      | —                                      | revert abstain band             |
| `feature_drop`            | MEDIUM   | —                                      | unmask feature                  |
| `reweigh`                 | MEDIUM   | —                                      | revert to prior model           |
| `canary_promote`          | HIGH     | operator                               | revert traffic + active version |
| `retrain`                 | HIGH     | operator                               | revert to prior active version  |
| `champion_swap`           | CRITICAL | admin                                  | revert active version           |
| `emergency_stop`          | CRITICAL | admin (manual only — never autonomous) | manual clear by admin           |
| `quarantine_and_fallback` | CRITICAL | autonomous (admin to lift)             | manual clear by admin           |

**L3. Canary rollout** — for any action that mutates a model artifact (`canary_promote`, `retrain`, `champion_swap`):

```
Step 0: deploy candidate to "canary" slot (0% traffic, observability only)
Step 1: 5%   → hold T_min → check KPI guards
Step 2: 25%  → hold T_min → check KPI guards
Step 3: 50%  → hold T_min → check KPI guards
Step 4: 100% → promote to active, retire previous

KPI guards (re-evaluated at every hold):
  candidate.accuracy        ≥  active.accuracy        − tolerance_acc
  candidate.fairness_min    ≥  floor_fairness         − tolerance_fair
  candidate.p99_latency_ms  ≤  active.p99_latency_ms  × tolerance_lat
  candidate.error_rate      ≤  active.error_rate      × tolerance_err
```

Any guard fails → immediate rollback. `T_min` defaults to 5 min in demo, 30 min in production.

**L4. Rate limits & cooldowns** — enforced before workflow trigger:

```
allow_action(model, action) ↔
  time_since_last_action(model) ≥ policy.cooldown
  AND actions_today(model)       <  policy.max_actions_per_day
  AND open_decisions(model)      <  policy.max_open_decisions      (default 1)
  AND NOT model.quarantined
  AND NOT global.emergency_stop
```

Rejected triggers are themselves audit-logged with `action='suppressed'` + reason.

**L5. Emergency stop & quarantine.** Emergency stop is `EMERGENCY_STOP=true` Vercel env (admin-only via dashboard switch backed by Clerk role check); halts cron-triggered detection, aborts in-flight WDK workflows at next `step.run` boundary, surfaces a full-width red banner. Quarantine is autonomous when `≥ 3 HIGH severity events on the same model in 1h`, or any CRITICAL signal, or `≥ 2 successful auto-rollbacks within 6h`; routes traffic to fallback; admin-only to lift.

**L6. Failure handling matrix** — graceful degradation per dependency:

| Dep down                | Behavior                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Tinybird                | detection circuit-breaks; serve cached signals from Postgres (5-min TTL); emit `metrics_degraded` SSE event           |
| HF Spaces               | wake-up retry (5 s, 15 s, 45 s); if still down, mark detection run `skipped`; toxicity panel shows "detection-paused" |
| causal-attrib timeout   | fall back to DBShap (~3–5 s); if also fails, advance with `attribution_quality=degraded`                              |
| action-selector failure | fail-closed: do nothing; escalate to `awaiting_approval` regardless of risk class                                     |
| WDK workflow crash      | durable re-execution from last checkpoint (built-in)                                                                  |
| audit-log write fails   | refuse to advance the decision state; return 503                                                                      |
| Postgres down           | control-plane returns 503; predictions continue (independent path)                                                    |

**L7. Dry-run mode** — every policy has `mode: live | dry_run | shadow`. New / changed policies start in `dry_run` by default; CI test asserts no policy ships to `live` without ≥ 7 days of `dry_run` history.

**L8. Safety CI tests (the 17).** All blocking on PR merge:

```
test_idempotency_key_dedup                   test_canary_rollback_on_acc_breach
test_every_action_has_registered_undo        test_canary_rollback_on_fairness_breach
test_action_deadlines_enforced               test_canary_rollback_on_latency_breach
test_chain_integrity_random_tampering        test_cooldown_enforced
test_max_actions_per_day_enforced            test_emergency_stop_aborts_inflight
test_quarantine_routes_to_fallback           test_tinybird_outage_degrades_gracefully
test_hf_spaces_cold_recovery                 test_causal_attrib_timeout_falls_back
test_audit_write_failure_blocks_state_advance test_dry_run_writes_no_inference_state
test_no_policy_goes_live_without_dry_run_log
```

These are the empirical backing of the paper's "safety guarantees" claim — not just internal hygiene.

## 8. Testing strategy

### 8.1 Test pyramid

| Tier                | Scope                                                                     | Runner                      | Run on               |
| ------------------- | ------------------------------------------------------------------------- | --------------------------- | -------------------- |
| Unit                | pure functions                                                            | pytest, vitest              | every PR             |
| Contract            | Pydantic ↔ TS-type round-trip                                             | pytest + `tsc --noEmit`     | every PR             |
| Integration         | one service against ephemeral Neon branch + Tinybird mock                 | pytest                      | every PR             |
| E2E                 | full stack with replayed prediction stream, decision lifecycle assertions | pytest-asyncio + Playwright | nightly + on `main`  |
| Smoke (post-deploy) | `/healthz` on every service + Apple-Card replay + dashboard render        | Playwright                  | every Vercel preview |

### 8.2 ML-specific tests

`test_model_regression_credit` · `test_fairness_regression_credit` · `test_calibration_regression_credit` · `test_subgroup_fpr_toxicity` (Borkan-style subgroup AUC + BPSN/BNSP for 8 identity dimensions) · `test_calibration_subgroup_readmission` (the Obermeyer/Optum failure mode) · `test_drift_detector_sensitivity` (inject known PSI=0.30 shift, assert detector fires within 1 cycle) · `test_drift_detector_specificity` (false-positive rate < 5% over 200 stable runs).

### 8.3 Induced-failure scenario library (10)

Each scenario is a deterministic, replayable fixture: starting state + scripted prediction stream + expected lifecycle outcome. Used for nightly E2E, demo, and the paper's empirical evidence.

```
tests/scenarios/
├── apple_card_2019/             gender disparity in credit limits, NYDFS 2021
├── obermeyer_optum_2019/        cost-as-proxy bias in healthcare risk
├── dixon_identity_terms_2018/   toxicity false positives on identity terms
├── sap_aave_2019/               AAVE dialect false-positive bias
├── markup_hmda_2021/            Latino/Black/Native disparate-denial
├── covid_macro_drift_2020/      macroeconomic concept drift
├── feature_proxy_zip5/          zipcode emerges as race proxy mid-deployment
├── catastrophic_label_collapse/ entire class disappears (quarantine test)
├── adversarial_prompt_jigsaw/   toxicity jailbreak attempts
└── policy_dryrun_to_live/       7-day dry-run promotion path
```

Each scenario file declares: `id`, `cite` (canonical reference), `starting_state`, `prediction_stream` (24 h synthetic), `expected_lifecycle` (state transitions to assert), `expected_audit_chain_length`.

### 8.4 Property-based tests (research extensions)

```
test_causal_attribution_efficiency_axiom    sum(shap_attribution) ∈ [0.95, 1.05]
test_causal_attribution_symmetry            permuting node order → same attributions
test_bandit_regret_bounded                  R(T) ≤ O(√(T·log T)) on synthetic env
test_pareto_front_non_dominated             computed front contains all true non-dominated
test_tchebycheff_pareto_optimality          any positive w → on the front
test_constraint_satisfaction                actions never violate floors in expectation
```

These properties are _claims in the paper_; each cites the underlying theorem.

### 8.5 Dashboard tests

`vitest` + `@testing-library/react` for components; `Playwright + toHaveScreenshot()` for visual snapshot regression on critical pages; `Playwright` E2E flows (OTP login → fleet load → approve a decision → see audit row → ask the assistant about it); `@axe-core/playwright` for WCAG 2.1 AA on Light + Dark themes.

### 8.6 `setup.md` validator (nightly)

A nightly GitHub Action runs `setup.md`'s commands verbatim in a fresh Ubuntu container; fails if any step breaks. Setup-doc rot dies here.

### 8.7 CI organization

```
.github/workflows/
├── pr.yml             unit + contract + integration + lint   (~5 min)
├── e2e.yml            full E2E + scenarios                    (~15 min, on main + nightly)
├── safety.yml         the 17 safety tests                     (every PR, blocking)
├── ml-regression.yml  ML model + fairness + calibration       (PRs touching ml-pipelines)
├── setup-validator.yml nightly setup.md replay
├── chain-anchor.yml    daily: post the audit-log Merkle head to a public artifact
└── scenarios.yml       nightly: replay every scenario, write docs/scenarios-report.md
```

We target 100% line coverage on safety-critical paths (audit chain, action invariants, risk-class enforcement, bandit/causal correctness) and ≥ 80% elsewhere. We do **not** mock the underlying models in fairness regression tests, and we do **not** chase 100% coverage in non-critical code.

## 9. Landing page + auth

### 9.1 Page structure (9 sections)

1. **Hero** — animated MAPE-K loop SVG, headline, two CTAs: `Try the live demo` (sandboxed read-only dashboard with Apple-Card pre-loaded) + `Read the paper` (PDF).
2. **Live mini-demo** — embedded scrubber of the Apple-Card replay (Phase 0 → Phase 6) on the page, no auth.
3. **The problem** — Apple Card 2019 / Optum 2019 / Borkan 2019 — each with citation, editorial framing, and the metric that would have caught it.
4. **The system** — interactive MAPE-K diagram; hovering a phase reveals the services + libraries.
5. **Architecture** — Modular Platform diagram with clickable nodes → service contract popovers.
6. **Research extensions** — Causal attribution + Pareto policy with KaTeX math + paper anchor links.
7. **Benchmark results** — the 10 induced-failure scenarios as a live grid (`caught: ✓`, `time-to-resolve`, `chain length`); each links to a dashboard replay.
8. **Compliance mapping** — table EU AI Act / NIST RMF / ISO 42001 → which dashboard panel satisfies it.
9. **CTA + footer** — OTP login, GitHub, paper PDF, `setup.md`, contributors, MIT license.

### 9.2 OTP auth flow (Clerk, email-OTP)

```
landing/login  ──email──▶  Clerk: send 6-digit OTP to email
                                  │
                            user enters OTP
                                  │
              Clerk verifies ─────┼────► failure: rate-limit + retry UI
                                  ▼
              First-time?  ─yes─▶ /onboarding
                                    pick display name
                                    role: viewer (default)
                                    accept responsible-use notice
                                    land on /fleet
              Returning?   ─yes─▶ /fleet (or last visited route)
```

Roles: `viewer` (read everything), `operator` (approve HIGH actions), `admin` (approve CRITICAL actions, manage policies, set emergency stop). Role upgrades are admin-only and audit-logged. Session is Clerk JWT; SSE re-validates every 5 min.

**Demo mode:** `Try the live demo` issues a short-lived `viewer-demo` Clerk anonymous JWT; visitor scrolls the dashboard with Apple-Card scenario pre-loaded, no signup, no write actions.

### 9.3 Aesthetic — Editorial Dark

Inter (body), JetBrains Mono (technical labels), Source Serif 4 (sparingly, editorial-only). Surfaces `#0a0a0c` / `rgba(255,255,255,.02)` / `rgba(255,255,255,.04)`. Stroke `rgba(255,255,255,.08)`. Single accent `#7fb4ff`. Severity colors gray/amber/red/red-glow used sparingly.

### 9.4 Brand — Aegis

Display name **Aegis** ("the protective shield for your ML"). Repo stays `gov-ml`.

## 10. Dashboard

### 10.1 Page inventory (14 routes)

| Route             | Role                                                                                                                                       | Audience                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `/`               | Public landing                                                                                                                             | Visitors, reviewers       |
| `/login`          | OTP entry                                                                                                                                  | Anyone                    |
| `/onboarding`     | First-run profile                                                                                                                          | First-time users          |
| `/fleet`          | Default-after-login fleet overview                                                                                                         | viewer / operator / admin |
| `/models/[id]`    | Model detail (10 tabs: Overview, Drift, Fairness, Calibration, Performance, Causal DAG, Audit, Versions, Datasets, Policies)               | viewer +                  |
| `/incidents`      | Decisions list, filterable                                                                                                                 | viewer +                  |
| `/incidents/[id]` | Decision detail — full MAPE-K timeline with causal attribution waterfall, Pareto front, action result, post-action evaluation, audit chain | viewer +                  |
| `/approvals`      | Pending approval queue                                                                                                                     | operator / admin          |
| `/audit`          | Immutable chain feed, hash-chain viz, `verify_chain` button, CSV/JSON export                                                               | viewer +                  |
| `/policies`       | Monaco YAML editor + live trigger preview + dry-run/live toggle                                                                            | operator / admin          |
| `/datasets`       | Datasheets per Gebru 2021, drift-between-snapshots view                                                                                    | viewer +                  |
| `/compliance`     | Regulatory mapping table, generate-PDF report                                                                                              | viewer +                  |
| `/chat`           | Full-screen Groq assistant w/ tool-call rendering                                                                                          | viewer +                  |
| `/settings`       | Profile, notifications, team, API tokens, emergency-stop switch (admin)                                                                    | viewer / admin            |

### 10.2 Persistent UI

- **Top nav** with route, breadcrumb, time-range selector, activity bell (SSE-driven), user menu.
- **Cmd+K Assistant Drawer** — slides in from right on any page, scoped to current view.
- **Cmd+J Command Palette** — fast nav, search, role-aware actions.
- **Global emergency-stop banner** (full-width red) when active.

### 10.3 Design system

| Token              | Value                                         |
| ------------------ | --------------------------------------------- |
| Type — body        | Inter 400/500                                 |
| Type — display     | Inter 600/700, tight tracking                 |
| Type — mono        | JetBrains Mono 400/500                        |
| Type — display alt | Source Serif 4 (editorial only)               |
| Surface 0          | `#0a0a0c`                                     |
| Surface 1          | `rgba(255,255,255,0.02)`                      |
| Surface 2          | `rgba(255,255,255,0.04)`                      |
| Stroke             | `rgba(255,255,255,0.08)`                      |
| Accent             | `#7fb4ff` (single)                            |
| Severity LOW       | `#94a3b8`                                     |
| Severity MEDIUM    | `#fbbf24`                                     |
| Severity HIGH      | `#f87171`                                     |
| Severity CRITICAL  | `#ef4444` + glow + subtle pulse               |
| Status OK          | `#34d399`                                     |
| Sparkline gradient | `#7fb4ff` → `#a78bfa`                         |
| Radius             | 8 px (cards) / 6 px (controls) / 4 px (pills) |
| Depth              | stroke + surface alpha (no shadows)           |

### 10.4 Component library (`packages/ui`)

`KPITile` · `Sparkline` · `BarSparkline` · `SeverityPill` · `StatePill` · `ModelCard` · `DecisionCard` · `ApprovalCard` · `AuditRow` · `HashBadge` · `TimelineScrubber` · `ParetoChart` · `ShapleyWaterfall` · `FairnessHeatmap` · `CalibrationPlot` · `DistributionDiff` · `CausalDAGViewer` · `PolicyEditor` (Monaco) · `AssistantDrawer` · `CommandPalette` · `ActivityFeed` · `EmergencyBanner`.

## 11. Governance Assistant

### 11.1 Architecture

`services/assistant` (FastAPI on Vercel Functions Python) uses Vercel AI SDK + `@ai-sdk/groq` to call Groq directly (free dev tier). Two models in rotation: **Llama 3.3 70B Versatile** for quality answers, **Llama 3.1 8B Instant** for fast tool-call pre-step. Streaming responses to the dashboard via SSE.

### 11.2 Tools (the 7 grounded tools)

```
get_fleet_status()                    → control-plane
get_model_metrics(model_id, window)   → Tinybird endpoint
get_decision(decision_id)             → control-plane
get_audit_chain(decision_id)          → control-plane
list_pending_approvals()              → control-plane
get_pareto_front(decision_id)         → action-selector via control-plane
explain_drift_signal(model_id, type)  → causal-attrib
```

System prompt enforces _every claim must reference a tool result_; the assistant cannot hallucinate state. Refusal pattern for off-topic queries that would require hallucination.

### 11.3 UI

`apps/dashboard/app/(chat)/chat/page.tsx` — full-screen chat with thread history. `apps/dashboard/components/assistant-drawer.tsx` — Cmd+K slide-out reachable from every dashboard page; opens scoped to the current view (e.g., on `/incidents/0042` the assistant arrives with that decision in scope).

### 11.4 Research framing

The assistant is positioned as a **grounded natural-language oversight interface**, satisfying EU AI Act Art. 13 (transparency) and Art. 14 (human oversight) for _end users_ (not just engineers). Cited in the paper as a deliberate design contribution, not a generic chatbot.

## 12. Research extensions

### 12.1 Extension 1 — Causal root-cause attribution

**Problem.** Given an observed distribution shift in `P(Y|X)` or in a fairness metric, attribute the change to specific causal mechanisms in the data-generating process.

**Setup.** Each model has an associated DAG `G = (V, E)` stored in `models.causal_dag`. Each node has an additive-noise structural equation `V_i = f_i(PA(V_i)) + N_i`. We fit FCMs on a reference window `D_ref` and the current window `D_cur`.

**Attribution (Budhathoki et al. AISTATS 2021):**

```
ϕ_i  =  (1 / |V|!) · Σ_{π∈Π}  [ v(S_π,i ∪ {i}) − v(S_π,i) ]
```

`v(S)` is the target metric obtained by swapping mechanisms in `S` from `f^ref` to `f^cur` (others held at `f^ref`). Shapley values satisfy efficiency: `Σ ϕ_i = Δtarget` — CI-tested.

**Implementation.** `dowhy.gcm.distribution_change(causal_model, old_data, new_data, target_node, num_samples)`. Wrapped with caching by `(model_id, ref_hash, cur_hash, target)`, hard timeout (default 30 s), and a fallback path.

**Fallback — DBShap** (Edakunni et al., arXiv:2401.09756, 2024). Distinguishes virtual `P(X)` drift from real `P(Y|X)` drift via Shapley over distributions, no DAG required. Decision marked `attribution_quality=degraded`.

**Cause → remediation mapping** (this is the novel contribution):

| Dominant cause                        | Action                    | Rationale                        |
| ------------------------------------- | ------------------------- | -------------------------------- |
| Upstream covariate shift `P(X_i)`     | reweigh (Kamiran-Calders) | repair input dist, not the model |
| Conditional mechanism shift `P(Y\|X)` | retrain                   | the relationship moved           |
| Label-prior shift `P(Y)`              | recalibrate               | adjust threshold; cheap          |
| Proxy-attribute correlation shift     | feature_drop              | remove the proxy                 |
| Calibration mechanism shift only      | calibration patch         | targeted, cheap                  |
| Multi-cause / high uncertainty        | reject_option             | abstain; route to human          |
| No clear primary cause                | escalate to operator      | don't act blind                  |

Encoded in `services/causal-attrib/cause_mapping.py` and itself an artifact in the paper.

**Ablation.** On the 10-scenario library: `causal-driven` (full) vs. `dbshap-driven` (no DAG) vs. `shap-only` (no causal model) vs. `random-action` vs. `always-retrain` vs. `always-reweigh` vs. `detect-only`. Metrics: time-to-resolve, post-action fairness floor compliance, total constraint violations, false-remediation count, audit-chain length.

### 12.2 Extension 2 — Pareto-optimal action selection

**Problem.** At time `t`, given context `x_t = (drift_signature, cause_vector, model_state)`, select `a_t ∈ A` (action set of size 8) to maximize the vector reward `r(x_t, a) = (Δacc, Δfair, −Δlatency, −Δcost)` subject to budget and floor constraints.

**Method — Contextual Bandits with Knapsacks** (Agrawal & Devanur NeurIPS 2016; Slivkins, Sankararaman, Foster JMLR 2024 — vol 25, paper 24-1220). Lagrangian:

```
maximize_a   E[ r(x, a) − λᵀ · c(x, a) ]
```

Algorithm:

1. Maintain regression oracle for `r̂(x, a)` and `ĉ(x, a)` (Bayesian linear regression).
2. Choose `a* = argmax_a (r̂(x,a) − λᵀ ĉ(x,a)) + UCB_bonus(x,a)`.
3. After observation window, observe `(r, c)`; update regressors; update dual via projected gradient `λ ← max(0, λ + η(ĉ − budget/T))`.
4. **Regret** `R(T) = O(√(T·log T)·k)` (Slivkins et al. 2024, Thm. 3.1) — a paper claim, validated by `test_bandit_regret_bounded`.

**Offline pre-training** (Cai et al. AAAI 2025) — initialize regressors from logged remediation outcomes from synthetic-stream rehearsals. Critical: we cannot run live A/B tests on a credit-risk model.

**Baseline — Tchebycheff scalarization** (Miettinen 1999):

```
max_a   min_i   w_i · (r_i(x,a) − r_i*)
```

Sweeping `w` traces the Pareto front. No online adaptation — the gap our method closes.

**Implementation.** `services/action-selector` exposes `POST /select` with `{context, constraints, available_actions}` → `{chosen_action, rationale, pareto_front (with posterior intervals), exploration_bonus, lambda_dual}`.

**Ablation.** `cbwk-online` (full) vs. `cbwk-offline-only` vs. `tchebycheff` vs. `epsilon-greedy` (no constraints — will violate; that's the point) vs. `random` vs. `oracle` (hindsight). Metrics: cumulative reward (vector), constraint violations, regret vs. oracle, average time-to-resolve, dual-variable trajectory.

### 12.3 Combined claim

> **Aegis is the first ML governance platform that closes the MAPE-K loop autonomously by combining (i) causal-DAG-grounded root-cause attribution and (ii) Pareto-optimal action selection with regret bounds, inside a system with formal safety guarantees (canary, audit-log integrity, approval gates, dry-run discipline) and a public benchmark of 10 induced-failure scenarios anchored to real-world incidents.**

**Target venues** (declining order of fit): ACM FAccT · AAAI AIES · NeurIPS Datasets & Benchmarks · ICSE/SEAMS.

**Paper structure** (LaTeX in `docs/paper/`, auto-generated tables sourced from `tests/scenarios/` results):

| §   | Title                                           | Source artifact                                |
| --- | ----------------------------------------------- | ---------------------------------------------- |
| 1   | Introduction + Apple-Card motivating incident   | `tests/scenarios/apple_card_2019/`             |
| 2   | Related work (SHML, governance products, drift) | `docs/paper/related-work.md`                   |
| 3   | System overview + MAPE-K                        | this design's §5                               |
| 4   | Extension 1: causal attribution                 | `services/causal-attrib` + ablation            |
| 5   | Extension 2: Pareto action selection            | `services/action-selector` + ablation          |
| 6   | Safety contract                                 | this design's §7 + safety CI results           |
| 7   | Evaluation on 10 scenarios                      | `tests/scenarios/` auto-generated tables       |
| 8   | Compliance mapping                              | `docs/compliance/` + `/compliance` page export |
| 9   | Limitations + future work                       | `docs/paper/limitations.md`                    |

## 13. Phased delivery (8–9 months)

| Phase | Weeks            | Deliverable                                                                                                                                          |
| ----- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | 1                | Repo scaffolding, Turborepo + uv workspace, CI baseline, `setup.md` v0.1, vercel.ts                                                                  |
| 1     | 2–4              | ML pipelines + 3 trained models + dataset snapshots + model cards + datasheets                                                                       |
| 2     | 5–8              | Control plane + Postgres schema + audit log + Tinybird datasources + safety L1/L2/L4                                                                 |
| 3     | 9–12             | Detection services (tabular + text) + signal ingestion + first end-to-end Detect→Decision (no remediation yet)                                       |
| 4     | 9–12 (parallel)  | Landing page + dashboard skeleton (`/fleet`, `/models/[id]`, `/audit`) + Clerk OTP + design system                                                   |
| 5     | 13–16            | **Research extension 1** — causal-attrib service + DAG specs + DoWhy GCM integration + DBShap fallback + cause→action mapping table + first ablation |
| 6     | 17–20            | **Research extension 2** — action-selector service + CB-Knapsack + Tchebycheff baseline + offline pre-training pipeline + first ablation             |
| 7     | 21–24            | Workflows: canary, retrain, rollback, approval-gate; safety L3/L5/L7; full lifecycle Detect→Evaluate working end-to-end                              |
| 8     | 21–24 (parallel) | Governance Assistant — services/assistant + 7 tools + chat page + Cmd+K drawer                                                                       |
| 9     | 25–28            | Induced-failure scenario library (all 10) + property-based tests + full ablation results + benchmark grid on landing                                 |
| 10    | 29–36            | Paper draft + thesis writing + dashboard polish + presentation deck                                                                                  |

## 14. Deliverables

1. **Aegis platform** — working end-to-end on free-tier deployment.
2. **10-scenario benchmark suite** (`tests/scenarios/`) — independently citable as a NeurIPS Datasets & Benchmarks contribution.
3. **`setup.md`** — verbatim install + run + deploy instructions, CI-validated nightly.
4. **Compliance mapping report** — generated from `/compliance` page → PDF.
5. **Research paper draft** (`docs/paper/`) — LaTeX, with auto-generated figures.
6. **Public landing page** (`/`) — at the production Vercel domain.
7. **Ablation results** — for both research extensions, reproducible from `tests/property/` and `tests/scenarios/`.

## 15. Decisions deferred to implementation

- Pixel-level dashboard polish (alignment, micro-typography, motion timing).
- Logo / brand mark for Aegis.
- HF Spaces vs. HF Inference API choice for some inference paths (decide at deploy time based on cold-start measurements).
- Final policy DSL syntax (the YAML structure may evolve; the parsed AST shape is locked).
- Specific Tchebycheff weight schedule for the baseline ablation (will be selected via grid search at evaluation time).

## 16. Open risks and mitigations

| Risk                                                               | Mitigation                                                                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| HF Spaces cold-start (~30 s) hurts demo                            | Vercel Cron keep-alive ping every 8 min during demo windows; document in operational characteristics                                                |
| Tinybird 10 GB/month limit reached                                 | Aggressive materialized aggregates, 7-day raw retention with rollup, audit log goes to Postgres (not Tinybird)                                      |
| Neon free-tier compute hours exhausted                             | Auto-pause after 5 min idle (Neon native); pgbouncer endpoint; aggressive dashboard caching via SWR                                                 |
| Vercel Hobby Function memory cap (1 GB Fluid / 256 MB Edge)        | Control-plane services stay <256 MB; XGBoost models <50 MB; DistilBERT on HF Spaces (the only thing that exceeds limits)                            |
| Causal-attrib too slow at runtime                                  | Hard timeout + DBShap fallback + decision proceeds with `attribution_quality=degraded`                                                              |
| Bandit regret bound depends on assumptions reviewers may challenge | Empirical regret reported alongside theoretical; clearly state assumptions (realizability, bounded rewards) in paper                                |
| Eight-month timeline slips                                         | Tier 2 baseline (Phase 0–7) is shippable as a complete project even without research extensions; extensions are clearly modular and ablation-driven |

---

## Appendix A — Real-world incidents per model with citations

**Credit / lending (HMDA / Lending Club)**

- Apple Card / Goldman Sachs gender disparity 2019; NYDFS report 2021 [PDF](https://www.dfs.ny.gov/system/files/documents/2021/03/rpt_202103_apple_card_investigation.pdf); CFPB fines $25M + $45M (Oct 2024).
- Wells Fargo refinance disparity 2020 (Bloomberg); class action 2022.
- The Markup, "Secret Bias in Mortgage-Approval Algorithms" Aug 2021 — HMDA-based; 40–80% disparate denial.
- Bartlett, Morse, Stanton, Wallace 2022 — algorithmic mortgage pricing; ~6 bps minority premium.
- CFPB Circulars 2022-03, 2023-03 — adverse-action specificity.

**Toxicity / NLP fairness (Jigsaw Civil Comments)**

- Borkan et al. 2019, "Nuanced Metrics for Measuring Unintended Bias..." (WWW '19, arXiv:1903.04561) — canonical paper.
- Dixon et al. 2018, "Measuring and Mitigating Unintended Bias..." (AIES).
- Sap, Card, Gabriel, Choi, Smith ACL 2019 — AAE 2× FPR.
- Twitter image-cropping audit 2020-2021 (arXiv:2105.08667).
- Buolamwini & Gebru 2018 — Gender Shades (intersectional).

**Healthcare / readmission (Diabetes 130-US, UCI)**

- Obermeyer, Powers, Vogeli, Mullainathan Science 2019 — Optum risk-stratifier; cost-as-proxy bias.
- Sjoding et al. NEJM 2020 — pulse oximetry racial bias.
- Strack et al. 2014 — original Diabetes 130-US paper.
- Larrazabal et al. PNAS 2020 — gender-imbalanced training.
- Cardiovascular sex-bias in ML (Nature npj Cardiovascular Health 2024).

## Appendix B — Compliance mapping (panel-by-panel)

| Article / Function / Control                     | Dashboard panel / artifact that satisfies it                          |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| EU AI Act Art. 9 (Risk Management)               | `/policies` (continuous, iterative) + `/compliance`                   |
| EU AI Act Art. 12 (Record-Keeping)               | `/audit` (immutable Merkle log, ≥ 6 mo retention)                     |
| EU AI Act Art. 13 (Transparency)                 | model cards on `/models/[id]` · `/chat` (grounded explanations)       |
| EU AI Act Art. 14 (Human Oversight)              | `/approvals` queue · emergency-stop · override on `/incidents/[id]`   |
| EU AI Act Art. 15 (Accuracy/Robustness/Cybersec) | model card metrics + canary KPI guards                                |
| EU AI Act Art. 17 (QMS)                          | `/policies` versioning + dry-run discipline + change-management audit |
| EU AI Act Art. 72 (Post-Market Monitoring)       | `/fleet` live monitoring + scheduled detection + SSE feed             |
| EU AI Act Art. 73 (Serious Incident)             | incident reporting workflow with 72h timer (CRITICAL severity)        |
| NIST RMF GOVERN                                  | `/settings` team + roles + emergency stop                             |
| NIST RMF MAP                                     | `/datasets` datasheets + model lineage in `/models/[id]/Versions`     |
| NIST RMF MEASURE                                 | all detection panels + `/audit`                                       |
| NIST RMF MANAGE                                  | `/incidents` queue + post-market panel                                |
| ISO 42001 A.9.2 (AISIA)                          | `/compliance` AISIA section per model                                 |
| NYC LL 144                                       | annual bias audit export from `/compliance`                           |
| CFPB Circulars 2022-03 / 2023-03                 | per-prediction explanation in `/incidents/[id]`                       |

## Appendix C — Selected citations (full bibliography in `docs/paper/refs.bib`)

- **MAPE-K**: Kephart & Chess, "The Vision of Autonomic Computing," IEEE Computer 2003.
- **SHML (closest prior)**: Rauba, Seedat, Kacprzyk, van der Schaar, "Self-Healing Machine Learning," NeurIPS 2024, arXiv:2411.00186.
- **Causal attribution**: Budhathoki, Janzing, Bloebaum, Ng, "Why did the distribution change?" AISTATS 2021, arXiv:2102.13384.
- **DBShap**: Edakunni et al., "Explaining Drift using Shapley Values," arXiv:2401.09756, 2024.
- **DoWhy**: Sharma & Kiciman, "DoWhy: An End-to-End Library for Causal Inference," JMLR 2022.
- **CBwK**: Agrawal & Devanur, "Linear Contextual Bandits with Knapsacks," NeurIPS 2016.
- **Modular Lagrangian**: Slivkins, Sankararaman, Foster, "Contextual Bandits with Packing and Covering Constraints," JMLR 25:24-1220, 2024.
- **Offline MOO bandits**: Cai et al., "Offline Multi-Objective Bandits," AAAI 2025, paper 40987.
- **Tchebycheff**: Miettinen, _Nonlinear Multiobjective Optimization_, Kluwer 1999.
- **Drift-detection libs**: Becker et al., "Open-Source Drift Detection Tools in Action," arXiv:2404.18673; DriftLens, arXiv:2406.17813.
- **Model card**: Mitchell et al., FAccT 2019, arXiv:1810.03993.
- **Datasheet for datasets**: Gebru et al., CACM 64(12) 2021.

— _End of design document._
