/* eslint-disable */
// AUTO-GENERATED FILE — do not edit.
// Source of truth: packages/shared-py/src/aegis_shared/schemas.py
// Regenerate with: pnpm --filter @aegis/shared-ts generate

export type SequenceN = number;
export type Ts = string;
export type Actor = string;
export type Action = string;
export type PrevHash = string;
export type RowHash = string;
export type Signature = string;

/**
 * One row in the immutable, Merkle-chained audit log.
 */
export interface AuditRow {
  sequence_n: SequenceN;
  ts: Ts;
  actor: Actor;
  action: Action;
  payload: Payload;
  prev_hash: PrevHash;
  row_hash: RowHash;
  signature: Signature;
}
export interface Payload {
  [k: string]: unknown;
}

export type Ts = string;
export type Accuracy = number;
export type Fairness = number;

/**
 * One sample in a sparkline series.
 */
export interface KPIPoint {
  ts: Ts;
  accuracy: Accuracy;
  fairness: Fairness;
}

export type Node = string;
export type Contribution = number;

/**
 * One node in the causal-DAG attribution result.
 */
export interface CausalRootCause {
  node: Node;
  contribution: Contribution;
}

export type Id = string;
export type Name = string;
/**
 * ML model family — drives which detection service handles the model.
 */
export type ModelFamily = "tabular" | "text";
/**
 * Per-model and per-action risk classification.
 */
export type RiskClass = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ActiveVersion = string;
export type OwnerId = string;
export type CausalDag = {
  [k: string]: unknown;
} | null;
export type ModelCardUrl = string;
export type DatasheetUrl = string | null;
export type CreatedAt = string;

/**
 * A registered ML model under Aegis governance.
 */
export interface Model {
  id: Id;
  name: Name;
  family: ModelFamily;
  risk_class: RiskClass;
  active_version: ActiveVersion;
  owner_id: OwnerId;
  causal_dag?: CausalDag;
  model_card_url: ModelCardUrl;
  datasheet_url?: DatasheetUrl;
  created_at: CreatedAt;
}

export type Id = string;
export type ModelId = string;
export type Version = string;
export type ArtifactUrl = string;
export type TrainingDataSnapshotUrl = string;
export type Status = string;
export type CreatedAt = string;

/**
 * One registered version of a model.
 */
export interface ModelVersion {
  id: Id;
  model_id: ModelId;
  version: Version;
  artifact_url: ArtifactUrl;
  training_data_snapshot_url: TrainingDataSnapshotUrl;
  qc_metrics: QcMetrics;
  status: Status;
  created_at: CreatedAt;
}
export interface QcMetrics {
  [k: string]: number;
}

export type ModelId = string;
export type Metric = string;
export type Value = number;
export type Baseline = number;
/**
 * Severity of a detected signal or decision. Ordered LOW < MEDIUM < HIGH < CRITICAL.
 */
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ObservedAt = string;
export type Subgroup = {
  [k: string]: string;
} | null;

/**
 * One emitted detection signal — the trigger for opening a GovernanceDecision.
 */
export interface DriftSignal {
  model_id: ModelId;
  metric: Metric;
  value: Value;
  baseline: Baseline;
  severity: Severity;
  observed_at: ObservedAt;
  subgroup?: Subgroup;
}

export type Id = string;
export type ModelId = string;
export type Version = number;
export type Active = boolean;
export type Mode = string;
export type DslYaml = string;
export type CreatedAt = string;
export type CreatedBy = string;

/**
 * A versioned governance policy expressed in YAML DSL.
 */
export interface Policy {
  id: Id;
  model_id: ModelId;
  version: Version;
  active: Active;
  mode: Mode;
  dsl_yaml: DslYaml;
  parsed_ast: ParsedAst;
  created_at: CreatedAt;
  created_by: CreatedBy;
}
export interface ParsedAst {
  [k: string]: unknown;
}

export type Id = string;
export type DecisionId = string;
export type RequiredRole = string;
export type RequestedAt = string;
export type DecidedAt = string | null;
export type DecidedBy = string | null;
export type Decision = string | null;
export type Justification = string | null;

