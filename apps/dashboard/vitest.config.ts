import { defineConfig } from "vitest/config";

/**
 * Vitest config for the dashboard's unit + integration tests.
 *
 * Playwright E2E specs live under `tests/e2e/` and run via
 * `pnpm exec playwright test` — vitest must not pick them up because
 * `@playwright/test` exports a `test` symbol with a different shape
 * than vitest's, which would fail to parse here.
 */
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/.next/**", "tests/e2e/**", "playwright-report/**"],
    passWithNoTests: true,
  },
});
