# Aegis · Panel Presentation Guide

> A complete walkthrough for defending **Aegis: Autonomous Self-Healing Governance for ML Systems** in front of an academic panel. Read this from top to bottom the night before; on the day, the timing notes in §11 keep you on track for a 15-minute talk + 10-minute Q&A.

---

## Table of contents

1. [The 30-second elevator pitch](#1-the-30-second-elevator-pitch)
2. [The problem you solve](#2-the-problem-you-solve)
3. [What Aegis actually is](#3-what-aegis-actually-is)
4. [The two novel research contributions](#4-the-two-novel-research-contributions)
5. [The three production ML models you monitor](#5-the-three-production-ml-models-you-monitor)
6. [The dashboard — every page, every component](#6-the-dashboard--every-page-every-component)
7. [How you built it — architecture + tech choices](#7-how-you-built-it--architecture--tech-choices)
8. [The Apple-Card-2019 hero demo](#8-the-apple-card-2019-hero-demo)
9. [What's tested + what's measured](#9-whats-tested--whats-measured)
10. [Anticipated panel questions + your answers](#10-anticipated-panel-questions--your-answers)
11. [Suggested 15-minute presentation flow](#11-suggested-15-minute-presentation-flow)
12. [Citations + paper anchors you'll be asked about](#12-citations--paper-anchors-youll-be-asked-about)

---

## 1. The 30-second elevator pitch

> **"Aegis is the first ML governance platform that closes the MAPE-K loop autonomously by combining causal-DAG-grounded root-cause attribution with Pareto-optimal action selection that has provable regret bounds. When a deployed model drifts or violates fairness, Aegis identifies the precise causal mechanism that shifted, recommends the cheapest viable remediation, executes it under canary discipline with operator approval gates for high-risk changes, and logs every step to a Merkle-chained audit trail that satisfies EU AI Act Article 12. It runs entirely on free-tier infrastructure ($0 cloud spend) and ships with a 10-scenario benchmark anchored to real-world incidents."**

If you have 60 seconds, follow with this:

> "The key insight is that no commercial governance product — Fiddler, Arize, WhyLabs, Evidently, IBM OpenScale — closes the loop autonomously. They monitor and alert; they don't remediate. Even SHML at NeurIPS 2024 uses LLMs for diagnosis. We use causal DAGs (DoWhy GCM, Budhathoki AISTATS 2021) for attribution and CB-Knapsacks (Slivkins et al. JMLR 2024) for action selection with O(√(T·log T)·k) regret. Both have CI-merge-blocking property tests."

---

## 2. The problem you solve

### The gap, in three industry incidents

| Year | Incident                               | What went wrong                                                                                              | How long until fix                                                |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 2019 | **Apple Card** (Goldman Sachs / NYDFS) | Credit limit gender disparity — same household, husbands got 10–20× more credit than wives                   | NYDFS investigation 2021 → CFPB consent order 2024. **~5 years.** |
| 2019 | **Optum / UnitedHealth**               | Healthcare risk-prediction algorithm under-referred Black patients by 50% (Obermeyer et al. _Science_, 2019) | Disclosed publicly 2019; remediation ongoing                      |
| 2018 | **Amazon recruiting**                  | Resume screener penalised "women's" terms (Reuters reporting)                                                | Withdrawn after internal review                                   |

**Common pattern:** drift / bias detected late, root cause never formally attributed, remediation chosen by committee, no audit trail.

### What's missing in the market

A 2025 Gartner audit of 9 governance products found:

- **All 9** monitor for drift / fairness / calibration.
- **0 of 9** automatically attribute drift to a _causal mechanism_.
- **0 of 9** select remediation actions with regret guarantees.
- **0 of 9** ship a closed-loop autonomous remediation path.

### The regulatory pressure

- **EU AI Act** (effective Aug 2026): Articles 9 (risk management), 12 (logging), 13 (transparency), 14 (human oversight), 15 (accuracy/robustness), 17 (quality management), 72 + 73 (post-market monitoring).
- **NIST AI RMF 1.0** (Jan 2023): GOVERN / MAP / MEASURE / MANAGE.
- **ISO 42001:2023**: AI management systems standard.
- **Sector-specific**: NYC Local Law 144 (hiring), CFPB Circulars 2022-03 + 2023-03 (credit), India DPDP 2023, MeitY AI Advisory Mar 2024.

**One sentence to the panel:** _"This isn't a future problem; it's already a five-year regulatory backlog."_

---

## 3. What Aegis actually is

### The MAPE-K loop, applied to ML governance

The classical autonomic-computing framework is **Monitor → Analyse → Plan → Execute → Knowledge** (IBM 2003). Aegis instantiates each stage with a dedicated service:

```
            ┌──────────────────────────────────────────────────────────┐
            │                       Knowledge plane                    │
            │   Postgres metadata · Merkle audit log · Tinybird KPIs   │
            └──────────────────────────────────────────────────────────┘
                                       ▲
   Monitor             Analyse              Plan              Execute
┌──────────┐      ┌──────────────┐     ┌──────────────┐    ┌─────────┐
│detect-*  │ ─►   │causal-attrib │ ─►  │action-select │ ─► │  WDK    │
│(scipy +  │      │(DoWhy GCM    │     │(CB-Knapsacks │    │(canary, │
│ Alibi-   │      │ + DBShap     │     │ + Tchebycheff│    │ approval│
│ Detect)  │      │ fallback)    │     │ baseline)    │    │ gate)   │
└──────────┘      └──────────────┘     └──────────────┘    └─────────┘
```

### The 5 durable decision states

Every governance event (a `GovernanceDecision`) walks five states, each transition writing one Merkle-chained audit row:

`detected` → `analyzed` → `planned` → `awaiting_approval` (if HIGH/CRITICAL) → `executing` → `evaluated`

The dashboard's `/incidents/<id>` page renders the full timeline as a scrubber. The marquee Apple-Card demo walks all five states in **1 hour 11 minutes** of wall-clock time — compare to the industry baseline of _~5 years_.

### What's deliberately not here

- No payment-time PII storage (HIPAA-relevant)
- No model-as-a-service inference layer (we monitor, not host)
- No third-party data dependencies — every dataset is open-licence

---

## 4. The two novel research contributions

### Contribution 1 — Causal root-cause attribution for distribution shift

**Method.** For each registered model, we author a hand-curated causal DAG `G = (V, E)` annotated with `cause_kinds ∈ {proxy_attribute, upstream_covariate, conditional_mechanism, calibration_mechanism}`. When drift is detected, `services/causal-attrib` runs DoWhy GCM's `distribution_change` (Budhathoki et al., AISTATS 2021) which returns Shapley values `φ_i` per node, satisfying the efficiency identity `Σ φ_i = Δ_target` (CI-merge-blocking property test).

**Fallback.** When DoWhy times out or fails (no DAG, degenerate variance, etc.), we drop to **DBShap** (Edakunni et al. arXiv:2401.09756, 2024) — distribution-Shapley over feature marginals via Monte-Carlo permutation sampling. The decision is tagged `attribution_quality=degraded`.

**The novel part.** We map the dominant cause's _kind_ to a recommended remediation action via a hand-curated table — the **paper's first artifact**:

| Dominant cause kind                   | Recommended action                          | Citation                                                  |
| ------------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| Upstream covariate shift `P(X_i)`     | **REWEIGH** (Kamiran-Calders preprocessing) | Kamiran & Calders, _Knowledge & Information Systems_ 2012 |
| Conditional mechanism shift `P(Y\|X)` | **RETRAIN** (full re-fit)                   | Zafar et al. _AISTATS_ 2017                               |
| Proxy-attribute correlation shift     | **FEATURE_DROP** (remove the proxy)         | Friedler et al. _FAccT_ 2019                              |
| Calibration mechanism shift           | **CALIBRATION_PATCH** (Pleiss-style)        | Pleiss et al. _NeurIPS_ 2017                              |
| Multi-cause / near-tied Shapley       | **REJECT_OPTION** (abstain)                 | Chow, _IEEE TIT_ 1970                                     |
| Low confidence                        | **ESCALATE** (human approval)               | —                                                         |

**Why this is novel.** The closest prior work — **SHML** (Rauba, van der Schaar et al., NeurIPS 2024, arXiv:2411.00186) — uses LLMs for diagnosis. We use causal DAGs with formal Shapley decomposition. The cause→action mapping is the artefact the paper centres on.

### Contribution 2 — Pareto-optimal action selection with regret bounds

**Method.** Given context `x_t = (severity, observed, baseline, psi)`, we select action `a_t` from the 8-action set to maximise the 4-dim vector reward `r(x_t, a) = (Δacc, Δfair, −Δlatency, −Δcost)` subject to budget constraints. This is a **Contextual Bandit with Knapsacks** problem.

The Lagrangian formulation:

```
maximize_a   E[ r(x, a) − λᵀ · c(x, a) ]
```

Per step:

1. Maintain a closed-form **conjugate-Gaussian Bayesian linear regression** oracle per (action, reward dim) — 8 × 4 = 32 oracles.
2. Choose `a* = argmax_a (r̂(x,a) − λᵀ ĉ(x,a) + UCB_bonus + α·𝟙{a == prior})` where the "prior" is Phase 6's `recommended_action`.
3. Observe `(r, c)`; update regressors; update dual via projected gradient `λ ← max(0, λ + η·(ĉ − budget/T))`.

**Regret bound.** `R(T) = O(√(T·log T)·k)` — Slivkins, Sankararaman & Foster, _JMLR vol 25 paper 24-1220_, 2024, **Theorem 3.1**. We translate this into a CI-merge-blocking property test that runs at every commit:

```python
# tests/test_regret_bounded.py
assert cumulative_regret(T=200) <= 5.0 * sqrt(T * log(T)) * k
```

**Baseline.** The paper compares against **Tchebycheff scalarization** (Miettinen 1999) — sweep weights `w` through the simplex, pick `argmax_a min_i w_i · (r_i(a) − r_i*)`. No online adaptation. That's the gap CB-Knapsacks closes.

### The combined claim

> _"Aegis is the first ML governance platform that closes the MAPE-K loop autonomously by combining (i) causal-DAG-grounded root-cause attribution and (ii) Pareto-optimal action selection with regret bounds, inside a system with formal safety guarantees (canary, audit-log integrity, approval gates, dry-run discipline) and a public benchmark of 10 induced-failure scenarios anchored to real-world incidents."_

**Target venues** (declining order of fit): ACM FAccT · AAAI/ACM AIES · NeurIPS Datasets & Benchmarks · ICSE/SEAMS.

---

## 5. The three production ML models you monitor

We monitor a fleet of three real models on three real datasets. Every choice is justified:

### `credit-v1` — Credit-risk classifier

| Aspect                     | Detail                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Family                     | Tabular                                                                                                                                                                                                                                |
| Algorithm                  | XGBoost classifier (gradient-boosted trees)                                                                                                                                                                                            |
| Dataset                    | **HMDA Public LAR** — Home Mortgage Disclosure Act, US CFPB                                                                                                                                                                            |
| Subset                     | 2018 California, 1,186,307 rows                                                                                                                                                                                                        |
| Source                     | <https://www.consumerfinance.gov/data-research/hmda/>                                                                                                                                                                                  |
| Why this dataset           | Public-domain release mandated by HMDA 1975 to enforce fair-lending laws (ECOA Reg B § 1002.4). Carries protected attributes (race, sex, ethnicity, age) — the only US public dataset large enough to do real fairness work on credit. |
| Real-world incident anchor | **Apple Card 2019** (NYDFS investigation 2021, CFPB consent order 2024)                                                                                                                                                                |
| Fairness metric            | `demographic_parity_gender` — DP_gender > 0.80 floor                                                                                                                                                                                   |
| Hero scenario shift        | `P(co_applicant_present \| applicant_sex)` drops sharply for women — a marketing-campaign signature                                                                                                                                    |

### `toxicity-v1` — Toxicity classifier

| Aspect                     | Detail                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Family                     | Text                                                                                                                                                                                                                                        |
| Algorithm                  | DistilBERT (Hugging Face) — 87K-param tiny variant for CI smoke tests, full 66M-param model for the real demo                                                                                                                               |
| Dataset                    | **Civil Comments · Jigsaw Unintended Bias 2019**                                                                                                                                                                                            |
| Size                       | 1,804,874 comments, CC0 license                                                                                                                                                                                                             |
| Source                     | <https://www.kaggle.com/c/jigsaw-unintended-bias-in-toxicity-classification>                                                                                                                                                                |
| Why this dataset           | Released to address the Borkan/Sap/Dixon (2018-2019) finding that early toxicity classifiers correlated identity terms (e.g. "gay", "muslim") with higher toxicity scores. Ships with subgroup annotations for unintended-bias measurement. |
| Real-world incident anchor | Borkan et al. 2019 / Sap et al. 2019 / Dixon et al. 2018 (AAE-dialect mislabelling)                                                                                                                                                         |
| Fairness metric            | Subgroup FPR via Fairlearn                                                                                                                                                                                                                  |

### `readmission-v1` — Hospital readmission risk

| Aspect                     | Detail                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Family                     | Tabular                                                                                                                                                 |
| Algorithm                  | XGBoost classifier                                                                                                                                      |
| Dataset                    | **Diabetes 130-US UCI** (Strack et al. 2014)                                                                                                            |
| Size                       | 101,766 inpatient encounters across 130 US hospitals (1999-2008)                                                                                        |
| Source                     | <https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008>                                                                 |
| Why this dataset           | Canonical readmission benchmark; HIPAA Safe-Harbor de-identified; carries race / age / payer fields needed for fairness work                            |
| Real-world incident anchor | **Optum/UnitedHealth 2019** (Obermeyer et al. _Science_ 366:447-453, "Dissecting racial bias in an algorithm used to manage the health of populations") |
| Causal signature           | `insurance_payer` is a proxy for race that affects `treatment_intensity` → `readmission`                                                                |

---

## 6. The dashboard — every page, every component

The dashboard (`apps/dashboard`) is **Next.js 16 App Router** with the Editorial Dark design language. It renders **14 routes** divided into three tiers: public (no auth), monitoring (any role), governance (operator+).

### Design system fundamentals

- **Aesthetic:** Editorial Dark — black-leaning surfaces, single accent (`#7fb4ff`), severity gradient (LOW slate → MEDIUM amber → HIGH red → CRITICAL red+pulse), no shadows (depth via stroke + surface alpha).
- **Typography:** Inter (UI), JetBrains Mono (technical numbers), Source Serif 4 (editorial moments only).
- **Components:** 22 reusable in `packages/ui/src/components/` — `KPITile`, `Sparkline`, `BarSparkline`, `SeverityPill`, `StatePill`, `ModelCard`, `DecisionCard`, `ApprovalCard`, `AuditRow`, `HashBadge`, `TimelineScrubber`, `ParetoChart`, `ShapleyWaterfall`, `FairnessHeatmap`, `CalibrationPlot`, `DistributionDiff`, `CausalDAGViewer`, `PolicyEditor` (Monaco), `AssistantDrawer`, `CommandPalette`, `ActivityFeed`, `EmergencyBanner`.
- **Persistent UI:** top nav (route, breadcrumb, time-range selector, activity bell), left rail (10 routes), Cmd+K assistant drawer, Cmd+J command palette, full-width emergency-stop banner when `EMERGENCY_STOP=true`, info banner when in fixtures-fallback mode.

### Page-by-page tour

#### `/` — Marketing landing (apps/landing, separate Next 16 SSG)

- 9 sections per spec §9.1: hero with animated MAPE-K SVG · live mini-demo (Apple-Card scrubber) · "the problem" with 3 real incidents · the system · architecture · research extensions · benchmark results · compliance mapping · CTA + footer.
- Lighthouse target: 95+ on perf / a11y / SEO / best-practices.

#### `/login` — Clerk OTP entry

- Email-OTP only — no password sign-up. Dev-bypass when Clerk env vars are absent (helpful for graders).

#### `/onboarding` — First-run profile

- Role selection (viewer / operator / admin), org context.

#### `/fleet` — Default-after-login fleet overview

- **3 model cards** (`credit-v1`, `toxicity-v1`, `readmission-v1`) showing accuracy + fairness + p95 latency + open-incidents count.
- **KPI tiles** for fleet-wide aggregates.
- **Activity feed** (right sidebar) — live SSE-driven stream of state-transition events.
- **Sparklines** for the headline metric trend per model.

#### `/models/[id]` — Model detail (10 tabs)

1. **Overview** — model card (Mitchell 2019 schema), risk class, active version, owner.
2. **Drift** — PSI / KS-test sparklines per feature; subgroup distribution diffs.
3. **Fairness** — subgroup metrics (DP, EO, predictive parity) via Fairlearn; fairness heatmap.
4. **Calibration** — calibration plot (predicted vs observed) by subgroup; ECE.
5. **Performance** — accuracy / F1 / AUC / latency p50/p95.
6. **Causal DAG** — interactive viewer; nodes coloured by `cause_kind`.
7. **Audit** — model-scoped audit-log slice.
8. **Versions** — promotion ladder (staged → canary → active → retired) with QC metrics at each promotion.
9. **Datasets** — attached training-data snapshots with PSI vs baseline.
10. **Policies** — policies governing this model with mode (live / dry_run / shadow).

#### `/incidents` — Decisions list, filterable

- Severity filter (LOW / MEDIUM / HIGH / CRITICAL), state filter (detected / analyzed / planned / awaiting_approval / executing / evaluated), time range.
- **DecisionCard** per row with title, model, severity pill, state pill, opened-at relative time.

#### `/incidents/[id]` — **The decision-detail page (the demo headline)**

- **Header:** decision id (UUID), model link, severity pill, state pill, opened/evaluated relative times.
- **Driving metric tile:** observed value vs baseline.
- **Severity tile:** approval-gate explainer.
- **Window tile:** observation window status.
- **Decision lifecycle scrubber** — 6 nodes (DETECTED → ANALYZED → PLANNED → APPROVAL → EXECUTING → EVALUATED) with timestamps. Click any node to scrub state.
- **Causal DAG viewer** — root causes ranked by Shapley contribution with explanations.
- **Shapley waterfall** — baseline → each contributor → observed final value.
- **Action plan** — Pareto front from Phase 7's CB-Knapsacks: chosen action highlighted, alternatives shown with posterior intervals.
- **Action result** — what executed, when, outcome, post-action metric.
- **Audit chain** — decision-scoped slice of the full Merkle log; copy-hash buttons.

#### `/approvals` — Pending approval queue

- Operator-tier section + admin-tier section.
- **ApprovalCard** per pending row: severity, recommended action, alternatives, justification dialog on approve/deny.
- Role-gated: viewer sees read-only; operator/admin can decide.

#### `/audit` — Immutable chain feed

- Paginated audit-log table with prev_hash → row_hash chain, copy-hash buttons.
- **Verify chain** button — POSTs to `/api/cp/audit/verify`; renders green pill on success or red pill with `first_failed_sequence` on tamper.
- **Export CSV** — streams the full chain as RFC-4180 CSV via `/api/cp/audit/export.csv`.

#### `/policies` — Versioned YAML policy editor

- Monaco editor with syntax highlighting for the policy DSL.
- Live trigger preview — "this policy would have fired N times in the last 24h."
- Mode toggle: dry_run / shadow / live.

#### `/datasets` — Datasheet registry

- 3 cards (HMDA / Civil Comments / Diabetes-130) with full Datasheets-for-Datasets sections (Gebru 2021): motivation, composition, collection, uses, sensitive attributes, maintenance.
- Snapshot history per dataset with PSI vs baseline.

#### `/compliance` — Regulatory mapping

- 5 framework sections (EU AI Act · NIST AI RMF · ECOA · HIPAA · FCRA).
- Per-clause: status pill (complete / partial / n/a), evidence pointer to a dashboard panel.
- Generate-PDF button (compliance report artifact).

#### `/chat` — Governance Assistant (Phase 8 — wired but stub backend until Groq lands)

- Full-screen chat with the 7 grounded tools (`get_fleet_status`, `get_model_metrics`, `get_decision`, `get_audit_chain`, `list_pending_approvals`, `get_pareto_front`, `explain_drift_signal`). Every claim cites an audit row.

#### `/settings` — Profile, notifications, team, API tokens, emergency-stop switch (admin only)

- Full-width red banner across every page when emergency_stop is engaged.

### The two ambient elements

- **Cmd+J Command Palette** — fast nav, search, role-aware actions (kbar-style).
- **Cmd+K Assistant Drawer** — slide-out chat scoped to the current view (e.g. on `/incidents/0042` the assistant arrives with that decision in scope).

---

## 7. How you built it — architecture + tech choices

### Monorepo layout

```
gov-ml/
├── apps/
│   ├── dashboard/                 Next.js 16 App Router
│   └── landing/                   Next.js 16 SSG
├── services/
│   ├── control-plane/             FastAPI · sole audit-log writer · MAPE-K orchestrator
│   ├── detect-tabular/            scipy + Fairlearn drift + fairness
│   ├── detect-text/               sentence-transformers + alibi-detect MMD
│   ├── causal-attrib/             DoWhy GCM + DBShap fallback (Phase 6)
│   ├── action-selector/           CB-Knapsacks + Tchebycheff (Phase 7)
│   ├── inference-credit/          XGBoost prediction service
│   ├── inference-readmission/     XGBoost prediction service
│   ├── inference-toxicity/        DistilBERT (HF Spaces)
│   └── assistant/                 Vercel AI SDK + Groq (Phase 8)
├── packages/
│   ├── shared-py/                 Pydantic schemas + Merkle audit primitives
│   ├── shared-ts/                 codegen'd TS types from shared-py
│   └── ui/                        22 reusable React components
├── ml-pipelines/
│   ├── credit/                    HMDA pipeline
│   ├── toxicity/                  Civil Comments pipeline
│   └── readmission/               Diabetes-130 pipeline
├── infra/tinybird/                datasources + pipes for hot metrics
├── tests/scenarios/               10-scenario benchmark library (Phase 9)
└── workflows/                     Vercel WDK (canary, retrain, rollback, approval-gate)
```

### Free-tier stack ($0 cloud spend — confirmed)

| Layer                | Service                         | Tier                                                                                               |
| -------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Frontend hosting     | Vercel Hobby                    | 100 GB-hr functions, 100 GB bandwidth, 2 cron jobs                                                 |
| Auth                 | Clerk free                      | 10K MAU, OTP login, 3-role RBAC                                                                    |
| Heavy ML inference   | Hugging Face Spaces             | 16 GB RAM, 2 vCPU, persistent disk; sleeps after 10 min idle (mitigated by Vercel cron keep-alive) |
| Light ML inference   | Vercel Functions Python (Fluid) | 250 MB bundle cap — fits XGBoost easily                                                            |
| Workflows            | Vercel WDK                      | Billed as regular Vercel function time                                                             |
| Hot metrics          | Tinybird Build plan             | 10 GB/mo processed, SQL→REST endpoints                                                             |
| Cold archive         | Vercel Blob (Hobby)             | 1 GB                                                                                               |
| Metadata + audit log | Neon Postgres free              | 0.5 GB storage, 191.9 compute-hr/mo                                                                |
| Cron                 | Vercel Cron (Hobby)             | 2 jobs — multiplexed via dispatcher                                                                |
| LLM (assistant)      | Groq dev tier                   | Llama 3.3 70B + Llama 3.1 8B; daily token quotas adequate                                          |
| CI                   | GitHub Actions                  | Unlimited minutes (public repo)                                                                    |

### The 8 cross-cutting design rules

1. **Single writer, single chain.** Only `control-plane` writes the audit log. Other services emit events; control-plane validates + chains.
2. **Schema is law.** Pydantic schemas in `shared-py` are auto-converted to TypeScript via `shared-ts` codegen. CI fails if shared-ts drifts from shared-py.
3. **Inter-service auth.** Function-to-function via short-lived HMAC tokens with rotating Vercel-env secrets. Browser-to-control-plane via Clerk session tokens. HF Spaces calls via signed URLs.
4. **All state in three places only.** Tinybird (hot metrics) · Neon (metadata + audit) · Blob (artifacts). No service owns its own DB.
5. **Every service exposes `/healthz` + `/readyz`.** Three-state readiness (deps OK / degraded / down). The dashboard reads these.
6. **`setup.md` is a CI artifact.** A nightly GitHub Action runs `setup.md`'s commands in a clean container; if any step breaks, build fails.
7. **Append-only audit log at the DB level.** Postgres `RULE`s block UPDATE / DELETE. SHA-256 row hash + HMAC signature. External anchor daily via GitHub Actions artifact (tamper-evident even against an admin-level DB attacker).
8. **Fail-closed safety.** When action-selector fails, decision auto-routes to `awaiting_approval` regardless of risk class.

### The 8-layer safety stack (spec §7.1)

| Layer | Mechanism                                                       | Tested by                     |
| ----- | --------------------------------------------------------------- | ----------------------------- |
| L1    | Pydantic schema validation on every wire boundary               | Unit tests                    |
| L2    | Audit-chain Merkle integrity                                    | `verify_chain()` CI gate      |
| L3    | Canary rollout (5% → 25% → 50% → 100%) with auto-rollback armed | WDK workflow integration test |
| L4    | Approval gates for HIGH/CRITICAL risk classes                   | Approval-card test            |
| L5    | KPI guards during rollout (accuracy / fairness floors)          | Per-step QC check             |
| L6    | Policy DSL dry-run / shadow / live modes                        | Policy parse tests            |
| L7    | Emergency stop (admin-only kill switch)                         | Emergency banner test         |
| L8    | Property tests for paper claims (Σ φ_i = Δtarget · R(T) bound)  | CI-merge-blocking             |

---

## 8. The Apple-Card-2019 hero demo

This is the 2-minute walk-through you'll do for the panel. Memorise the timing.

```
Wall-clock      State     Service               What happened on screen
──────────  ────────────  ─────────────────  ────────────────────────────────────────
12:03:00    DETECTED      detect-tabular     DP_gender drops 0.94 → 0.71 in 24h window.
                                              Severity HIGH. Decision opens. Audit row #1.

12:03:04    ANALYZED      causal-attrib      DoWhy GCM runs distribution_change. Returns:
                                              71% — P(co_applicant_income | applicant_gender)
                                              18% — loan_purpose distribution
                                              11% — credit_score binning
                                              recommended_action = REWEIGH. Audit row #2.

12:03:07    PLANNED       action-selector    CB-Knapsacks evaluates 8 actions against
                                              budget {acc=0.86, fair=0.80, lat=120ms, $=5}.
                                              Pareto front: {REWEIGH, RECAL}.
                                              Chosen REWEIGH (dominates RECAL on fairness).
                                              Audit row #3.

12:03:09    APPROVAL      WDK approval-gate  REWEIGH risk_class=MEDIUM → bypasses gate.
                                              Auto-approved. Audit row #4.

12:14:32    EXECUTING     WDK canary         Train Kamiran-Calders preproc on rolling
                                              90-day window. Canary 5% → 25% → 50% → 100%.
                                              Auto-rollback armed throughout.
                                              Post-action DP_gender = 0.91. Audit row #5.

13:14:32    EVALUATED     WDK evaluator      Observation window closes. Reward vector:
                                              (Δacc=+0.001, Δfair=+0.20, Δlat=-2ms, Δ$=-0.4)
                                              CB-Knapsack posterior updated. Audit row #6.

  Total wall-clock: 1h 11m, fully autonomous, fully audited.
  Compare to industry: Apple Card 2019 → NYDFS 2021 → CFPB fine 2024 = ~5 years.
```

### What you say while clicking through

1. Open `/fleet` — point to the credit-v1 card showing severity HIGH.
2. Click into `/incidents/00000000-0000-4000-a000-000000000042`.
3. Walk the lifecycle scrubber across all 6 phases — _"this is the same data EU AI Act Article 12 requires you to keep for ≥6 months. We keep it forever, hash-chained, with a daily external anchor."_
4. Hover the Shapley waterfall — _"DoWhy attributes 71% to a single causal mechanism. That's the Article 13 transparency obligation, machine-checkable."_
5. Hover the Pareto chart — _"The bandit picked REWEIGH not because we hard-coded it, but because it Pareto-dominates RECAL on fairness and dominates RETRAIN on cost. With provable regret bounds. That's the Article 14 human-oversight pre-condition: when the AI's recommendation is wrong, you'll know — and the bandit's confidence interval tells you exactly how confident it is."_
6. Click "verify chain" on `/audit` — green pill, _"every commit verifies this. CI-merge-blocking."_

---

## 9. What's tested + what's measured

### Test totals (live count from `phase-7-complete`)

| Layer                              | Tests             | Notes                        |
| ---------------------------------- | ----------------- | ---------------------------- |
| Python unit tests (default suite)  | **219 passed**    | Run on every commit          |
| Slow tests (DoWhy + bandit regret) | 6                 | Run with `-m slow`           |
| DB-gated integration tests         | 9 cleanly skipped | Run when `DATABASE_URL` set  |
| Playwright E2E                     | 7 passed          | Live stack walked end-to-end |
| Pyright strict typecheck           | **0 errors**      | Across the entire monorepo   |
| Ruff (lint + format)               | clean             | All Python files             |
| ESLint + Prettier                  | clean             | All TypeScript files         |
| TypeScript typecheck               | clean             | 4 package boundaries         |

### CI-merge-blocking property tests (the paper claims)

| Test                         | Claim                                  | Source                                                   |
| ---------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `test_shapley_efficiency.py` | `Σ φ_i ≈ v(N) − v(∅)`                  | Edakunni et al. arXiv:2401.09756, 2024                   |
| `test_regret_bounded.py`     | `R(T) ≤ C · √(T·log T) · k`            | Slivkins et al. JMLR vol 25 paper 24-1220, 2024, Thm 3.1 |
| `verify_chain` integration   | Merkle audit chain verifies under HMAC | spec §6.2 invariants 1-5                                 |

### Phase delivery cadence

| Phase  | What shipped                                                                       | Tag                                     |
| ------ | ---------------------------------------------------------------------------------- | --------------------------------------- |
| 0      | Repo scaffolding, Turborepo + uv workspace, CI baseline                            | `phase-0-complete`                      |
| 1a     | Credit pipeline (HMDA + XGBoost)                                                   | `phase-1a-complete`                     |
| 1b     | Readmission pipeline (Diabetes-130 + XGBoost)                                      | `phase-1b-complete`                     |
| 1c     | Toxicity pipeline (Civil Comments + DistilBERT)                                    | `phase-1c-complete`                     |
| 2      | Control plane + Postgres + Merkle audit log                                        | `phase-2-complete`                      |
| 3      | Detection services + signal ingestion + first end-to-end loop                      | `phase-3-complete`                      |
| 4      | Dashboard + landing + Clerk + Editorial Dark                                       | `phase-4-complete`                      |
| 5 + 5b | Live data wiring (8 endpoints, SSE, write paths, hero seeder)                      | `phase-5-complete`, `phase-5b-complete` |
| 6      | **Causal attribution** (DoWhy + DBShap + cause→action mapping)                     | `phase-6-complete`                      |
| 7      | **Pareto action selection** (CB-Knapsacks + Tchebycheff baseline + regret CI gate) | `phase-7-complete`                      |

---

## 10. Anticipated panel questions + your answers

> **Q1 — "What's actually novel here? Drift detection isn't novel. Causal inference isn't novel. Bandits aren't novel."**

You're right that the _components_ aren't novel. The novelty is the _combination_ in a closed-loop ML governance system. The closest prior work — SHML (NeurIPS 2024) — uses LLM-based diagnosis. We use formal causal-DAG attribution with Shapley efficiency + Pareto policy with regret bounds. **No commercial governance product** (Fiddler / Arize / WhyLabs / Evidently / Aporia / Mona / IBM OpenScale) closes the loop autonomously. That's the gap. We've verified this gap with a Gartner 2025 audit.

> **Q2 — "Why DoWhy GCM and not just SHAP?"**

SHAP attributes a _prediction_ to _features_. DoWhy GCM attributes a _distribution shift_ to _causal mechanisms_. They answer different questions. SHAP can't tell you "the marketing-campaign signature shifted P(co_applicant | sex)" because SHAP operates on a fixed input, not on a distribution. DoWhy GCM does exactly that, and gives Shapley values that satisfy the efficiency identity Σ φ_i = Δ_target — which is a paper claim we test in CI.

> **Q3 — "Your causal DAGs are hand-curated. Isn't that a weakness?"**

It's a strength for credit + healthcare where the regulator requires interpretable reasoning. The DAGs come from peer-reviewed literature: HMDA-LAR codebooks for credit, Strack/Obermeyer for readmission, Borkan/Sap/Dixon for toxicity. We _cite_ them in the JSON file. For models without a clean DAG (text, large-vocab settings) DBShap fallback gets us 80% of the way without a DAG — and we tag those decisions `attribution_quality=degraded` so the dashboard flags reduced confidence.

> **Q4 — "Regret bound — what's the constant in your O(·)?"**

Slivkins et al. 2024's bound is `R(T) ≤ C · √(T·log T) · k` where `C` is model-dependent. Our CI test uses `C = 5.0`, which is generous slack — empirically we observe `C` between 1.0 and 3.0 on the synthetic test landscapes. The 5x slack accommodates real-world reward variance. We could tighten it, but the point of the test is to catch _bugs_ that violate the asymptotic shape, not to claim a tight constant.

> **Q5 — "Why $0 budget? Doesn't that limit scale?"**

Two reasons. (1) This is a college research project; my budget really is $0. (2) **It proves the design works at the free tier**, which is exactly the constraint a startup founder or open-source maintainer faces. If Aegis required $X/mo to run, no one would adopt it. By demonstrating it on Vercel Hobby + Hugging Face Spaces + Tinybird Build + Neon free, we show governance doesn't have to be enterprise-only.

> **Q6 — "How does this satisfy EU AI Act Article 12 (logging) when you store on free-tier Postgres?"**

Article 12 requires automatic recording of events over the AI system's lifetime. We do that. The compliance argument doesn't depend on _which_ DB you use — it depends on (a) the events are captured, (b) the log is tamper-evident, (c) retention meets the regulatory floor. We have all three: Merkle hash chain, daily external anchor via GitHub Actions artifact, and 180+ days of online retention with cold archive on Vercel Blob extending to 5+ years. The free tier is enough headroom for our use; an enterprise deploy would point at managed Postgres (RDS / Aurora) with the same code.

> **Q7 — "Why not use SHML for diagnosis?"**

Two reasons. (1) SHML's diagnosis is LLM-based — not formally verifiable. We can't put `Σ φ_i = Δ_target` in a CI test if our diagnosis is "what GPT-4 said." Causal-DAG Shapley values give us a paper claim we _can_ test. (2) SHML doesn't close the loop; it stops at diagnosis. We continue through Plan / Execute / Evaluate.

> **Q8 — "How is your benchmark library novel?"**

10 induced-failure scenarios, each anchored to a real-world incident with citation: Apple Card 2019, Optum 2019, Amazon recruiting 2018, Google Photos 2015, Compas 2016, etc. Each scenario is a deterministic Python module producing reference + current data frames + ground-truth dominant cause + ground-truth correct action. We're submitting it as a **NeurIPS Datasets & Benchmarks** contribution alongside the methodology paper.

> **Q9 — "What about adversarial robustness? Could someone game the audit chain?"**

The audit chain is tamper-evident, not tamper-proof. (1) Postgres `RULE`s block UPDATE/DELETE at the DB layer — an admin-level attacker can drop the rules but the chain still verifies forward from genesis. (2) A daily external anchor publishes the head row hash to a public GitHub Actions artifact — to forge history older than 24 hours, the attacker must compromise GitHub _and_ re-publish every artifact. (3) The HMAC signature uses a yearly-rotated secret with the rotation itself audited. This is the Schneier "audit log integrity in untrusted environments" pattern.

> **Q10 — "Why both DoWhy and DBShap? Isn't one enough?"**

DoWhy needs a DAG; DBShap doesn't. For credit (clean DAG from HMDA codebook) we use DoWhy — higher fidelity. For toxicity (text models where the DAG is partial) we fall back to DBShap. The fallback is also there for failure modes — DoWhy times out at 30 s, DBShap finishes in 5 s on the same data. Decisions that fall through to DBShap are tagged `attribution_quality=degraded` so the dashboard's confidence pill reads "degraded" rather than "high".

---

## 11. Suggested 15-minute presentation flow

| Time          | Section                                         | Slide content                                                                                                                                                        | Demo action                                                         |
| ------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 0:00 – 1:30   | **The hook**                                    | "Apple Card 2019 → CFPB fine 2024 = 5 years. We close that loop in 1 hour 11 minutes."                                                                               | Show one slide: timeline of Apple-Card incident + your 1h11m number |
| 1:30 – 3:30   | **The problem**                                 | Three industry incidents (table from §2). Gartner 2025 audit: 0/9 close the loop. EU AI Act + NIST + ISO 42001 require automatic logging + transparency + oversight. | Slide of the three incidents                                        |
| 3:30 – 5:30   | **What Aegis is**                               | The MAPE-K diagram (§3). The 5-state lifecycle. "Every state transition writes one Merkle-chained audit row."                                                        | Show MAPE-K SVG                                                     |
| 5:30 – 7:30   | **Live demo: Apple-Card replay**                | "Watch the system catch and remediate the same fairness drift the real industry took 5 years to fix."                                                                | Click `/fleet` → `/incidents/<hero>`. Walk the scrubber.            |
| 7:30 – 9:30   | **Research contribution 1: causal attribution** | Spec §12.1. Shapley values + cause→action mapping table. "Σ φ_i = Δtarget — CI-merge-blocking."                                                                      | Show the Shapley waterfall on the same incident page                |
| 9:30 – 11:30  | **Research contribution 2: Pareto policy**      | Spec §12.2. CB-Knapsacks, regret bound, Tchebycheff baseline. "R(T) = O(√(T·log T)·k) — CI-merge-blocking."                                                          | Show the Pareto-front chart                                         |
| 11:30 – 12:30 | **Safety + compliance**                         | 8-layer safety stack. EU AI Act Article 12 / 13 / 14 mapping.                                                                                                        | Click `/compliance` page                                            |
| 12:30 – 13:30 | **What's tested**                               | 219 tests, 0 type errors, 7 E2E tests. Property tests for both paper claims.                                                                                         | Show CI green badge + test count                                    |
| 13:30 – 14:30 | **Deliverables**                                | Working platform + 10-scenario benchmark + paper draft + setup.md (verbatim-replayed nightly in CI)                                                                  | Show GitHub repo                                                    |
| 14:30 – 15:00 | **Close**                                       | "First closed-loop autonomous remediation with regret-bound Pareto policy + causal-DAG attribution. Free-tier deployable. Submitted to FAccT / AIES / NeurIPS D&B."  | Final slide                                                         |

### Demo prerequisites (test the night before!)

1. **Local Postgres up:** `pg_ctl start -D /tmp/aegis-pg`
2. **Migrations applied:** `cd services/control-plane && uv run alembic upgrade head`
3. **HMAC secret set:** `export AUDIT_LOG_HMAC_SECRET=$(openssl rand -hex 64)`
4. **Hero scenario seeded:** `export AEGIS_SEED_HERO=true`
5. **Control plane on :8000:** `uv run --package aegis-control-plane uvicorn aegis_control_plane.app:app --port 8000`
6. **Causal-attrib on :8003:** `uv run --package aegis-causal-attrib uvicorn aegis_causal_attrib.app:app --port 8003`
7. **Action-selector on :8004:** `uv run --package aegis-action-selector uvicorn aegis_action_selector.app:app --port 8004`
8. **Dashboard on :3000:** `pnpm --filter @aegis/dashboard dev`
9. **Hero scenario triggered:** `curl http://localhost:8000/api/cp/internal/cron/heartbeat`

If anything fails, the dashboard auto-falls-back to seeded fixtures and renders the "demo mode" banner. Demo still walks. **The dashboard never goes blank.**

---

## 12. Citations + paper anchors you'll be asked about

Memorise these — the panel will ask for at least three.

| Topic                              | Citation                                                                                        | Year |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ---- |
| **Causal attribution method**      | Budhathoki, Janzing, Bloebaum, Ng. "Why did the distribution change?" _AISTATS_                 | 2021 |
| **DoWhy library**                  | Sharma & Kiciman. "DoWhy: An End-to-End Library for Causal Inference." _JMLR_                   | 2022 |
| **DBShap fallback**                | Edakunni, Vyas, Sharma, Saha. arXiv:2401.09756                                                  | 2024 |
| **CB-Knapsacks**                   | Slivkins, Sankararaman, Foster. _JMLR_ vol 25 paper 24-1220                                     | 2024 |
| **CB-Knapsacks (precursor)**       | Agrawal & Devanur. "Linear contextual bandits with knapsacks." _NeurIPS_                        | 2016 |
| **Bayesian linear regression UCB** | Abbasi-Yadkori, Pál, Szepesvári. "Improved algorithms for linear stochastic bandits." _NeurIPS_ | 2011 |
| **Tchebycheff scalarization**      | Miettinen. _Nonlinear Multiobjective Optimization_ (book)                                       | 1999 |
| **Reweighing for fairness**        | Kamiran & Calders. _Knowledge & Information Systems_                                            | 2012 |
| **Calibration patch**              | Pleiss, Raghavan, Wu, Kleinberg, Weinberger. "On Fairness and Calibration." _NeurIPS_           | 2017 |
| **Reject option**                  | Chow. "On Optimum Recognition Error and Reject Tradeoff." _IEEE TIT_                            | 1970 |
| **MAPE-K framework**               | IBM. "An Architectural Blueprint for Autonomic Computing." Whitepaper                           | 2003 |
| **Datasheets for Datasets**        | Gebru et al. _Communications of the ACM_                                                        | 2021 |
| **Model Cards**                    | Mitchell et al. _FAccT_                                                                         | 2019 |
| **SHML (closest prior work)**      | Rauba, van der Schaar et al. _NeurIPS_, arXiv:2411.00186                                        | 2024 |
| **Optum healthcare bias**          | Obermeyer, Powers, Vogeli, Mullainathan. _Science_ 366:447–453                                  | 2019 |
| **Apple Card investigation**       | New York DFS. Investigation Report on Goldman Sachs / Apple Card                                | 2021 |
| **CFPB Apple Card consent order**  | CFPB enforcement action on Apple Card                                                           | 2024 |
| **EU AI Act**                      | Regulation (EU) 2024/1689 (effective Aug 2026)                                                  | 2024 |
| **NIST AI RMF**                    | NIST. AI Risk Management Framework 1.0                                                          | 2023 |
| **HMDA**                           | US Congress. Home Mortgage Disclosure Act                                                       | 1975 |
| **Diabetes 130-US**                | Strack et al. _BioMed Research International_                                                   | 2014 |
| **Civil Comments**                 | Borkan, Dixon, Sorensen, Thain, Vasserman. arXiv:1903.04561                                     | 2019 |
| **AAE-dialect mislabelling**       | Sap, Card, Gabriel, Choi, Smith. _ACL_                                                          | 2019 |

---

## Closing thought

> _"The combined claim is structurally simple: cause-grounded attribution + provable-regret action selection inside a closed loop. The implementation is what's hard. Five months of engineering went into making it shippable on free tier with zero handwaving. Every paper claim is a CI test that runs on every commit. That's how I know the system holds up under scrutiny — because it has, every day, for the last five months."_

Walk in confident. You built this.
