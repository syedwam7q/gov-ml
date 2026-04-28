"use client";

import useSWR, { type SWRResponse } from "swr";

import * as api from "./api";
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

/**
 * SWR hooks — every client component reads through these so caching,
 * revalidation, and pollIntervals are uniform.
 *
 * Spec §10.2 (live SSE feed; the activity hook polls every 8s during
 * Phase 4 until the SSE endpoint lands in Phase 5).
 */

const DEFAULT = {
  revalidateOnFocus: false,
  dedupingInterval: 4000,
} as const;

const FAST_POLL = { ...DEFAULT, refreshInterval: 8000 } as const;

export function useFleetKPIs(window = "24h"): SWRResponse<readonly ModelKPI[]> {
  return useSWR(["fleet-kpi", window], () => api.listFleetKPIs(window), DEFAULT);
}

export function useModels(): SWRResponse<readonly AegisModel[]> {
  return useSWR("models", () => api.listModels(), DEFAULT);
}

export function useModel(modelId: string | undefined): SWRResponse<AegisModel | undefined> {
  return useSWR(
    modelId ? (["model", modelId] as const) : null,
    ([, id]) => api.getModel(id),
    DEFAULT,
  );
}

export function useModelKPI(
  modelId: string | undefined,
  window = "24h",
): SWRResponse<ModelKPI | undefined> {
  return useSWR(
    modelId ? (["model-kpi", modelId, window] as const) : null,
    ([, id, w]) => api.getModelKPI(id, w),
    DEFAULT,
  );
}

export function useModelVersions(
  modelId: string | undefined,
): SWRResponse<readonly ModelVersion[]> {
  return useSWR(
    modelId ? (["model-versions", modelId] as const) : null,
    ([, id]) => api.listModelVersions(id),
    DEFAULT,
  );
}

export function useDecisions(
  query: api.DecisionsQuery = {},
): SWRResponse<readonly GovernanceDecision[]> {
  const key = ["decisions", query.modelId ?? "", query.state ?? "", query.limit ?? 0];
  return useSWR(key, () => api.listDecisions(query), DEFAULT);
}

export function useDecision(
  decisionId: string | undefined,
): SWRResponse<GovernanceDecision | undefined> {
  return useSWR(
    decisionId ? (["decision", decisionId] as const) : null,
    ([, id]) => api.getDecision(id),
    DEFAULT,
  );
}

export function useAudit(
  query: api.AuditQuery = {},
): SWRResponse<{ readonly rows: readonly AuditRow[]; readonly total: number }> {
  const key = ["audit", query.limit ?? 0, query.offset ?? 0, query.decisionId ?? ""];
  return useSWR(key, () => api.listAudit(query), DEFAULT);
}

export function useActivity(limit = 20): SWRResponse<readonly ActivityEvent[]> {
  return useSWR(["activity", limit], () => api.listActivity(limit), FAST_POLL);
}

export function useDatasets(): SWRResponse<readonly Dataset[]> {
  return useSWR("datasets", () => api.listDatasets(), DEFAULT);
}

export function usePolicies(modelId?: string): SWRResponse<readonly Policy[]> {
  return useSWR(["policies", modelId ?? ""], () => api.listPolicies(modelId), DEFAULT);
}

export function useCompliance(): SWRResponse<readonly ComplianceMapping[]> {
  return useSWR("compliance", () => api.listCompliance(), DEFAULT);
}
