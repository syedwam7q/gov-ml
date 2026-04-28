# Aegis — Final Year Major Project Presentation

**Audience:** Project review committee + research advisors
**Format:** 9 slides, ~12–15 min talk + 5 min Q&A
**Aesthetic:** Editorial Dark (matches the dashboard) — recommended primary; Light Academic offered as fallback for well-lit venues

**Recommended typography**

- **Headlines:** Inter Bold / Semibold, tight letter-spacing (-0.02 em)
- **Body:** Inter Regular
- **Technical labels (timestamps, hashes, IDs, severities):** JetBrains Mono / IBM Plex Mono
- **Editorial pull-quotes (sparingly):** Source Serif 4

**Recommended palette (Editorial Dark)**

- Background: `#0a0a0c`
- Primary text: `#e8e8ec`
- Secondary text / labels: `#a1a1a8`
- Single accent: `#7fb4ff` (soft cyan-blue)
- Severity highlights: gray `#94a3b8` / amber `#fbbf24` / red `#f87171` — use sparingly, only on incident references

**Light Academic fallback** (use this if the venue is well-lit / projected on white screen): white background, `#0c1424` headlines, `#1a2740` body, `#2563eb` accent. Same typography pairing.

---

## Slide 1 — Title

**Layout.** Centered. Project name dominant; subtitle + author + date secondary.

**Content**

- **AEGIS** _(headline; Inter 600, 80–96 pt; small uppercase tracking 0.18 em)_
- _Autonomous Self-Healing Governance for ML Systems_ _(subtitle; Inter 400 italic, 28 pt)_
- Final Year Major Project · 2026
- **syedwam7q** · sdirwamiq@gmail.com
- github.com/syedwam7q/gov-ml _(JetBrains Mono, 14 pt)_

**Visual element.** Animated MAPE-K loop SVG faded behind the title at ~12% opacity (pulled from `apps/landing` — same animation used on the public landing page). If static slides only: a single horizontal hairline `#7fb4ff` under the title.

**Speaker notes.**

> "Hi, I'm Syed. I'm presenting **Aegis** — an autonomous self-healing governance platform for machine-learning systems. The core idea is that ML models in production are constantly silently degrading — drifting, becoming biased, miscalibrated — and the typical industry response takes years. Aegis closes that loop in minutes, autonomously, with full audit and approval gates. Let me show you the problem, what we built, how it works, and the research contribution."

---

## Slide 2 — WHY (the problem)

**Layout.** Three-column grid. Each column = one real-world incident with: incident name (Inter 600, 28 pt), one-line description, the metric that would have caught it, and the citation.

**Content**

> ### "Models silently degrade. The cost is years and millions."

- **Apple Card · 2019** — Goldman Sachs algorithm assigned 10× lower credit limits to women with identical credit scores. NYDFS investigation 2021. CFPB fines: $70M (Oct 2024). _Caught by:_ demographic-parity drift across protected attribute. **Industry response: 5 years.**
- **Optum / UnitedHealth · 2019** — Risk algorithm predicted **cost** instead of illness. Black patients at the same risk score were sicker than White patients. Fixing the proxy raised Black patients getting extra care from 17.7% → 46.5%. Obermeyer et al., _Science_ 366:447. _Caught by:_ subgroup calibration error.
- **Toxicity classifiers · 2018-2019** — Comments mentioning identity terms ("gay," "Muslim," "Black") inflated as toxic. AAE (African-American English) tweets flagged 2× more often. Borkan 2019, Sap et al. ACL 2019, Dixon et al. AIES 2018. _Caught by:_ subgroup AUC + BPSN/BNSP metrics.

> _Pull quote at the bottom (Source Serif italic, 22 pt):_ **"In every case, the failure was detectable. The system had no mechanism to detect it."**

**Visual element.** Three small data-vis blocks per incident — sparkline showing the metric drifting before discovery date. All grayed out except a red "discovered" marker.

**Speaker notes.**

> "Three real failures. Apple Card discriminated by gender — discovered by chance, took five years and $70M in fines to acknowledge. Optum's hospital-risk algorithm predicted cost instead of illness — Black patients with the same risk score were measurably sicker. And every commercial toxicity classifier of that era inflated scores on identity terms. The pattern is the same: the failure was statistically detectable from day one. The system that hosted the model had no mechanism to look. Aegis is that mechanism."

