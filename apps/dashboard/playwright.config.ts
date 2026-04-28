import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the Aegis dashboard E2E suite.
 *
 * The suite assumes the full live stack is running:
 *   • Postgres on the URL pointed to by DATABASE_URL
 *   • FastAPI control plane (services/control-plane) on port 8000
 *     with `AEGIS_SEED_HERO=true` and AUDIT_LOG_HMAC_SECRET set
 *   • Next.js dashboard dev server on port 3000
 *
 * Running locally: see `tests/e2e/README.md` for the full sequence.
 *
 * In CI a workflow boots all three services before invoking
 * `pnpm exec playwright test`. The webServer block below auto-boots the
 * dashboard so devs only need to bring up the backend services
 * (Postgres + FastAPI) before running the spec.
 */
export default defineConfig({
  testDir: "tests/e2e",
  // Tests inside a single spec share state (one decision walked across
  // pages); running them serially keeps the narrative coherent.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.AEGIS_DASHBOARD_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Skip the Clerk auth gate in development by hitting fleet directly —
    // the dev-bypass middleware (proxy.ts) takes over when Clerk env vars
    // are absent.
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    stdout: "pipe",
  },
});
