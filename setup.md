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

Phase 0 has no runnable services yet — only the shared packages, tests, and CI scaffolding. Subsequent phases each add their own run instructions to this section.

## Test

    pnpm test          # vitest across @aegis/shared-ts and @aegis/ui
    uv run pytest -v   # pytest across packages/shared-py and tests/

## Deploy

Deployment to Vercel + Hugging Face Spaces lands in Phase 2 (control plane) and Phase 4 (dashboard).
