# Aegis dashboard E2E tests

Playwright suite that walks the Apple-Card-2019 hero scenario across the
live stack. The spec verifies every Phase 5 wire — fleet rollup, incident
timeline, audit verify, CSV export, compliance mapping, dataset registry,
and the SSE activity feed.

## Running locally

1. **Boot Postgres** (any version ≥ 15; spec § Phase 5 of `setup.md` shows
   the Docker one-liner). Then export `DATABASE_URL`:

   ```sh
   export DATABASE_URL="postgresql+asyncpg://postgres:aegis@127.0.0.1:5432/aegis"
   ```

2. **Migrate + boot the FastAPI control plane** with the hero seeder
   enabled:

   ```sh
   cd services/control-plane
   uv run alembic upgrade head
   cd -

   export AUDIT_LOG_HMAC_SECRET=$(openssl rand -hex 64)
   export AEGIS_SEED_HERO=true
   uv run --package aegis-control-plane uvicorn aegis_control_plane.app:app --port 8000
   ```

   The first heartbeat (`curl http://127.0.0.1:8000/api/cp/internal/cron/heartbeat`)
   triggers the seeder; subsequent calls are no-ops.

3. **Install Playwright browsers** (one-time per machine):

   ```sh
   pnpm --filter @aegis/dashboard exec playwright install chromium
   ```

4. **Run the suite.** Playwright auto-boots `pnpm dev` via the
   `webServer` block in `playwright.config.ts`, so you only need the
   backend up:

   ```sh
   pnpm --filter @aegis/dashboard exec playwright test
   ```

   For an interactive run with the UI mode:

   ```sh
   pnpm --filter @aegis/dashboard exec playwright test --ui
   ```

## What each test covers

| Spec test                                                | What it verifies                                       |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `/fleet renders the three-model fleet overview`          | Models endpoint live; dashboard renders 3 model cards. |
| `/incidents/<hero> renders the full MAPE-K timeline`     | Hero decision page renders the seeded payloads.        |
| `/audit verify-chain button reports a valid chain`       | `verifyChain()` wire works against the live verifier.  |
| `/audit export.csv link points at the streaming backend` | The download link points at the live endpoint.         |
| `/compliance lists every framework`                      | Compliance endpoint returns 5 frameworks.              |
| `/datasets serves the three real-world corpora`          | Dataset registry seeded + endpoint serves them.        |
| `activity feed updates after a state transition`         | SSE frame from the heartbeat triggers a feed update.   |

The activity-feed test self-skips when the backend is unreachable — the
other six tests run against either live or fallback mode and assert the
dashboard renders correctly in both.

## CI

A future `.github/workflows/e2e.yml` workflow can run the suite by
spinning up the Postgres service container, booting the FastAPI server
in the background, and invoking `pnpm exec playwright test` with the
default project. Land that workflow alongside Phase 6 — it's deferred
out of Phase 5b because it requires the full deployment pipeline to
land first.
