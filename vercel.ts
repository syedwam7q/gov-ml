import { type VercelConfig } from "@vercel/config/v1";

/**
 * Aegis Vercel project config.
 *
 * Runtime layout on Vercel:
 *   /                    → apps/dashboard (Next.js 16)
 *   /api/cp/*            → services/control-plane (FastAPI on Fluid Compute Python)
 *   /api/detect/*        → services/detect-{tabular,text} (Phase 3)
 *   /api/causal/*        → services/causal-attrib (Phase 5)
 *   /api/select/*        → services/action-selector (Phase 6)
 *   /api/assistant/*     → services/assistant (Phase 8)
 *
 * Heavy ML inference (DistilBERT toxicity + sentence-transformer detector)
 * runs on Hugging Face Spaces — not on Vercel — and the dashboard / control
 * plane talks to the Spaces over HTTPS.
 *
 * The Vercel Cron block fires the Phase 3 detection scheduler. Until that
 * lands, the cron points at a no-op endpoint on the control plane that
 * just records a heartbeat — useful for confirming Vercel Cron itself is
 * wired correctly.
 */
export const config: VercelConfig = {
  buildCommand: "pnpm turbo build",
  framework: "nextjs",
  outputDirectory: "apps/dashboard/.next",
  // Skip the dashboard re-deploy when only ml-pipelines / docs changed.
  ignoreCommand: "git diff HEAD^ HEAD --quiet -- apps/ packages/ services/ workflows/ vercel.ts",
  crons: [
    // Heartbeat — proves cron infrastructure is alive. Single public path
    // prefix `/api/cp/*` (Phase 5 alignment) so cron paths match what
    // appears in `services/control-plane/src/.../routers/cron.py`.
    {
      path: "/api/cp/internal/cron/heartbeat",
      schedule: "*/5 * * * *",
    },
    // Detection fan-out — Phase 3 Monitor stage. Iterates the model
    // registry and POSTs /detect/run to each detect service.
    {
      path: "/api/cp/internal/cron/detect",
      schedule: "*/5 * * * *",
    },
  ],
  rewrites: [
    // Mount the control-plane FastAPI app under /api/cp/*. The Vercel
    // Functions Python runtime resolves the handler via services/control-plane.
    { source: "/api/cp/:path*", destination: "/services/control-plane/api/:path*" },
    // Phase 6 — causal-attrib worker under /api/causal/*. Read by the
    // control plane (server-side) at CAUSAL_ATTRIB_URL.
    { source: "/api/causal/:path*", destination: "/services/causal-attrib/api/:path*" },
    // Phase 7 — action-selector worker under /api/select/*. Read by the
    // control plane (server-side) at ACTION_SELECTOR_URL.
    { source: "/api/select/:path*", destination: "/services/action-selector/api/:path*" },
  ],
  redirects: [],
  headers: [
    // Long-lived CDN cache for static dashboard assets.
    {
      source: "/_next/static/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ],
};

export default config;
