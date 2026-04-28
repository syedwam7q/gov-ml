import "server-only";

/**
 * Server-side reachability probe — the dashboard's "is the backend up?" check.
 *
 * Runs once per RSC render (Next.js fetch deduping handles repeated calls
 * within a single request). The probe times out at 500 ms so a slow
 * backend doesn't slow page rendering — slow is treated the same as down,
 * which is the right outcome for the user-facing banner.
 *
 * Returns a small structural value the layout can pattern-match on, not
 * a boolean — the banner needs the timestamp of the probe so the user
 * can see how fresh the assessment is.
 *
 * Spec §10.2 (degraded-mode banner).
 */

const TIMEOUT_MS = 500;

export interface Reachability {
  readonly reachable: boolean;
  readonly version: string | null;
  readonly checkedAt: string;
  readonly target: string;
}

function probeUrl(): string {
  // Order of preference:
  //   1. Explicit override (production: same-origin via Vercel rewrite).
  //   2. Local FastAPI dev server.
  // The server-side probe runs in the Node runtime, where same-origin
  // calls require an absolute URL — Next can't resolve `/api/cp/...`
  // from a Server Component without a host.
  const explicit = process.env.AEGIS_CONTROL_PLANE_INTERNAL_URL;
  if (explicit) return `${explicit.replace(/\/$/, "")}/api/cp/reachability`;
  const dev = process.env.AEGIS_CONTROL_PLANE_DEV_URL ?? "http://127.0.0.1:8000";
  return `${dev.replace(/\/$/, "")}/api/cp/reachability`;
}

export async function checkReachability(): Promise<Reachability> {
  const target = probeUrl();
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      cache: "no-store",
      signal: controller.signal,
      // Avoid Next's RSC fetch dedupe so we always probe fresh per request.
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return { reachable: false, version: null, checkedAt, target };
    }
    const body = (await res.json()) as { ok?: boolean; version?: string };
    if (body.ok !== true) {
      return { reachable: false, version: null, checkedAt, target };
    }
    return {
      reachable: true,
      version: body.version ?? null,
      checkedAt,
      target,
    };
  } catch {
    // Timeout, network error, abort — all treated as unreachable.
    return { reachable: false, version: null, checkedAt, target };
  } finally {
    clearTimeout(timer);
  }
}
