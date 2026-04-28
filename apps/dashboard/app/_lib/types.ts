/**
 * Aegis dashboard — frontend type contracts.
 *
 * These mirror the Pydantic schemas in `packages/shared-py/src/aegis_shared/schemas.py`.
 * The auto-generated `@aegis/shared-ts` package only ships `AuditRow` today;
 * once the JSON-Schema export pipeline lands in Phase 5, this file is replaced
 * by re-exports from `@aegis/shared-ts`.
 *
 * Spec §6.1 (Postgres schema) + §10.1 (per-route data needs).
 */

// ──────────── Enums (mirror packages/shared-py/types.py) ────────────

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const SEVERITY_RANK: Record<Severity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export type DecisionStateName =
  | "detected"
  | "analyzed"
  | "planned"
  | "awaiting_approval"
  | "executing"
  | "evaluated";

export type RiskClass = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ModelFamily = "tabular" | "text";

export type Role = "viewer" | "operator" | "admin";

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

// ──────────── KPIs ────────────

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

// ──────────── Audit log ────────────

export interface AuditRow {
  readonly sequence_n: number;
  readonly ts: string;
  readonly actor: string;
  readonly action: string;
  readonly payload: Record<string, unknown>;
  readonly prev_hash: string;
  readonly row_hash: string;
  readonly signature: string;
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
