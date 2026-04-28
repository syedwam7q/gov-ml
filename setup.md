# Aegis · setup

Step-by-step installation, environment configuration, and run instructions. The "Prerequisites" block is verbatim-replayed nightly by `.github/workflows/setup-validator.yml` in a clean Ubuntu container — if it breaks, CI fails. Keep it accurate.

## Prerequisites

Tested on Ubuntu 24.04 LTS and macOS 14+.

<!-- setup-md-validator:start -->

# Node.js 22 + pnpm

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm@10

# Python 3.13 + uv

sudo apt-get install -y python3.13 python3.13-venv
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# Project dependencies

pnpm install --frozen-lockfile
uv sync --all-packages --frozen

# Verify everything is wired up

pnpm format:check
pnpm lint
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest -v
pnpm --filter @aegis/shared-ts generate
pnpm typecheck
pnpm test

<!-- setup-md-validator:end -->

## Local environment

1. Copy `.env.example` to `.env`:

   cp .env.example .env

2. Fill in the values for each section. The relevant signup pages and free-tier confirmations are documented next to each variable in `.env.example`. None of the services require a paid plan.

3. Generate the two HMAC secrets:

   openssl rand -hex 32 # → INTER_SERVICE_HMAC_SECRET
   openssl rand -hex 64 # → AUDIT_LOG_HMAC_SECRET

## Run

### ML pipelines

Each model has its own pipeline directory under `ml-pipelines/`. Phases 1a–1b ship credit and readmission; toxicity follows in 1c.

**Credit (HMDA, Phase 1a):**

    cd ml-pipelines/credit
    PATH=$HOME/.local/bin:$PATH uv run python 01_download.py            # downloads HMDA-CA-2017
    PATH=$HOME/.local/bin:$PATH uv run python 02_preprocess.py
    PATH=$HOME/.local/bin:$PATH uv run python 03_train.py               # ~2 min
    PATH=$HOME/.local/bin:$PATH uv run python 04_evaluate.py
    PATH=$HOME/.local/bin:$PATH uv run python 05_generate_artifacts.py

**Readmission (UCI Diabetes 130-US, Phase 1b):**

    cd ml-pipelines/readmission
    PATH=$HOME/.local/bin:$PATH uv run python 01_download.py            # downloads + extracts UCI ZIP
    PATH=$HOME/.local/bin:$PATH uv run python 02_preprocess.py
    PATH=$HOME/.local/bin:$PATH uv run python 03_train.py               # ~30 s
    PATH=$HOME/.local/bin:$PATH uv run python 04_evaluate.py
    PATH=$HOME/.local/bin:$PATH uv run python 05_generate_artifacts.py

**Toxicity (Jigsaw Civil Comments, Phase 1c):**

First install the heavy NLP stack (torch + transformers + datasets):

    PATH=$HOME/.local/bin:$PATH uv sync --all-packages --extra nlp

Then:

    cd ml-pipelines/toxicity
    PATH=$HOME/.local/bin:$PATH uv run python 01_download.py            # ~5 min, ~600 MB via HF
    PATH=$HOME/.local/bin:$PATH uv run python 02_preprocess.py
    PATH=$HOME/.local/bin:$PATH uv run python 03_train.py               # GPU recommended (Colab T4 free tier)
    PATH=$HOME/.local/bin:$PATH uv run python 04_evaluate.py
    PATH=$HOME/.local/bin:$PATH uv run python 05_generate_artifacts.py

> **Compute note:** real DistilBERT fine-tuning on the full 1.8M-comment Civil Comments corpus needs a GPU (~6 hours on Colab T4 free tier). The smoke test (`tests/test_toxicity_smoke.py`) uses a 87K-parameter tiny-random DistilBERT and runs on CPU in ~5s; it's what CI exercises.

Downloaded raw data lands in `data/raw/<model>/` (gitignored). Trained artifacts (model + metrics + model card + datasheet) land in `ml-pipelines/<model>/artifacts/`.

Each pipeline has a smoke test at `tests/test_smoke.py` that exercises the full pipeline on synthetic data in under 2 seconds and runs in CI on every PR.

> **macOS note:** XGBoost requires libomp. Install with `brew install libomp` once.

