import { test, expect } from "@playwright/test";

/**
 * End-to-end walk of the Phase 8 Governance Assistant surface.
 *
 * This suite is *graceful* — it succeeds against three configurations:
 *   1. assistant up + GROQ_API_KEY set → full live answer.
 *   2. assistant up + GROQ_API_KEY unset → 503 fallback message.
 *   3. assistant unreachable → "could not reach the assistant" message.
 *
 * The first scenario is what the panel sees with a live key. The other
 * two are the safe fallback paths — they both still leave the
 * dashboard walkable, which is what we need to guarantee in CI.
 */

const ANSWER_PATTERNS =
  /credit-v1|toxicity-v1|readmission-v1|set GROQ_API_KEY|could not reach|unavailable/i;

test.describe("Aegis dashboard · governance assistant", () => {
  test("/chat renders the workspace and accepts a message", async ({ page }) => {
    await page.goto("/chat");

    // Header chrome from Phase 4b is still there.
    await expect(page.getByText(/governance assistant/i).first()).toBeVisible();
    await expect(page.getByText(/grounded on a tool-call/i)).toBeVisible();

    // The composer is enabled and ⏎-sends.
    const composer = page.getByLabel(/message the assistant/i);
    await expect(composer).toBeEnabled();
    await composer.fill("What models are we monitoring?");
    await composer.press("Enter");

    // One of the three scenarios above must surface within 30 seconds.
    await expect(page.getByText(ANSWER_PATTERNS).first()).toBeVisible({ timeout: 30_000 });
  });

  test("⌘K opens the drawer and the composer focuses", async ({ page }) => {
    await page.goto("/fleet");
    // Cmd+K on macOS / Ctrl+K elsewhere — Playwright's `Meta+K` covers macOS.
    await page.keyboard.press("Meta+K");
    const drawer = page.getByRole("dialog", { name: /governance assistant/i });
    await expect(drawer).toBeVisible();
    // The drawer's textarea exists and accepts focus.
    const drawerComposer = drawer.getByLabel(/ask the assistant/i);
    await expect(drawerComposer).toBeFocused({ timeout: 5_000 });
    // ESC closes.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
});

test.describe("Aegis dashboard · Replay Apple Card 2019 demo", () => {
  test("Demo button on /fleet opens the theater", async ({ page }) => {
    await page.goto("/fleet");
    const cta = page.getByRole("button", {
      name: /Replay Apple Card 2019.*live MAPE-K demo/i,
    });
    await expect(cta).toBeVisible();
    await cta.click();
    // The theater opens — title bar carries the scenario name and the
    // briefing scene shows the MAPE-K stage chips.
    const theater = page.getByRole("dialog", {
      name: /apple card 2019 demo/i,
    });
    await expect(theater).toBeVisible({ timeout: 5_000 });
    await expect(theater.getByText(/Apple Card 2019 — fairness drift/i)).toBeVisible();
    // The progress bar shows all 7 scene labels.
    for (const label of [
      "Briefing",
      "Detection",
      "Analysis",
      "Planning",
      "Execution",
      "Audit",
      "Outcome",
    ]) {
      await expect(theater.getByText(label, { exact: false })).toBeVisible();
    }
  });
});
