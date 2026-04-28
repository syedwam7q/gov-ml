/**
 * Aegis dashboard — frontend type contracts.
 *
 * Two layers of types live here:
 *
 *   1. **Atomic types from `@aegis/shared-ts`** (enums + the audit row).
 *      These are auto-generated from `packages/shared-py/src/aegis_shared/`
 *      and are the cross-service contract — every service in the platform
 *      agrees on `Severity`, `DecisionState`, `RiskClass`, `Role`,
 *      `ModelFamily`, and `AuditRow`. We re-export them under their
 *      dashboard-friendly aliases.
 *
 *   2. **UI composite types defined here** (`AegisModel`, `ModelKPI`,
 *      `GovernanceDecision`, `ActivityEvent`, `Dataset`, `ComplianceMapping`,
 *      ...). These are the shapes the dashboard renders — richer than the
 *      Pydantic DB models because they bundle DB rows with Tinybird-derived
 *      sparklines, headline KPIs, and UI-only enrichments. The backend's
 *      router handlers compose responses to match these shapes.
 *
 * Spec §4.4.2 ("schema is law") applies to layer 1 — drift there breaks
 * CI. Layer 2 evolves with the UI; the backend keeps up by adapting at
 * the router boundary.
 */

import type {
  AuditRow as SharedAuditRow,
  DecisionState as SharedDecisionState,
  ModelFamily as SharedModelFamily,
  RiskClass as SharedRiskClass,
  Role as SharedRole,
  Severity as SharedSeverity,
} from "@aegis/shared-ts";

// ──────────── Atomic types from @aegis/shared-ts (auto-generated) ────────────

export type Severity = SharedSeverity;
export type DecisionStateName = SharedDecisionState;
export type RiskClass = SharedRiskClass;
export type ModelFamily = SharedModelFamily;
export type Role = SharedRole;

/** AuditRow shape — exact mirror of the Pydantic model. */
export type AuditRow = SharedAuditRow;

/** Severity ordering used by sort helpers. */
export const SEVERITY_RANK: Record<Severity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

// ──────────── Models registry ────────────

export interface AegisModel {
  readonly id: string;
  readonly name: string;
  readonly family: ModelFamily;
  readonly risk_class: RiskClass;
  readonly active_version: string;
  readonly owner_id: string;
  readonly model_card_url: string;
  readonly datasheet_url?: string | null;
  readonly created_at: string;
  /** Plain-language one-liner for cards / lists. */
  readonly description: string;
  /** Domain bucket — one of credit, content-moderation, healthcare. */
  readonly domain: "credit" | "content-moderation" | "healthcare";
  /** Real-world incident this model is mapped to in the spec (Appendix A). */
  readonly real_world_incident?: string;
}

export interface ModelVersion {
  readonly id: string;
  readonly model_id: string;
  readonly version: string;
  readonly artifact_url: string;
  readonly status: "staged" | "canary" | "active" | "retired";
  readonly created_at: string;
  readonly qc_metrics: Record<string, number>;
  /** Where the version sits in the rollout funnel (0–100). */
  readonly traffic_share?: number;
}

// ──────────── KPIs (composite — DB row + Tinybird trend + UI rollups) ────────

/** A single time-series point. */
export interface KPIPoint {
  readonly t: string; // ISO timestamp
  readonly v: number;
}

export interface ModelKPI {
  readonly model_id: string;
  readonly window: string; // e.g. "24h", "7d"
  readonly predictions_total: number;
  readonly predictions_trend: readonly KPIPoint[];
  readonly p50_latency_ms: number;
  readonly p95_latency_ms: number;
  readonly latency_trend: readonly KPIPoint[];
  readonly error_rate: number;
  readonly error_trend: readonly KPIPoint[];
  /** Domain-specific headline KPI (DP_gender, F1, AUC, etc). */
  readonly headline_metric: {
    readonly key: string;
    readonly value: number;
    readonly floor: number;
    readonly trend: readonly KPIPoint[];
    readonly status: "ok" | "warning" | "danger";
  };
  /** Aggregate severity rolled up from open incidents. */
  readonly severity: Severity | "OK";
  /** Open incident count over the window. */
  readonly open_incidents: number;
}

// ──────────── Detection signals ────────────

export interface DriftSignal {
  readonly model_id: string;
  readonly metric: string;
  readonly value: number;
  readonly baseline: number;
  readonly severity: Severity;
  readonly observed_at: string;
  readonly subgroup?: Record<string, string>;
}

// ──────────── Causal attribution (research extension) ────────────

export interface CausalRootCause {
  readonly node: string;
  readonly contribution: number; // 0..1, sums to 1 across siblings
  readonly explanation: string;
}

export interface CausalAttribution {
  readonly target_metric: string;
  readonly observed_value: number;
  readonly counterfactual_value: number;
  readonly root_causes: readonly CausalRootCause[];
  readonly dag_url?: string;
  /** Phase 6 — Pareto-policy prior; string action key (e.g. "REWEIGH"). */
  readonly recommended_action?: string;
  /** Phase 6 — "high" (DoWhy success) or "degraded" (DBShap fallback). */
  readonly attribution_quality?: "high" | "degraded";
}

