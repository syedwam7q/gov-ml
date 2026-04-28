import type {
  ActivityEvent,
  AegisModel,
  AuditRow,
  ComplianceMapping,
  Dataset,
  GovernanceDecision,
  ModelKPI,
  ModelVersion,
  Policy,
} from "./types";
import { MOCK } from "./mock-data";

/**
 * Aegis dashboard API client.
 *
 * Exposes a single typed surface that the dashboard reads from. When the
 * control-plane URL env is configured, calls fetch over HTTPS; otherwise
 * the client returns deterministic mock data so the demo is always
 * available to graders / reviewers without a backend.
 *
 * Spec §4.2 (deployment topology) + §4.3 (per-service contracts).
 *
 * The mock branch never throws — it's intended to fully back the
 * dashboard during Phase 4. The real branch is added incrementally as
 * each control-plane endpoint lands.
 */

const CONTROL_PLANE = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL?.replace(/\/$/, "");

const useMock = !CONTROL_PLANE || CONTROL_PLANE === "" || CONTROL_PLANE === "mock";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (useMock) {
    throw new Error(`API client called with mock fallback active for path: ${path}`);
  }
  const res = await fetch(`${CONTROL_PLANE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Aegis API ${path} → HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ──────────── Models ────────────

export async function listModels(): Promise<readonly AegisModel[]> {
  if (useMock) return MOCK.models;
  return fetchJson<readonly AegisModel[]>("/api/cp/models");
}

export async function getModel(modelId: string): Promise<AegisModel | undefined> {
  if (useMock) return MOCK.models.find((m) => m.id === modelId);
  return fetchJson<AegisModel>(`/api/cp/models/${modelId}`);
}

export async function listModelVersions(modelId: string): Promise<readonly ModelVersion[]> {
  if (useMock) return MOCK.versions.filter((v) => v.model_id === modelId);
  return fetchJson<readonly ModelVersion[]>(`/api/cp/models/${modelId}/versions`);
}

export async function getModelKPI(modelId: string, window = "24h"): Promise<ModelKPI | undefined> {
  if (useMock) return MOCK.kpis.find((k) => k.model_id === modelId);
  return fetchJson<ModelKPI>(`/api/cp/models/${modelId}/kpi?window=${window}`);
}

export async function listFleetKPIs(window = "24h"): Promise<readonly ModelKPI[]> {
  if (useMock) return MOCK.kpis;
  return fetchJson<readonly ModelKPI[]>(`/api/cp/fleet/kpi?window=${window}`);
}

// ──────────── Decisions ────────────

export interface DecisionsQuery {
  readonly modelId?: string;
  readonly state?: string;
  readonly minSeverity?: string;
  readonly limit?: number;
}

export async function listDecisions(
  query: DecisionsQuery = {},
): Promise<readonly GovernanceDecision[]> {
  if (useMock) {
    let rows = [...MOCK.decisions];
    if (query.modelId) rows = rows.filter((d) => d.model_id === query.modelId);
    if (query.state) rows = rows.filter((d) => d.state === query.state);
    if (query.limit) rows = rows.slice(0, query.limit);
    return rows;
  }
  const params = new URLSearchParams();
  if (query.modelId) params.set("model_id", query.modelId);
  if (query.state) params.set("state", query.state);
  if (query.limit) params.set("limit", String(query.limit));
  return fetchJson<readonly GovernanceDecision[]>(`/api/cp/decisions?${params.toString()}`);
}

export async function getDecision(decisionId: string): Promise<GovernanceDecision | undefined> {
  if (useMock) return MOCK.decisions.find((d) => d.id === decisionId);
  return fetchJson<GovernanceDecision>(`/api/cp/decisions/${decisionId}`);
}

// ──────────── Audit ────────────

export interface AuditQuery {
  readonly limit?: number;
  readonly offset?: number;
  readonly decisionId?: string;
}

export async function listAudit(query: AuditQuery = {}): Promise<{
  readonly rows: readonly AuditRow[];
  readonly total: number;
}> {
  if (useMock) {
    let rows = [...MOCK.audit].sort((a, b) => b.sequence_n - a.sequence_n);
    if (query.decisionId) {
      rows = rows.filter((r) => r.payload.decision_id === query.decisionId);
    }
    const total = rows.length;
    if (query.offset) rows = rows.slice(query.offset);
    if (query.limit) rows = rows.slice(0, query.limit);
    return { rows, total };
  }
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  if (query.decisionId) params.set("decision_id", query.decisionId);
  return fetchJson(`/api/cp/audit?${params.toString()}`);
}

export interface ChainVerificationResult {
  readonly verified: boolean;
  readonly first_failed_sequence?: number;
  readonly inspected: number;
}

export async function verifyChain(): Promise<ChainVerificationResult> {
  if (useMock) {
    return {
      verified: true,
      inspected: MOCK.audit.length,
    };
  }
  return fetchJson<ChainVerificationResult>("/api/cp/audit/verify", { method: "POST" });
}

// ──────────── Activity feed ────────────

export async function listActivity(limit = 20): Promise<readonly ActivityEvent[]> {
  if (useMock) {
    return [...MOCK.activity].sort((a, b) => (a.ts > b.ts ? -1 : 1)).slice(0, limit);
  }
  return fetchJson<readonly ActivityEvent[]>(`/api/cp/activity?limit=${limit}`);
}

// ──────────── Datasets / policies / compliance ────────────

export async function listDatasets(): Promise<readonly Dataset[]> {
  if (useMock) return MOCK.datasets;
  return fetchJson<readonly Dataset[]>("/api/cp/datasets");
}

export async function listPolicies(modelId?: string): Promise<readonly Policy[]> {
  if (useMock) {
    return modelId ? MOCK.policies.filter((p) => p.model_id === modelId) : MOCK.policies;
  }
  return fetchJson<readonly Policy[]>(`/api/cp/policies${modelId ? `?model_id=${modelId}` : ""}`);
}

export async function listCompliance(): Promise<readonly ComplianceMapping[]> {
  if (useMock) return MOCK.compliance;
  return fetchJson<readonly ComplianceMapping[]>("/api/cp/compliance");
}

/** Whether the dashboard is running against the mock surface. */
export const isMock = useMock;
