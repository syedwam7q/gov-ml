# Aegis — Phase 3: Detection Services · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring up `services/detect-tabular` and `services/detect-text` — the two MAPE-K **Monitor** workers — and wire them so a scheduled Vercel Cron triggers them, they emit signals to Tinybird, and severity-≥-MEDIUM signals open `GovernanceDecision` rows in `state=detected` via the control plane. End-state: the **first end-to-end Detect → Decision lifecycle** is observable in the dashboard data even though the dashboard itself doesn't exist yet (we observe via REST + audit log).

**Architecture.** Each detect service is a uv-workspace member exposing one HTTP endpoint: `POST /detect/run` with body `{model_id, window_secs, reference_blob_url}`. The service queries Tinybird for the recent prediction window, runs Evidently / NannyML (tabular) or Alibi-Detect MMD on sentence-transformer embeddings (text), writes signal rows to Tinybird, and POSTs each severity-≥-MEDIUM signal to the control plane. The control plane creates a `GovernanceDecision` per signal and writes the corresponding `state=detected` audit-log row. A single Vercel Cron entry (`/api/cp/internal/cron/detect`) iterates the model registry and fans out to the appropriate detect service per model family.

**Tech Stack.** Evidently 0.4+ (tabular drift + fairness), NannyML 0.13+ (label-free perf est. — CBPE), fairlearn (subgroup metrics), Alibi-Detect 0.13+ (MMD on sentence-transformer embeddings), `sentence-transformers` `all-MiniLM-L6-v2`, FastAPI, httpx, Tinybird events API.

**Spec reference:** `docs/superpowers/specs/2026-04-28-aegis-design.md` (sections 3, 4.3, 5:Phase 1 Monitor, 8.2 ML-specific tests, 13:Phase 3).

---

## File structure created in Phase 3

```
gov-ml/
├── services/detect-tabular/
│   ├── pyproject.toml
│   ├── src/aegis_detect_tabular/
│   │   ├── __init__.py
│   │   ├── py.typed
│   │   ├── app.py                                # FastAPI app
│   │   ├── tinybird.py                           # query window + write signals
│   │   ├── detectors.py                          # Evidently + NannyML wrappers
│   │   └── routers/
│   │       └── detect.py
│   └── tests/
│       ├── test_app.py
│       └── test_detectors.py
├── services/detect-text/
│   ├── pyproject.toml                            # depends on aegis-pipelines[nlp]
│   ├── src/aegis_detect_text/
│   │   ├── __init__.py
│   │   ├── py.typed
│   │   ├── app.py
│   │   ├── tinybird.py                           # shared with tabular via aegis-shared
│   │   ├── embeddings.py                         # sentence-transformer cache + encode
│   │   ├── mmd.py                                # Alibi-Detect MMD wrapper
│   │   └── routers/
│   │       └── detect.py
│   └── tests/
│       ├── test_app.py
│       └── test_mmd.py
├── packages/shared-py/src/aegis_shared/
│   └── tinybird_client.py                        # tiny HTTP client + token helper
├── services/control-plane/src/aegis_control_plane/
│   ├── routers/
│   │   ├── signals.py                            # POST /api/v1/signals (signal → decision)
│   │   └── cron.py                               # /internal/cron/detect — fans out to services
│   └── audit_writer.py                           # uses AuditWriter to persist + chain
└── infra/tinybird/
    └── (already in place from Phase 2; no changes here)
```

---

## Tasks

### Task 1: `services/detect-tabular` workspace package + skeleton

- Add to root `[tool.uv.workspace] members`. Bootstrap `app.py` with a single placeholder `/detect/run` returning 501. Test asserts the endpoint exists and returns 501 with the structured "not yet implemented" body.

### Task 2: Tinybird client in `aegis-shared`

- Move the small "fetch + post events" helper into `aegis_shared.tinybird_client` so detect-tabular, detect-text, and the control plane all use the same code path. Auth via `TINYBIRD_TOKEN` env var. Tests use httpx-mock.

### Task 3: `detect-tabular` — Evidently drift + fairlearn fairness + NannyML CBPE