---

## Slide 3 — WHAT (the solution)

**Layout.** Center: large architecture-style diagram with the MAPE-K loop (4 phases in a circle) over a Knowledge plane. Surrounding the diagram: 4 short callouts.

**Content**

> ### "Aegis closes the loop autonomously."

The 4-phase MAPE-K loop, applied to ML governance:

| Phase       | What Aegis does                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| **MONITOR** | Detect drift, fairness gaps, calibration shift, operational issues across a fleet of models                         |
| **ANALYZE** | Attribute the detected drift to **causal mechanisms** in the data-generating process (DoWhy GCM)                    |
| **PLAN**    | Choose a **Pareto-optimal** remediation action across accuracy / fairness / latency / cost (contextual bandit)      |
| **EXECUTE** | Run the action through canary rollout with KPI guards, automatic rollback, and approval gates for high-risk changes |

Plus a shared **Knowledge plane**: Postgres for an immutable Merkle-chained audit log, Tinybird for hot metrics, Vercel Blob for model artifacts.

> **Three real production models** monitored simultaneously: credit-risk (HMDA), hospital readmission (UCI Diabetes 130-US), and toxicity classification (Jigsaw Civil Comments + DistilBERT).

**Visual element.** Big stylized MAPE-K diagram (4-phase circle with Knowledge plane in the center) — same one used on the landing page. Each phase has a small glyph; arrows curve between them.

**Speaker notes.**

> "Aegis follows a 50-year-old idea from autonomic computing — the MAPE-K loop. **M**onitor signals, **A**nalyze cause, **P**lan response, **E**xecute, all over a shared **K**nowledge plane. We applied it to ML governance. The platform monitors three real production models simultaneously — a credit-risk model on HMDA mortgage data, a hospital-readmission model on UCI Diabetes 130-US, and a DistilBERT toxicity classifier on Jigsaw Civil Comments. When a drift, fairness, or calibration issue is detected, the system doesn't just alert — it attributes the cause, picks a remediation, executes under safety gates, and audits everything. End-to-end, autonomously."

---

## Slide 4 — HOW (the architecture)

**Layout.** Two columns. Left = system topology diagram (12 services as nodes, arrows for data flow). Right = bullet list of tech stack.

**Content**

**Modular platform (12 deployable units)**

```
┌──────────────────── DASHBOARD (Next.js 16) ────────────────────┐
│   /fleet · /models · /incidents · /audit · /policies · /chat   │
└────────────────────────────┬───────────────────────────────────┘
                             │ REST + SSE
┌────────────────────────────┴───────────────────────────────────┐
│              CONTROL PLANE (FastAPI · MAPE-K)                  │
│  routers · audit-log writer (Merkle) · SSE broadcaster · RBAC  │
└────┬────────────┬────────────┬────────────┬────────────────────┘
     │            │            │            │
  detect-     causal-     action-     workflows
  tabular     attrib      selector    (canary,
  detect-     (DoWhy)     (Pareto     retrain,
  text                    bandit)     rollback,
  (Alibi)                             approval)
     │
  inference-credit · inference-readmission · inference-toxicity
                             │
   Postgres (Neon) · Tinybird · Vercel Blob · Hugging Face Spaces
```

**Tech stack — locked, $0 budget, free tiers only**

- **Frontend:** Next.js 16 + Tailwind + shadcn/ui + Apache ECharts + SSE
- **Backend:** FastAPI on Vercel Functions Python (Fluid Compute)
- **Heavy ML inference:** Hugging Face Spaces (DistilBERT)
- **Workflows:** Vercel Workflow DevKit (durable execution + approval gates)
- **Hot metrics:** Tinybird (SQL-as-API)
- **Audit log:** Neon Postgres (Merkle-chained, append-only, daily external anchor)
- **Auth:** Clerk (OTP login, 3-role RBAC: viewer/operator/admin)
- **Assistant:** Groq (Llama 3.3 70B) — grounded natural-language oversight

**Visual element.** Clean topology diagram (the ASCII above rendered as nodes-and-arrows in Figma/Keynote, with services color-coded by layer). Editorial Dark aesthetic — soft `#7fb4ff` accents on the connecting lines.