// ──────────── Action plans + Pareto front ────────────

export interface CandidateAction {
  readonly key: string;
  readonly label: string;
  readonly kind: "rollback" | "retrain" | "threshold_adjust" | "shadow" | "kill_switch";
  /** Three reward dims — utility/safety/cost — with policy thresholds applied. */
  readonly reward: {
    readonly utility: number;
    readonly safety: number;
    readonly cost: number;
  };
  /** Whether this action is on the Pareto frontier (non-dominated). */
  readonly pareto: boolean;
  /** Whether this action was selected. Only one is `true`. */
  readonly selected: boolean;
  readonly explanation: string;
}

// ──────────── Action result + reward ────────────

export interface ActionResult {
  readonly executed_action: string;
  readonly executed_at: string;
  readonly succeeded: boolean;
  readonly post_action_metric: number;
  readonly post_action_trend: readonly KPIPoint[];
  readonly notes?: string;
}

// ──────────── Governance Decision (the central artifact) ────────────

export interface GovernanceDecision {
  readonly id: string;
  readonly model_id: string;
  readonly policy_id: string;
  readonly state: DecisionStateName;
  readonly severity: Severity;
  readonly drift_signal: DriftSignal;
  readonly causal_attribution?: CausalAttribution;
  readonly plan?: readonly CandidateAction[];
  readonly action_result?: ActionResult;
  readonly opened_at: string;
  readonly evaluated_at?: string;
  /** Approver gate — populated only when state crossed `awaiting_approval`. */
  readonly approval?: ApprovalRecord;
  /** Short title for list rows; auto-derived from the drift signal in seed data. */
  readonly title: string;
}

// ──────────── Approvals ────────────

export interface ApprovalRecord {
  readonly id: string;
  readonly decision_id: string;
  readonly required_role: "operator" | "admin";
  readonly requested_at: string;
  readonly decided_at?: string;
  readonly decided_by?: string;
  readonly decision?: "approved" | "denied" | "held";
  readonly justification?: string;
}

// ──────────── Audit log paging + chain verification ────────────

export interface AuditPage {
  readonly rows: readonly AuditRow[];
  readonly next_since_seq?: number | null;
  readonly total: number;
}

export interface ChainVerificationResult {
  readonly valid: boolean;
  readonly rows_checked: number;
  readonly head_row_hash?: string | null;
  readonly first_failed_sequence?: number | null;
}

// ──────────── Activity feed ────────────

export type ActivityKind =
  | "signal_detected"
  | "decision_opened"
  | "decision_advanced"
  | "approval_requested"
  | "approval_decided"
  | "action_executed"
  | "decision_evaluated"
  | "policy_changed"
  | "deployment";

export interface ActivityEvent {
  readonly id: string;
  readonly ts: string;
  readonly kind: ActivityKind;
  readonly model_id?: string;
  readonly decision_id?: string;
  readonly severity?: Severity;
  readonly summary: string;
  readonly actor: string;
}

// ──────────── Datasets ────────────

/** Subset of Datasheets-for-Datasets sections (Gebru et al. 2021). */
export interface Datasheet {
  /** Why was the dataset created? */
  readonly motivation: string;
  /** What instances make up the dataset? */
  readonly composition: string;
  /** How was the data acquired? */
  readonly collection: string;
  /** Recommended uses + tasks the dataset should NOT be used for. */
  readonly uses: string;
  /** Listed protected / sensitive attributes captured by the dataset. */
  readonly sensitive_attributes: readonly string[];
  /** Maintenance schedule / known limitations. */
  readonly maintenance: string;
}

export interface DatasetSnapshot {
  readonly id: string;
  readonly created_at: string;
  /** Row count at this snapshot. */
  readonly row_count: number;
  /** PSI of this snapshot relative to the baseline (0 = identical). */
  readonly psi_vs_baseline: number;
  /** Optional notes — e.g. "monthly refresh", "schema change". */
  readonly note?: string;
}

export interface Dataset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly source: string;
  readonly source_url: string;
  readonly created_at: string;
  readonly row_count: number;
  readonly snapshot_id: string;
  readonly model_ids: readonly string[];
  /** Structured datasheet content (Gebru 2021). */
  readonly datasheet?: Datasheet;
  /** Snapshot history across time, newest first. */
  readonly snapshots?: readonly DatasetSnapshot[];
  /** Schema overview — column → semantic type. */
  readonly schema?: readonly {
    readonly column: string;
    readonly type: string;
    readonly hint?: string;
  }[];
}

// ──────────── Policies ────────────

export interface Policy {
  readonly id: string;
  readonly model_id: string;
  readonly version: number;
  readonly active: boolean;
  readonly mode: "live" | "dry_run" | "shadow";
  readonly dsl_yaml: string;
  readonly created_at: string;
  readonly created_by: string;
}

// ──────────── Compliance frameworks (per spec §10.1) ────────────

export interface ComplianceMapping {
  readonly framework: "EU AI Act" | "NIST AI RMF" | "ECOA" | "HIPAA" | "FCRA";
  readonly clauses: readonly {
    readonly clause: string;
    readonly title: string;
    readonly status: "complete" | "partial" | "n/a";
    readonly evidence?: string;
  }[];
}