> **First-run pinning:** every pipeline's `config.py` has a placeholder SHA-256. The first `01_download.py` run will fail with the actual hash; paste it back into `config.py` and re-run. This is the deliberate reproducibility workflow.

### Control plane (Phase 2)

The FastAPI orchestrator that owns the audit log and exposes `/api/v1/*`.

**One-time provisioning (free tiers, $0):**

1.  **Neon Postgres** — sign up at <https://console.neon.tech>, create a project named `aegis`, then create two branches: `main` (production) and `dev` (local). Copy the **async** connection string for each branch:

        postgresql+asyncpg://user:pass@ep-xxx.region.aws.neon.tech/aegis?sslmode=require

    Paste the dev one into `.env` as `DATABASE_URL`.

2.  **HMAC secrets** — generate locally:

    openssl rand -hex 32 >> .env # then prefix with `INTER_SERVICE_HMAC_SECRET=`
    openssl rand -hex 64 >> .env # then prefix with `AUDIT_LOG_HMAC_SECRET=`

3.  **Apply migrations to your dev branch:**

        cd services/control-plane
        PATH=$HOME/.local/bin:$PATH uv run alembic upgrade head

    To preview the SQL without touching the database, run with `--sql`:

        PATH=$HOME/.local/bin:$PATH uv run alembic upgrade --sql head

**Run the control plane locally:**

    cd services/control-plane
    PATH=$HOME/.local/bin:$PATH uv run uvicorn aegis_control_plane.app:app --reload --port 8000

Then:

    curl -s localhost:8000/healthz | jq
    curl -s localhost:8000/readyz  | jq
    open  localhost:8000/docs        # FastAPI's auto-generated OpenAPI UI

**Apply Tinybird configuration (Phase 2 wiring; not strictly required until Phase 3):**

    brew install tinybirdco/tinybird/tinybird-cli   # macOS; `pip install tinybird-cli` on Linux
    tb auth                                          # paste your workspace token
    cd infra/tinybird && tb push --force

That uploads every `.datasource` / `.pipe` / `.endpoint` to Tinybird — the dashboard will read from the resulting REST endpoints once Phase 3 starts emitting signals.

### Dashboard (Phase 4)

The Next.js 16 dashboard at `apps/dashboard`. Editorial Dark, fully token-driven, ships with a complete demo dataset (Apple-Card-2019 hero scenario) so it walks end-to-end with no backend.

**One-time provisioning** (skip everything for local dev — the dashboard runs against the seeded mock fallback when keys are missing):

1.  **Clerk (auth)** — sign up at <https://dashboard.clerk.com>, create a "development" instance for local + a "production" instance for Vercel. Configure email-OTP only, no password sign-up. Copy the publishable + secret keys into `.env.local`:

        cp apps/dashboard/.env.example apps/dashboard/.env.local

    Then fill `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Both must be set together — when only one is present the dev-bypass refuses to engage and Clerk surfaces its own misconfig error.

2.  **Control-plane URL** — set `NEXT_PUBLIC_CONTROL_PLANE_URL` to wherever Phase 2's FastAPI is reachable (typically `http://localhost:8000` for local, the Vercel URL for production). When unset (or set to `mock`), the dashboard falls back to the seeded dataset in `apps/dashboard/app/_lib/mock-data.ts`.

3.  **Emergency stop** — `EMERGENCY_STOP=true` flips the global red banner across every page and freezes auto-actions. Default `false`.

**Run the dashboard locally:**

    pnpm --filter @aegis/dashboard dev

That boots Next 16 with Turbopack on <http://localhost:3000>. The chrome (top nav · left rail · ⌘J palette · ⌘K assistant · emergency banner) is alive on every route. With no backend running, every page reads from the mock fallback so the demo is always walkable.

**Live routes (16):**