/**
 * An approval request gating a high-risk action.
 */
export interface Approval {
  id: Id;
  decision_id: DecisionId;
  required_role: RequiredRole;
  requested_at: RequestedAt;
  decided_at?: DecidedAt;
  decided_by?: DecidedBy;
  decision?: Decision;
  justification?: Justification;
}

export type Key = string;
export type Label = string;
export type Kind = string;
/**
 * Per-model and per-action risk classification.
 */
export type RiskClass = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Rationale = string;
export type Selected = boolean;
export type ExpectedReward = {
  [k: string]: number;
} | null;

/**
 * One option in the Pareto front returned by `services/action-selector`.
 *
 * `expected_reward` is the four-objective vector (acc, fairness, latency, cost)
 * the bandit currently estimates for this action — its CB-Knapsacks posterior.
 * `selected=True` marks the chosen action. Spec §12.2.
 */
export interface CandidateAction {
  key: Key;
  label: Label;
  kind: Kind;
  risk_class: RiskClass;
  rationale: Rationale;
  selected?: Selected;
  expected_reward?: ExpectedReward;
}

export type Method = string;
export type Node = string;
export type Contribution = number;
export type RootCauses = CausalRootCause[];
export type Confidence = number | null;

/**
 * The output of `services/causal-attrib` — DoWhy GCM or DBShap fallback.
 *
 * Spec §12.1. Method names mirror the attribution backend used so the
 * dashboard's Shapley waterfall can label its source provenance.
 */
export interface CausalAttribution {
  method: Method;
  root_causes: RootCauses;
  confidence?: Confidence;
}
/**
 * One node in the causal-DAG attribution result.
 */
export interface CausalRootCause {
  node: Node;
  contribution: Contribution;
}

export type ModelId = string;
export type Window = string;
export type Accuracy = number;
export type Fairness = number;
export type P95LatencyMs = number;
export type PredictionVolume = number;
export type Ts = string;
export type Accuracy1 = number;
export type Fairness1 = number;
export type Sparkline = KPIPoint[];

/**
 * Hot-window KPI rollup per model — accuracy, fairness, p95 latency, volume.
 */
export interface ModelKPI {
  model_id: ModelId;
  window: Window;
  accuracy: Accuracy;
  fairness: Fairness;
  p95_latency_ms: P95LatencyMs;
  prediction_volume: PredictionVolume;
  sparkline: Sparkline;
}
/**
 * One sample in a sparkline series.
 */
export interface KPIPoint {
  ts: Ts;
  accuracy: Accuracy1;
  fairness: Fairness1;
}

export type Id = string;
export type Ts = string;
export type Type = string;
/**
 * Severity of a detected signal or decision. Ordered LOW < MEDIUM < HIGH < CRITICAL.
 */
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Actor = string;
export type Title = string;
export type Summary = string;
export type DecisionId = string | null;
export type ModelId = string | null;

/**
 * One row in the activity feed (also the SSE broadcast payload).
 *
 * `type` distinguishes the four broadcast variants the dashboard renders
 * differently — see `apps/dashboard/app/(app)/_components/activity-feed.tsx`.
 */
export interface ActivityEvent {
  id: Id;
  ts: Ts;
  type: Type;
  severity: Severity;
  actor: Actor;
  title: Title;
  summary: Summary;
  decision_id?: DecisionId;
  model_id?: ModelId;
}

export type SequenceN = number;
export type Ts = string;
export type Actor = string;
export type Action = string;
export type PrevHash = string;
export type RowHash = string;
export type Signature = string;
export type Rows = AuditRow[];
export type NextSinceSeq = number | null;
export type Total = number;

/**
 * One page of audit-log rows + pagination cursor.
 */
export interface AuditPage {
  rows: Rows;
  next_since_seq?: NextSinceSeq;
  total: Total;
}
/**
 * One row in the immutable, Merkle-chained audit log.
 */