- `detectors.py` exposes `run_drift(reference_df, current_df) -> list[DriftSignal]`, `run_fairness(...) -> list[DriftSignal]`, `run_perf_estimate(...) -> list[DriftSignal]`.
- `app.py` wires the three together inside `/detect/run`.
- Tests use a fixture pair of pandas frames with a known PSI=0.30 induced shift and assert the detector returns a HIGH severity signal for the right metric.

### Task 4: `detect-text` — sentence-transformer encode + Alibi-Detect MMD

- `embeddings.py` lazily loads `all-MiniLM-L6-v2` (CPU-friendly) once per process; encodes a batch of comments to 384-D vectors.
- `mmd.py` wraps Alibi-Detect's `MMDDrift` with a fitted reference and returns p-value + signal.
- `/detect/text/run` accepts `{model_id, window_secs, ref_embeddings_url}` and returns the same `DriftSignal[]` shape.
- Tests use a fixture pair of synthetic embedding sets (one same-distribution, one shifted) and assert MMD detects.

### Task 5: Control-plane signals router

- `POST /api/v1/signals` accepts a `DriftSignal`, writes a `governance_decisions` row in `state=detected` if severity ≥ MEDIUM, and writes the corresponding audit-log row via `AuditWriter`. Idempotent on `(model_id, metric, observed_at)` to avoid duplicate decisions on retried POSTs.
- Tests use the ephemeral DB fixture from Phase 2 to verify the round-trip end-to-end.

### Task 6: Control-plane cron handler

- `GET /api/cp/internal/cron/detect` iterates the model registry, calls the appropriate detect service per family, awaits their signals, and posts each into `/api/v1/signals`. Vercel Cron from `vercel.ts` (already wired) hits this every 5 minutes.

### Task 7: End-to-end smoke test

- `tests/scenarios/test_detect_to_decision_e2e.py` boots the control plane against an ephemeral DB, mocks each detect service to return a fixed HIGH-severity signal, fires the cron handler, and asserts a `GovernanceDecision` and an audit-log row land in the database.

### Task 8: Setup + Vercel + push + tag

- Update `setup.md` with the run instructions for both detect services and the cron handler.
- Update `vercel.ts` `crons` to point at the real `/internal/cron/detect`.
- Push, tag `phase-3-complete`, verify CI.

---

## Self-review

**Spec coverage:**

| Spec §                         | Requirement                                | Task       |
| ------------------------------ | ------------------------------------------ | ---------- |
| 3 (MAPE-K Monitor)             | drift + fairness + calibration detection   | 3, 4       |
| 4.3 (detect services row)      | service contracts                          | 1, 2, 3, 4 |
| 5:Phase 1 (Monitor → Decision) | end-to-end loop                            | 5, 6, 7    |
| 6.1 audit_log writer           | append on state transition                 | 5          |
| 8.2 ML-specific tests          | drift detector sensitivity / specificity   | 3          |
| 13:Phase 3                     | detection services + first end-to-end loop | 1–8        |

**Placeholder scan:** No `TBD` / `TODO`. Each task names exact files and exact endpoints.

**Type consistency:** `DriftSignal` (defined in shared-py Phase 2) is the contract between detectors and the control plane. The signals router accepts `DriftSignal` and writes a `GovernanceDecision`. The cron handler treats them as opaque — no schema duplication.

**Scope check:** Phase 3 ships a working, observable end-to-end loop without a dashboard. The dashboard arrives in Phase 4 and consumes exactly the Tinybird pipes and `/api/v1/audit` endpoint we built here.

---

## What lands in Phase 4 (next plan)

- `apps/dashboard` (Next.js 16) + `apps/landing` (Next.js 16 SSG marketing).
- Clerk OTP login + 3-role RBAC.
- Editorial Dark design system from `packages/ui` instantiated.
- `/fleet`, `/models/[id]`, `/incidents`, `/audit`, `/policies`, `/datasets` pages — all reading from the control-plane REST + Tinybird endpoints we just built.
- Visual Apple-Card replay scenario (one stored decision walked from `detected` to `evaluated`).
