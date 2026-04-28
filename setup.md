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

**Dashboard → Vercel** (Phase 4) and **HF Spaces → toxicity service** (Phase 4) follow.

The full mapping of routes to deployment targets is in `vercel.ts` (typed config; comments in the file).