export interface AuditRow {
  sequence_n: SequenceN;
  ts: Ts;
  actor: Actor;
  action: Action;
  payload: Payload;
  prev_hash: PrevHash;
  row_hash: RowHash;
  signature: Signature;
}
export interface Payload {
  [k: string]: unknown;
}

export type Valid = boolean;
export type RowsChecked = number;
export type HeadRowHash = string | null;
export type FirstFailedSequence = number | null;

/**
 * Outcome of `POST /api/cp/audit/verify`.
 *
 * `valid` is the end-to-end answer; `first_failed_sequence` is set when the
 * chain breaks so the dashboard can deep-link to the failed row.
 */
export interface ChainVerificationResult {
  valid: Valid;
  rows_checked: RowsChecked;
  head_row_hash?: HeadRowHash;
  first_failed_sequence?: FirstFailedSequence;
}

export type Id = string;
export type Name = string;
/**
 * ML model family — drives which detection service handles the model.
 */
export type ModelFamily = "tabular" | "text";
export type Rows = number;
export type FeatureCount = number;
export type SnapshotUrl = string;
export type DatasheetUrl = string;
export type License = string;
export type Citation = string;
export type LastDriftPsi = number | null;
export type AttachedModels = string[];

/**
 * Datasheet-card surface for `/datasets` (Gebru 2021 schema).
 */
export interface Dataset {
  id: Id;
  name: Name;
  family: ModelFamily;
  rows: Rows;
  feature_count: FeatureCount;
  snapshot_url: SnapshotUrl;
  datasheet_url: DatasheetUrl;
  license: License;
  citation: Citation;
  last_drift_psi?: LastDriftPsi;
  attached_models?: AttachedModels;
}

export type Framework = string;
export type Article = string;
export type Requirement = string;
export type PanelRoute = string;
export type PanelEvidence = string;

/**
 * One regulatory anchor mapped to a dashboard panel.
 *
 * Sourced verbatim from spec Appendix B. The `panel_route` is a Next.js
 * route literal so the compliance page can `<Link href={...}>` to it.
 */
export interface ComplianceMapping {
  framework: Framework;
  article: Article;
  requirement: Requirement;
  panel_route: PanelRoute;
  panel_evidence: PanelEvidence;
}

export type Id = string;
export type ModelId = string;
export type PolicyId = string;
/**
 * The five durable states of a GovernanceDecision (plus awaiting_approval).
 */
export type DecisionState =
  | "detected"
  | "analyzed"
  | "planned"
  | "awaiting_approval"
  | "executing"
  | "evaluated";
/**
 * Severity of a detected signal or decision. Ordered LOW < MEDIUM < HIGH < CRITICAL.
 */
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CausalAttribution = {
  [k: string]: unknown;
} | null;
export type PlanEvidence = {
  [k: string]: unknown;
} | null;
export type ActionResult = {
  [k: string]: unknown;
} | null;
export type RewardVector = {
  [k: string]: number;
} | null;
export type ObservationWindowSecs = number;
export type OpenedAt = string;
export type EvaluatedAt = string | null;

/**
 * A governance event walking the MAPE-K lifecycle.
 *
 * Mutating fields advance through state transitions. Each state transition
 * is mirrored by a Merkle-chained row in `audit_log`.
 */
export interface GovernanceDecision {
  id: Id;
  model_id: ModelId;
  policy_id: PolicyId;
  state: DecisionState;
  severity: Severity;
  drift_signal: DriftSignal;
  causal_attribution?: CausalAttribution;
  plan_evidence?: PlanEvidence;
  action_result?: ActionResult;
  reward_vector?: RewardVector;
  observation_window_secs: ObservationWindowSecs;
  opened_at: OpenedAt;
  evaluated_at?: EvaluatedAt;
}
export interface DriftSignal {
  [k: string]: unknown;
}

export type DecisionState =
  | "detected"
  | "analyzed"
  | "planned"
  | "awaiting_approval"
  | "executing"
  | "evaluated";

export type ModelFamily = "tabular" | "text";

export type RiskClass = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Role = "viewer" | "operator" | "admin";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