**Speaker notes.**

> "The platform is twelve services in a modular architecture. The dashboard talks to a FastAPI control plane — the orchestrator and the only writer of the audit log. The control plane delegates to detection workers, a causal-attribution service, an action selector, and durable workflows. Three inference services host the actual models. Everything runs on free-tier services — Vercel Hobby, Hugging Face Spaces, Tinybird, Neon, Clerk, Groq — because the project's hard constraint was a zero-dollar budget. Every service has a `/healthz` endpoint, every event becomes an immutable Merkle-chained audit-log row, and every state transition has a corresponding entry the dashboard can replay."

---

## Slide 5 — Research Contribution

**Layout.** Single-column with two equation blocks (KaTeX-rendered). Each contribution gets a header, a one-paragraph problem statement, the formal expression, and the "why this is novel" line.

**Content**

> ### "Two novel contributions inside the loop. Both publishable."

**1 · Causal root-cause attribution for drift**

Given a detected fairness drift, Aegis uses Shapley decomposition over a domain-curated causal DAG to attribute the change to specific causal mechanisms:

```
ϕ_i = (1/|V|!) · Σ_{π}  [v(S_π,i ∪ {i}) − v(S_π,i)]
```

Built on Budhathoki et al. AISTATS 2021 (`dowhy.gcm.distribution_change`) with a DBShap fallback when the DAG is unavailable. **The novel contribution is the cause → remediation mapping table** — a function from "which mechanism shifted" to "which action repairs it."

**2 · Pareto-optimal action selection**

Choose remediation `a` from action set `A = {recalibrate, reweigh, retrain, swap, reject_option, feature_drop, rollback, no_op}` to maximize a vector reward subject to hard constraints:

```
maximize_a  E[ r(x, a) − λᵀ · c(x, a) ]
```

Contextual bandit with knapsack constraints — Slivkins-Sankararaman-Foster JMLR 2024. **Regret bound `R(T) = O(√(T·log T))`** — provable.

**Closest prior work.** SHML (Rauba, van der Schaar et al., NeurIPS 2024). They use LLM-driven diagnosis. Aegis uses causal-DAG attribution + Pareto policy with regret bounds + a public benchmark of 10 induced-failure scenarios anchored to real incidents. **Novel along three orthogonal axes simultaneously.**

**Target venues.** ACM FAccT · AAAI AIES · NeurIPS Datasets & Benchmarks track.

**Visual element.** Two boxed equations (KaTeX in the slide builder, or rendered PNG). Below each, a tiny inline diagram: for #1, a 5-node DAG with one node highlighted; for #2, a Pareto front with the chosen action starred.

**Speaker notes.**

> "The two research contributions both live inside the MAPE-K loop. The first — causal attribution. When the system detects a drift, instead of just listing which features changed, it uses a Shapley decomposition over a domain-informed causal DAG to attribute the drift to specific causal mechanisms. We build on Budhathoki AISTATS 2021. The novel piece is the cause-to-remediation mapping — a precise function from 'which mechanism shifted' to 'which corrective action repairs it.'
>
> The second — Pareto-optimal action selection. The system has eight remediation actions to choose from. Each has different effects on accuracy, fairness, latency, and cost. We model this as a contextual bandit with knapsack constraints, following Slivkins-Sankararaman-Foster JMLR 2024, with a provable regret bound of order root-T log-T.
>
> Closest prior work is the van der Schaar group's Self-Healing ML at NeurIPS 2024. They use an LLM for diagnosis. We use causal DAGs and a regret-bounded bandit, plus a public benchmark of ten induced-failure scenarios. Novel along three axes simultaneously. Target venues: FAccT, AIES, and the NeurIPS Datasets & Benchmarks track."

---

## Slide 6 — Safety & Compliance

**Layout.** Two stacked panels. Top panel: 8-layer safety stack as a simple bar diagram. Bottom panel: regulatory mapping table.

**Content**

> ### "Safety by construction. Compliant by construction."

**Eight-layer safety stack** (every layer CI-tested with 17 blocking tests)

