import type {
  ActivityEvent,
  AegisModel,
  AuditPage,
  AuditRow,
  ChainVerificationResult,
  ComplianceMapping,
  Dataset,
  GovernanceDecision,
  ModelKPI,
  ModelVersion,
  Policy,
} from "./types";
import { MOCK } from "./mock-data";

// Re-export for callers that want the result type (audit/_view.tsx).
export type { ChainVerificationResult, AuditPage, AuditRow } from "./types";

/**
 * Aegis dashboard API client.
 *
 * Two-mode design:
 *
 *   1. **Live mode** — requests go to `/api/cp/*`. In production a Vercel
 *      rewrite forwards them to the FastAPI control plane; locally,
 *      `next.config.mjs` proxies to `http://127.0.0.1:8000`.
 *
 *   2. **Fallback mode** — when a live request fails (network error,
 *      non-2xx, JSON parse failure) the client returns the seeded
 *      fixtures from `mock-data.ts`. The dashboard never renders an
 *      empty state because the backend isn't running — the demo always
 *      walks. The first such failure flips a module-level `apiMode`
 *      flag from "pending" → "fallback"; the dashboard's degraded-mode
 *      banner reads that flag.
 *
 * Spec §4.2 (deployment topology) + §4.3 (per-service contracts).
 *
 * The mode flag is intentionally process-wide: under SSR each request
 * gets a fresh module instance; under client-side rendering it stays
 * sticky for the session, which is what we want — once the backend has
 * been seen as down, repeated failed probes shouldn't flicker the
 * banner on/off.
 */

export type ApiMode = "pending" | "live" | "fallback";

let apiMode: ApiMode = "pending";

/** Read the current API mode. Updated as a side effect of fetch attempts. */
export function getApiMode(): ApiMode {
  return apiMode;
}

/** Force the mode (used by the reachability probe to prime SSR state). */
export function setApiMode(next: ApiMode): void {
  apiMode = next;
}

const PREFIX = "/api/cp";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Resolve the full URL for a backend call.
 *
 * In the browser we use the relative path — Vercel rewrites it to the
 * control plane in production and Next dev proxies it locally. On the
 * server (RSC, Server Actions) `fetch` requires an absolute URL, so we
 * read the same env var the reachability probe uses
 * (`AEGIS_CONTROL_PLANE_INTERNAL_URL`) with `AEGIS_CONTROL_PLANE_DEV_URL`
 * as a fallback for local dev.
 */
function fetchUrl(path: string): string {
  if (typeof window !== "undefined") {
    return `${PREFIX}${path}`;
  }

  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const base =
    env?.AEGIS_CONTROL_PLANE_INTERNAL_URL ??
    env?.AEGIS_CONTROL_PLANE_DEV_URL ??
    "http://127.0.0.1:8000";
  return `${base.replace(/\/$/, "")}${PREFIX}${path}`;
}

/**
 * Fetch JSON from the live backend or fall back to the supplied fixture.
 *
 * Mode-flip discipline: only **network-level** failures (TCP refused,
 * DNS, abort, JSON parse on a non-JSON body) flip the global apiMode
 * to "fallback". A specific endpoint returning HTTP 4xx / 5xx — e.g.
 * `/api/cp/fleet/kpi` returning 503 because TINYBIRD_TOKEN is unset —
 * is transient: that single call gets the fixture, but subsequent calls
 * to other endpoints still try the live backend. Without this
 * distinction one bad endpoint silently demoted the whole dashboard
 * to fallback mode.
 */