| Route             | What it shows                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/fleet`          | 3-model fleet overview with KPIs, sparklines, live activity feed                                                                 |
| `/models`         | Model registry index                                                                                                             |
| `/models/[id]`    | 10 deep-link tabs: Overview · Drift · Fairness · Calibration · Performance · Causal DAG · Audit · Versions · Datasets · Policies |
| `/incidents`      | Decisions list with model · state · severity filters                                                                             |
| `/incidents/[id]` | TimelineScrubber · CausalDAG · ShapleyWaterfall · ParetoChart · audit chain — the demo showcase                                  |
| `/approvals`      | Pending-approval queue split by admin / operator tier                                                                            |
| `/audit`          | Paginated Merkle-chained log with verify-chain button + CSV export                                                               |
| `/policies`       | Per-model YAML policies with version history + dry-run / live toggle                                                             |
| `/datasets`       | Datasheets-for-Datasets (Gebru 2021) with schema + snapshot drift                                                                |
| `/compliance`     | EU AI Act · NIST AI RMF · ECOA · FCRA · HIPAA mapping with PDF export                                                            |
| `/chat`           | Full-screen Governance Assistant (UI shell; Groq backend in Phase 8)                                                             |
| `/settings`       | Profile · Notifications · Team · API tokens · Operations (admin emergency-stop)                                                  |
| `/design`         | Living style guide rendering every component — auto-404'd in production                                                          |
| `/api/health`     | Public liveness JSON                                                                                                             |

**Production build:**

    pnpm --filter @aegis/dashboard build
    pnpm --filter @aegis/dashboard start

The build prerenders 16 routes; dynamic segments (`/models/[id]`, `/incidents/[id]`, `/audit`, `/datasets`, `/policies`, `/incidents`) render on-demand. The `/design` route is statically prerendered as a 404 in production via the `NODE_ENV` guard inside the page itself.

**Component library:** every shared component lives in `packages/ui/src/components`. The token system is in `packages/ui/src/styles/tokens.css` — Tailwind reads it through CSS custom properties, so colors and typography never fork between CSS and JS.

## Test

    pnpm test          # vitest across @aegis/shared-ts and @aegis/ui
    uv run pytest -v   # pytest across packages/shared-py + ml-pipelines + control-plane

Tests that need a live Postgres are auto-skipped if `DATABASE_URL` is unset.

## Deploy

**Control plane → Vercel Functions Python.** Once you've linked the repo to Vercel (`vercel link` then `vercel`), set the production environment variables (Project Settings → Environment Variables):

| Var                                                             | Source                                            |
| --------------------------------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`                                                  | Neon `main` branch async connection string        |
| `AUDIT_LOG_HMAC_SECRET`                                         | `openssl rand -hex 64` (rotate yearly)            |
| `INTER_SERVICE_HMAC_SECRET`                                     | `openssl rand -hex 32`                            |
| `EMERGENCY_STOP`                                                | `false` (admin sets to `true` from the dashboard) |
| Plus everything from `.env.example` (Clerk, Tinybird, HF, Groq) |

**Dashboard → Vercel.** From the repo root, after `vercel link`:

    vercel --cwd apps/dashboard

Set the dashboard's environment variables in the Vercel project (production scope):