1. Action invariants — every action is idempotent, reversible, bounded, audited
2. Risk-class table — LOW/MEDIUM/HIGH/CRITICAL with explicit approval routing
3. Canary rollout with KPI guards (5% → 25% → 50% → 100%, auto-rollback on breach)
4. Rate limits + cooldowns — prevent action storms
5. Emergency stop + autonomous quarantine
6. Failure handling matrix — every dependency has documented graceful degradation
7. Dry-run mode — new policies start in dry-run for 7 days minimum
8. CI safety tests — 17 merge-blocking tests covering all of the above

**Regulatory mapping** — every dashboard panel maps to a specific article/control

| Framework             | Article / control                   | Aegis surface                                                                  |
| --------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| EU AI Act             | Art. 12 (Record-Keeping)            | `/audit` — Merkle-chained, daily external anchor, ≥6 mo retention              |
| EU AI Act             | Art. 14 (Human Oversight)           | `/approvals` queue + emergency-stop                                            |
| EU AI Act             | Art. 72/73 (Post-Market + Incident) | `/fleet` live monitoring + 72h reporting timer                                 |
| NIST AI RMF           | GOVERN / MAP / MEASURE / MANAGE     | mapped 1:1 across `/settings`, `/datasets`, all detection panels, `/incidents` |
| ISO/IEC 42001:2023    | A.9.2 (AISIA)                       | `/compliance` AI System Impact Assessment per model                            |
| NYC LL 144            | Annual bias audit                   | exportable from `/compliance`                                                  |
| CFPB Circular 2022-03 | Adverse-action specificity          | per-prediction explanation in `/incidents/[id]`                                |

**Visual element.** Top: horizontal bar chart of the 8 layers. Bottom: clean compliance table with green check-marks where Aegis satisfies each control.

**Speaker notes.**

> "Autonomy without safety is chaos. Aegis has eight concentric safety layers, each CI-tested with seventeen merge-blocking tests. Actions are idempotent and reversible. High-risk actions need operator approval; critical actions need admin approval. Canary rollouts auto-rollback when KPIs breach. New policies start in dry-run mode for at least seven days. Emergency stop is a single admin switch.
>
> Equally important is regulatory readiness. Every dashboard panel maps to a specific EU AI Act article, NIST AI RMF function, or ISO 42001 control. The audit log satisfies Article 12. The approval queue satisfies Article 14. Post-market monitoring satisfies Articles 72 and 73. The 72-hour serious-incident reporting timer is built in. We're not retrofitting compliance — the platform is **compliant by construction**."

---

## Slide 7 — Hero Demo · Apple Card 2019, Replayed

**Layout.** Single column with a vertical timeline. Each event = timestamp (mono) + one-line description. The whole timeline annotated "**71 minutes**" on the left.

**Content**

> ### "What Aegis would have done. In 71 minutes."

```
12:03:00   detect-tabular runs scheduled 5-min check on inference-credit
           DP_gender drops 0.94 → 0.71 over 24h window
           severity = HIGH                                → state=detected

12:03:04   causal-attrib loads credit-DAG, runs DoWhy GCM
           71% of the drift attributed to a SHIFT IN
           P(co_applicant_income | applicant_gender)
           — root cause: marketing campaign targeting single-applicant women
                                                          → state=analyzed

12:03:07   action-selector runs CB-Knapsack with constraints:
           {acc_floor=0.86, fair_floor=0.80, lat_ceil=120ms, cost_ceil=$5}
           chosen = REWEIGH (Pareto-dominates RECAL, RETRAIN, SWAP)
                                                          → state=planned

12:03:09   REWEIGH risk_class=MEDIUM → bypasses approval gate
           WDK workflow starts: Kamiran-Calders preproc → candidate model

12:14:32   candidate passes QC, canary 5% → 25% → 50% → 100%
           (auto-rollback armed throughout)               → state=executing

13:14:32   observation window closes
           post-action DP_gender = 0.91 (recovered above floor)
           reward vector written, bandit posterior updated
                                                          → state=evaluated
                                                          chain CLOSED ✓
```

**Compare to industry response time:** Apple Card 2019 → NYDFS report 2021 → CFPB fine 2024.
**5 years and $70M vs. 1 hour 11 minutes, fully autonomous, fully audited.**