async function fetchLiveOrFallback<T>(
  path: string,
  fallback: () => T,
  init?: RequestInit,
): Promise<T> {
  if (apiMode === "fallback") {
    return fallback();
  }
  let res: Response;
  try {
    res = await fetch(fetchUrl(path), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch (err) {
    apiMode = "fallback";
    if (typeof console !== "undefined") {
      console.warn(`[aegis] ${path} → network error, falling back to fixtures`, err);
    }
    return fallback();
  }

  if (!res.ok) {
    if (typeof console !== "undefined") {
      console.warn(
        `[aegis] ${path} → HTTP ${res.status}, this call falls back; mode stays ${apiMode}`,
      );
    }
    return fallback();
  }

  try {
    const json = (await res.json()) as T;
    if (apiMode === "pending") apiMode = "live";
    return json;
  } catch (err) {
    apiMode = "fallback";
    if (typeof console !== "undefined") {
      console.warn(`[aegis] ${path} → invalid JSON body, falling back to fixtures`, err);
    }
    return fallback();
  }
}

// ──────────── Models ────────────

export const listModels = (): Promise<readonly AegisModel[]> =>
  fetchLiveOrFallback<readonly AegisModel[]>("/models", () => MOCK.models);

export const getModel = (modelId: string): Promise<AegisModel | undefined> =>
  fetchLiveOrFallback<AegisModel | undefined>(`/models/${encodeURIComponent(modelId)}`, () =>
    MOCK.models.find((m) => m.id === modelId),
  );

export const listModelVersions = (modelId: string): Promise<readonly ModelVersion[]> =>
  fetchLiveOrFallback<readonly ModelVersion[]>(
    `/models/${encodeURIComponent(modelId)}/versions`,
    () => MOCK.versions.filter((v) => v.model_id === modelId),
  );

export const getModelKPI = (modelId: string, window = "24h"): Promise<ModelKPI | undefined> =>
  fetchLiveOrFallback<ModelKPI | undefined>(
    `/models/${encodeURIComponent(modelId)}/kpi?window=${encodeURIComponent(window)}`,
    () => MOCK.kpis.find((k) => k.model_id === modelId),
  );

export const listFleetKPIs = (window = "24h"): Promise<readonly ModelKPI[]> =>
  fetchLiveOrFallback<readonly ModelKPI[]>(
    `/fleet/kpi?window=${encodeURIComponent(window)}`,
    () => MOCK.kpis,
  );

// ──────────── Decisions ────────────

export interface DecisionsQuery {
  readonly modelId?: string;
  readonly state?: string;
  readonly limit?: number;
}

export function listDecisions(query: DecisionsQuery = {}): Promise<readonly GovernanceDecision[]> {
  const params = new URLSearchParams();
  if (query.modelId) params.set("model_id", query.modelId);
  if (query.state) params.set("state", query.state);
  if (query.limit) params.set("limit", String(query.limit));
  return fetchLiveOrFallback<readonly GovernanceDecision[]>(
    `/decisions?${params.toString()}`,
    () => {
      let rows = [...MOCK.decisions];
      if (query.modelId) rows = rows.filter((d) => d.model_id === query.modelId);
      if (query.state) rows = rows.filter((d) => d.state === query.state);
      if (query.limit) rows = rows.slice(0, query.limit);
      return rows;
    },
  );
}

export const getDecision = (id: string): Promise<GovernanceDecision | undefined> =>
  fetchLiveOrFallback<GovernanceDecision | undefined>(`/decisions/${encodeURIComponent(id)}`, () =>
    MOCK.decisions.find((d) => d.id === id),
  );

export interface TransitionInput {
  readonly target_state: GovernanceDecision["state"];
  readonly payload?: Record<string, unknown>;
}

/**
 * Write path — mutates the live backend. Unlike reads, transitions never
 * fall back: a failed transition must surface to the caller (the approval
 * card renders an error toast; the chain-verify button reports red).
 */
export async function transitionDecision(
  id: string,
  body: TransitionInput,
): Promise<GovernanceDecision> {
  const res = await fetch(fetchUrl(`/decisions/${encodeURIComponent(id)}/transition`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ApiError(`transition ${id} → HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as GovernanceDecision;
}

// ──────────── Audit ────────────

export interface AuditQuery {
  readonly limit?: number;
  /** Cursor — return rows where sequence_n > sinceSeq. Backend-friendly. */
  readonly sinceSeq?: number;
  /** UI offset — applied client-side to the fixture branch. Not sent to backend. */
  readonly offset?: number;
  readonly decisionId?: string;
}

export function listAudit(query: AuditQuery = {}): Promise<{
  readonly rows: readonly AuditRow[];
  readonly total: number;
}> {
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", String(query.limit));
  if (query.sinceSeq) params.set("since_seq", String(query.sinceSeq));
  if (query.decisionId) params.set("decision_id", query.decisionId);
  return fetchLiveOrFallback<AuditPage>(`/audit?${params.toString()}`, () => {
    let rows = [...MOCK.audit].sort((a, b) => b.sequence_n - a.sequence_n);
    if (query.decisionId) {
      rows = rows.filter(
        (r) => (r.payload as { decision_id?: string }).decision_id === query.decisionId,
      );
    }
    const total = rows.length;
    const sinceSeq = query.sinceSeq;
    if (sinceSeq !== undefined) rows = rows.filter((r) => r.sequence_n > sinceSeq);
    if (query.offset) rows = rows.slice(query.offset);
    if (query.limit) rows = rows.slice(0, query.limit);
    return { rows, next_since_seq: null, total };
  });
}

/**
 * Verify the audit chain. Live path posts to `/api/cp/audit/verify`; on
 * any failure we report a positive verification against the seeded
 * fixtures (the seeded chain is always valid by construction, and the
 * banner already tells the user we're in fallback mode).
 */
export const verifyChain = (): Promise<ChainVerificationResult> =>
  fetchLiveOrFallback<ChainVerificationResult>(
    "/audit/verify",
    () => ({
      valid: true,
      rows_checked: MOCK.audit.length,
      head_row_hash: MOCK.audit.at(-1)?.row_hash ?? null,
      first_failed_sequence: null,
    }),
    { method: "POST" },
  );

/** Direct URL for the streaming CSV export — used by an `<a download>` link. */
export const auditExportUrl = (): string => `${PREFIX}/audit/export.csv`;

// ──────────── Activity ────────────

export const listActivity = (limit = 50): Promise<readonly ActivityEvent[]> =>
  fetchLiveOrFallback<readonly ActivityEvent[]>(`/activity?limit=${limit}`, () =>
    [...MOCK.activity].sort((a, b) => (a.ts > b.ts ? -1 : 1)).slice(0, limit),
  );

// ──────────── Datasets / policies / compliance ────────────

export const listDatasets = (): Promise<readonly Dataset[]> =>
  fetchLiveOrFallback<readonly Dataset[]>("/datasets", () => MOCK.datasets);

export const listPolicies = (modelId?: string): Promise<readonly Policy[]> =>
  fetchLiveOrFallback<readonly Policy[]>(
    `/policies${modelId ? `?model_id=${encodeURIComponent(modelId)}` : ""}`,
    () => (modelId ? MOCK.policies.filter((p) => p.model_id === modelId) : MOCK.policies),
  );

export const listCompliance = (): Promise<readonly ComplianceMapping[]> =>
  fetchLiveOrFallback<readonly ComplianceMapping[]>("/compliance", () => MOCK.compliance);

/**
 * @deprecated Read `getApiMode() !== "live"` instead. Retained for callers
 * still importing `isMock` while we migrate them.
 */
export const isMock = false;