| Var                                               | Source                                                     |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Clerk production instance                                  |
| `CLERK_SECRET_KEY`                                | Clerk production instance                                  |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | `/login`                                                   |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | `/login` (OTP-only, no separate sign-up)                   |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/fleet`                                                   |
| `NEXT_PUBLIC_CONTROL_PLANE_URL`                   | The control-plane Vercel URL or `mock` for the seeded demo |
| `EMERGENCY_STOP`                                  | `false` (admin sets to `true` from /settings)              |

**HF Spaces → toxicity service** (Phase 4 onward) follows.

The full mapping of routes to deployment targets is in `vercel.ts` (typed config; comments in the file).

## Phase 5 — control-plane wiring (live data end-to-end)

After Phase 4 the dashboard renders against seeded fixtures. Phase 5 flips it to live data from the FastAPI control plane. The dashboard always renders — when the control plane is unreachable, it shows a friendly "demo mode" banner and continues to walk through the seeded Apple-Card-2019 hero scenario.

**1. Boot Postgres locally** (any version ≥ 15; use Docker for a clean slate):

    docker run -d --name aegis-pg -p 5432:5432 \
      -e POSTGRES_PASSWORD=aegis \
      -e POSTGRES_DB=aegis \
      postgres:16

    export DATABASE_URL=postgresql+asyncpg://postgres:aegis@127.0.0.1:5432/aegis

**2. Migrate the schema:**

    cd services/control-plane
    uv run alembic upgrade head
    cd -

**3. Configure required secrets** (one-time, per dev machine):

    export AUDIT_LOG_HMAC_SECRET=$(openssl rand -hex 64)
    export INTER_SERVICE_HMAC_SECRET=$(openssl rand -hex 32)

**4. Boot the control plane:**

    uv run --package aegis-control-plane uvicorn aegis_control_plane.app:app --port 8000

The control plane mounts every dashboard-facing route under `/api/cp/*` (single-prefix convention from Phase 5 Task 4). Smoke-test:

    curl -s http://127.0.0.1:8000/api/cp/reachability
    # → {"ok": true, "version": "0.1.0", "ts": "..."}

**5. Boot the dashboard against the live backend:**

    pnpm --filter @aegis/dashboard dev

Next dev rewrites `/api/cp/*` → `http://127.0.0.1:8000` (see `apps/dashboard/next.config.mjs`). Open `http://localhost:3000/fleet` — the "demo mode" banner should be gone and the activity feed should be live (subscribed to the FastAPI SSE stream at `/api/cp/stream`).

**6. Tinybird (optional — needed only for live KPI rollups):**

The KPI endpoints (`/api/cp/fleet/kpi`, `/api/cp/models/{id}/kpi`) read from three Tinybird pipes defined in `infra/tinybird/pipes/`. To deploy them to your Tinybird workspace:

    cd infra/tinybird
    tb auth --token "$TINYBIRD_TOKEN"
    tb push --force
    cd -

If `TINYBIRD_TOKEN` is unset, the KPI endpoints respond with HTTP 503 and the dashboard's `/fleet` page falls back to fixtures (the banner stays hidden — only the affected pages degrade).

**7. Verify the live loop end-to-end:**

- `/fleet` — three model cards, KPIs from Tinybird, activity feed live via SSE.
- `/incidents/<id>/` — pick any decision; the page renders the full MAPE-K timeline with audit-chained transitions.
- `/approvals` — clicking approve / deny on a pending row writes a real state transition; the audit chain extends; SSE broadcasts; activity feed updates without a page refresh.
- `/audit` — "verify chain" button calls `POST /api/cp/audit/verify` and renders the result inline; "export csv" streams the full chain.
- `/compliance` — five frameworks (EU AI Act, NIST AI RMF, ECOA, HIPAA, FCRA) with clause-level evidence pointers.

If you can scrub through `/incidents/<id>` and watch all six MAPE-K phases against the live backend, Phase 5 is wired correctly.

**Configuration knobs (Phase 5 additions):**

| Var                                | Default                   | Purpose                                                                         |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `TINYBIRD_TOKEN`                   | (empty)                   | Read token for `/api/cp/fleet/kpi` and `/api/cp/models/{id}/kpi`. 503 if unset. |
| `TINYBIRD_HOST`                    | `https://api.tinybird.co` | Override for EU region or self-hosted gateways                                  |
| `AEGIS_CONTROL_PLANE_DEV_URL`      | `http://127.0.0.1:8000`   | Where the Next dev rewrite proxies `/api/cp/*` (Phase 5 Task 5)                 |
| `AEGIS_CONTROL_PLANE_INTERNAL_URL` | (empty)                   | Server-side reachability probe target (production: same-origin via vercel.ts)   |

## Phase 6 — causal root-cause attribution (research extension 1)

After Phase 5 the dashboard reads live data; Phase 6 makes the
`causal_attribution` JSONB column on `governance_decisions` come from
a real attribution engine instead of seeded constants. This is the
first of the two paper-earning research contributions per spec §12.1.

**1. Boot the causal-attrib worker:**

    uv sync --all-packages
    uv run --package aegis-causal-attrib uvicorn aegis_causal_attrib.app:app --port 8003

Smoke-test:

    curl http://127.0.0.1:8003/healthz
    # → {"ok": true, "service": "causal-attrib", "version": "0.1.0"}

**2. Run the Apple-Card-2019 scenario test (gold-quality verification):**

    uv run pytest tests/scenarios/test_scenario_apple_card.py -v -m slow

This loads the credit-v1 DAG, runs DoWhy GCM `distribution_change`
against a co-applicant-shifted current frame, and asserts the full
pipeline (DAG load → DoWhy → recommend_action) produces a valid
`CausalAttribution`-shaped output with the dominant cause in the
upstream-of-target ancestor set.

**3. Run the Phase 6 paper-claim test (CI-merge-blocking):**

    uv run pytest services/causal-attrib/tests/test_shapley_efficiency.py -v

Asserts Σ φ_i ≈ v(N) − v(∅) within Monte-Carlo tolerance — the
load-bearing efficiency identity from Edakunni et al. 2024.

**4. Wire the control plane to the worker** (one-time per dev machine):

    export CAUSAL_ATTRIB_URL=http://127.0.0.1:8003

The control plane's analyze-state transition will then call
`POST /attrib/run` whenever a `GovernanceDecision` advances from
`detected` to `analyzed` _and_ the caller didn't supply an explicit
payload. The detection service attaches `reference_rows` and
`current_rows` to the decision's `drift_signal` so causal-attrib
has the data it needs.

**Configuration knobs (Phase 6 additions):**

| Var                 | Default                 | Purpose                                                                        |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `CAUSAL_ATTRIB_URL` | `http://localhost:8003` | Where the control plane reaches services/causal-attrib                         |
| `ATTRIB_TIMEOUT_S`  | `30.0`                  | Hard timeout per DoWhy GCM call (spec §12.1)                                   |
| `DBSHAP_SAMPLES`    | `2048`                  | Monte-Carlo permutation budget for the DBShap fallback                         |
| `CAUSAL_CACHE_SIZE` | `64`                    | In-process cache size keyed by (model_id, target, ref_fp, cur_fp, num_samples) |

## Phase 7 — Pareto-optimal action selection (research extension 2)

After Phase 6 the analyze-state transition produces real
`causal_attribution`. Phase 7 makes the plan-state transition produce
real `plan_evidence` — the Pareto front + chosen action that the
dashboard's `/incidents/<id>` page renders. The **second paper-earning
research contribution** per spec §12.2.

**1. Boot the action-selector worker:**

    uv sync --all-packages
    uv run --package aegis-action-selector uvicorn aegis_action_selector.app:app --port 8004

Smoke-test:

    curl http://127.0.0.1:8004/healthz
    # → {"ok": true, "service": "action-selector", "version": "0.1.0"}

**2. Run the regret-bound test (gold-quality verification of the paper claim):**

    uv run pytest services/action-selector/tests/test_regret_bounded.py -v

Asserts cumulative regret R(T) ≤ C · √(T·log T) · k for T ∈ {50, 100, 200}
plus a Hypothesis property test across 4 random seeds. Load-bearing
paper claim from Slivkins-Sankararaman-Foster (JMLR 2024) Theorem 3.1.

**3. Wire the control plane** (one-time per dev machine):

    export ACTION_SELECTOR_URL=http://127.0.0.1:8004

The control plane's plan-state transition will then call `POST /select`
whenever a `GovernanceDecision` advances from `analyzed` to `planned`
_and_ the caller didn't supply an explicit payload. The Phase 6
`recommended_action` is forwarded as the bandit's Bayesian prior.

**Configuration knobs (Phase 7 additions):**

| Var                   | Default                 | Purpose                                                  |
| --------------------- | ----------------------- | -------------------------------------------------------- |
| `ACTION_SELECTOR_URL` | `http://localhost:8004` | Where the control plane reaches services/action-selector |

## One-shot dev stack — `pnpm start:all`

For day-to-day development (and panel demos) the simplest boot is:

    pnpm start:all

This runs `scripts/start-all.sh` — single terminal, three services
(`control-plane:8000`, `assistant:8005`, `dashboard:3000`), color-coded
log prefixes, port pre-flight check, and clean teardown on **Ctrl+C**.

Variants:

    pnpm start:cp-and-assistant   # Skip the dashboard (pure backend dev)
    pnpm start:assistant-only     # Just the assistant + dashboard talks to a remote control plane

The script also adds `--reload-include='*.env'` to both Python services
so rotating `GROQ_API_KEY` in `.env` picks up automatically without a
manual kill-and-restart.

The per-service boot recipes below stay valid — use them when you want
to iterate on one service in isolation with a debugger attached.

---

## Phase 8 — Governance Assistant (`services/assistant`)

The Aegis Governance Assistant is a Groq-powered tool-using agent that
grounds every claim on a tool call against the live MAPE-K knowledge
plane. The dashboard's full-screen `/chat` page and the Cmd+K drawer
both consume its SSE endpoint.

**1. Boot the assistant:**

    # Required: a Groq dev-tier API key (free) — https://console.groq.com/keys
    export GROQ_API_KEY=gsk_...
    # Optional: override model rotation defaults.
    export GROQ_MODEL_QUALITY=llama-3.3-70b-versatile  # final synthesis
    export GROQ_MODEL_FAST=llama-3.1-8b-instant        # tool-call decisions

    uv sync --all-packages
    uv run --package aegis-assistant uvicorn aegis_assistant.app:app \
        --port 8005 --reload \
        --reload-include='*.py' --reload-include='*.env'

Smoke-test:

    curl http://127.0.0.1:8005/healthz
    # → {"ok": true, "service": "assistant", "version": "0.1.0"}

**Why `--reload-include='*.env'`:** `pydantic-settings` reads
`GROQ_API_KEY` from `.env` once at app boot. uvicorn's `--reload`
default only watches `*.py`, so rotating the key in `.env` had no
effect until the operator manually killed and restarted. Adding the
`.env` glob to the reload watcher means a key edit triggers an app
reload within ~1 second.

**2. Wire the dashboard:**

The Next.js dev server proxies `/api/assistant/*` to the assistant
service via `apps/dashboard/next.config.mjs` (default
`http://127.0.0.1:8005`; override via `AEGIS_ASSISTANT_DEV_URL`). With
both the control plane (port 8000) and the assistant (port 8005)
running, open the dashboard, hit `⌘K`, and type — the drawer opens a
tool-grounded conversation. The full-screen `/chat` route is the same
hook with a wider transcript.

When `GROQ_API_KEY` is unset, `/chat/stream` returns 503 and the
dashboard renders a clear "set GROQ_API_KEY" fallback. Health probes,
the activity feed, and every other page keep working.

**3. (Optional) Persist the Phase 7 bandit posterior to Redis:**

    export REDIS_URL=redis://localhost:6379

When set, the action-selector serializes each `model_id`'s
`CBKnapsack` posterior to `action_selector:bandit:<model_id>` after
every update. Restart the service and the posterior survives — no
re-warming required. Falls back to in-memory when unset, matching the
Phase 7 dev workflow.

**4. Replay Apple Card 2019 — the live demo button:**

The Fleet overview header carries a "Replay Apple Card 2019" CTA. It
posts to `/api/cp/internal/demo/apple-card`, which broadcasts a
choreographed sequence of `demo_*` SSE events the dashboard renders
as an animated MAPE-K walkthrough (drift detection → causal
attribution → Pareto-front planning → execution → audit). The same
drift gate at PSI ≥ 0.20 lights up the "Trigger live MAPE-K demo"
button on every model's drift tab.

**Configuration knobs (Phase 8 additions):**

| Var                       | Default                   | Purpose                                               |
| ------------------------- | ------------------------- | ----------------------------------------------------- |
| `GROQ_API_KEY`            | `""`                      | Dev-tier Groq key. Empty = `/chat/stream` returns 503 |
| `GROQ_MODEL_QUALITY`      | `llama-3.3-70b-versatile` | Final-synthesis model                                 |
| `GROQ_MODEL_FAST`         | `llama-3.1-8b-instant`    | Tool-call decision model                              |
| `CHAT_MAX_ITERATIONS`     | `6`                       | Hard cap on tool-call loop iterations per chat turn   |
| `TOOL_REQUEST_TIMEOUT_S`  | `10.0`                    | Per-request HTTP timeout for tool dispatchers         |
| `REDIS_URL`               | `""`                      | When set, action-selector persists posterior to Redis |
| `AEGIS_ASSISTANT_DEV_URL` | `http://127.0.0.1:8005`   | Where the dashboard proxies `/api/assistant/*` in dev |