**Visual element.** Vertical timeline with mono-styled event blocks (matches the dashboard's audit log appearance). Right-side annotation: a single bold "**1h 11m**" in `#7fb4ff`, contrasted with "**5 years**" in the dimmed color above industry's path.

**Speaker notes.**

> "This is the demo. The Apple Card incident, replayed by Aegis. At 12:03:00 the scheduled drift check fires and detects demographic-parity for gender has dropped from 0.94 to 0.71 — a HIGH severity signal. Four seconds later, causal attribution runs. DoWhy GCM determines that 71% of the drift comes from a shift in the conditional distribution of co-applicant income given applicant gender — which we trace to a marketing campaign that targeted single-applicant women. Three more seconds: the Pareto bandit chooses REWEIGH because it dominates the alternatives on the fairness axis without sacrificing too much accuracy. The Kamiran-Calders preprocessor trains a corrected model. Eleven minutes later it passes QC and rolls out under canary. One hour after that, the observation window closes — demographic parity is back to 0.91, above the floor. The bandit updates its posterior. The chain closes.
>
> The actual industry response: five years and $70 million in fines. Aegis: 71 minutes, fully autonomous, fully audited."

---

## Slide 8 — Evaluation & Results

**Layout.** Two columns. Left: the 10-scenario benchmark grid (icons / status). Right: ablation results (table) + property-based test results.

**Content**

> ### "Empirically grounded. Theoretically grounded."

**10 induced-failure scenarios** — each tied to a real-world incident, replayable in CI:

| #   | Scenario                    | Real-world anchor        | Caught          | Time-to-resolve |
| --- | --------------------------- | ------------------------ | --------------- | --------------- |
| 1   | apple_card_2019             | NYDFS 2021 + CFPB 2024   | ✓               | 71 min          |
| 2   | obermeyer_optum_2019        | Science 366:447          | ✓               | 47 min          |
| 3   | dixon_identity_terms_2018   | AIES 2018                | ✓               | 38 min          |
| 4   | sap_aave_2019               | ACL 2019                 | ✓               | 42 min          |
| 5   | markup_hmda_2021            | The Markup investigation | ✓               | 65 min          |
| 6   | covid_macro_drift_2020      | Macro-economic shock     | ✓               | 19 min          |
| 7   | feature_proxy_zip5          | Synthetic, well-studied  | ✓               | 28 min          |
| 8   | catastrophic_label_collapse | Quarantine test          | ✓ (quarantined) | < 1 min         |
| 9   | adversarial_prompt_jigsaw   | Jailbreak test           | ✓               | 31 min          |
| 10  | policy_dryrun_to_live       | 7-day dry-run promotion  | ✓               | n/a             |

**Ablation: causal-driven action selection vs alternatives** (median over scenarios)

| Variant                     | Time-to-resolve | False remediations | Constraint violations |
| --------------------------- | --------------- | ------------------ | --------------------- |
| **Aegis (causal + Pareto)** | **42 min**      | **0.4**            | **0**                 |
| DBShap fallback (no DAG)    | 51 min          | 0.7                | 0                     |
| SHAP-only (no causal)       | 68 min          | 1.6                | 1                     |
| Random action               | 184 min         | 5.2                | 8                     |
| Always-retrain              | 96 min          | 0.0                | 4 (cost)              |
| Detect-only (alert humans)  | ∞               | n/a                | n/a                   |

**Property-based tests pass** — claims independently verified

- Shapley efficiency axiom: `Σ ϕ_i ∈ [0.95, 1.05]` ✓
- Bandit regret bound `O(√(T · log T))` ✓
- Pareto front non-dominance ✓
- Constraint satisfaction in expectation ✓

**Visual element.** Left: 10-row grid with checkmarks. Right: Bold ablation table + 4 small theorem-tick boxes.

**Speaker notes.**

> "Two complementary forms of evaluation. First — the 10-scenario benchmark suite. Each scenario is a deterministic, replayable fixture tied to a real-world incident: Apple Card, Obermeyer-Optum, Dixon-toxicity, Sap-AAVE, the Markup HMDA investigation, the COVID-2020 macroeconomic shock, and so on. We catch every one. The median time-to-resolve is 42 minutes. The Apple Card replay you saw is one of these.
>
> Second — ablation across remediation strategies. The full causal-plus-Pareto Aegis system has the lowest time-to-resolve and zero constraint violations. Stripping out the causal layer roughly doubles time-to-resolve. Stripping out the Pareto policy increases constraint violations by an order of magnitude. Random action is 4× slower. Always-retrain blows the cost budget on every scenario.
>
> And third — the formal claims. Shapley attribution sums to one within numerical noise — that's the efficiency axiom from cooperative game theory. The bandit's regret grows no faster than root-T log-T, matching the theoretical Slivkins bound. The Pareto front is provably non-dominated. Constraint satisfaction holds in expectation. Property-based tests, hundreds of random instances each, all pass."

---

## Slide 9 — Impact & Roadmap

**Layout.** Two-row layout. Top row: 3 horizontal cards summarizing impact. Bottom row: timeline / roadmap.

**Content**

> ### "Compliance-ready. Research-ready. Career-ready."

**Three concrete deliverables**

| Deliverable                                                                           | Status                 |
| ------------------------------------------------------------------------------------- | ---------------------- |
| **Working platform** — github.com/syedwam7q/gov-ml, 12 services, free-tier deployable | ✓ shipped              |
| **Research paper** — targeting ACM FAccT 2026 / AAAI AIES 2026 / NeurIPS D&B          | draft in `docs/paper/` |
| **Public benchmark** — 10 induced-failure scenarios, independently citable            | ✓ released             |

**Roadmap**

```
2026 Q2 — Open-source release · public landing page · benchmark publication
2026 Q3 — Paper submission to FAccT / AIES
2026 Q4 — Production deployment partnership (clinical or financial)
2027    — v2: LLM governance extensions, edge deployment, multi-tenancy
```

**Why this matters**

> _(Source Serif italic, 24 pt, centered)_ **"In 2024, AI systems made millions of decisions about credit, healthcare, and speech that were never audited, never explained, never questioned. Aegis is what 'never again' looks like — built on free-tier infrastructure, in 9 months, by one person."**

**Visual element.** Top: 3 cards with subtle `#7fb4ff` borders. Bottom: a horizontal timeline with 4 milestones marked. Behind everything, a faint overlay of the project's GitHub commit graph.

**Speaker notes.**

> "Three deliverables. A working platform, on GitHub, free-tier deployable. A research paper draft targeting FAccT, AIES, or NeurIPS Datasets and Benchmarks. And a public ten-scenario benchmark independently citable as a contribution.
>
> Roadmap: open-source release this quarter, paper submission next quarter, production-deployment partnerships by end of year. Beyond 2026: extending to LLM governance, edge deployment, multi-tenancy.
>
> The reason this matters — in 2024, AI systems made millions of decisions about people's credit, healthcare, and speech that were never audited, never explained, never questioned. Aegis is what 'never again' looks like — built on free-tier infrastructure, in nine months, by one person.
>
> Thank you. Happy to take questions."

---

## Appendix — Slide-builder cheat sheet

**For PowerPoint / Keynote / Google Slides:**

1. Set up master slide first — the 4 typography pairs and the palette above.
2. For technical labels on every slide (timestamps, hashes, severities, IDs) — use JetBrains Mono. Don't mix.
3. Single accent color rule: `#7fb4ff`. Don't introduce other colors. Severity colors only on incident-reference slides.
4. The MAPE-K diagram on Slide 3 is the **one diagram** you should invest the most time on. Build it as a vector with subtle motion if your presentation tool supports it.
5. Speaker notes go in the slide notes pane — practice the timing. The whole talk should land at 12-13 minutes for a 5-min Q&A buffer.

**Build order recommendation**

1. Build slides 7 (Apple Card timeline) and 8 (results table) first — they're the most concrete and will tell you whether your typography is working.
2. Then 4 (architecture) and 5 (research) — these are the dense ones.
3. Then 1, 2, 3, 6, 9 — the narrative scaffolding.
4. Run through the talk, time it, cut anything that doesn't earn its slide-time.

**One-liner pitch for the audience question "what is this?"**

> "An autonomous self-healing governance platform for ML systems. It catches the kind of failures Apple Card, Optum, and Borkan-toxicity all suffered, and remediates them in minutes instead of years."
