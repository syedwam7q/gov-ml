import type {
  ActivityEvent,
  AegisModel,
  ApprovalRecord,
  AuditRow,
  CandidateAction,
  CausalAttribution,
  ComplianceMapping,
  Dataset,
  GovernanceDecision,
  KPIPoint,
  ModelKPI,
  ModelVersion,
  Policy,
  Severity,
} from "./types";

/**
 * Aegis dashboard — seeded mock data.
 *
 * The dashboard's API client falls back to this dataset when the control
 * plane is unreachable (or when `NEXT_PUBLIC_CONTROL_PLANE_URL` is unset).
 * It models a realistic 24-hour window with the Apple-Card-2019 hero
 * scenario active so the demo always walks end-to-end.
 *
 * Spec §5.2 (hero scenario) + §6.1 (Postgres schema fields) + Appendix A
 * (real-world incidents per model, with citations).
 *
 * IMPORTANT: timestamps below are derived from `NOW` so the data is
 * always fresh-looking regardless of when the dashboard is viewed —
 * the demo never decays into an obvious replay.
 */

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * HOUR;

const ts = (offsetMinutes: number): string => new Date(NOW - offsetMinutes * 60_000).toISOString();

// ──────────── Sparkline helpers ────────────

interface SparkOpts {
  readonly base: number;
  /** Final delta from base — applied as a smooth curve over the last 30% of points. */
  readonly drop?: number;
  /** Random jitter amplitude (default 0.5% of base). */
  readonly noise?: number;
  /** Number of data points (default 24, hourly). */
  readonly points?: number;
  /** Series direction. "decline" (drop applied), "stable" (oscillating). */
  readonly mode?: "decline" | "stable" | "rise";
}

function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function sparkline(opts: SparkOpts, seed = 42): readonly KPIPoint[] {
  const { base, drop = 0, points = 24, mode = "stable" } = opts;
  const noise = opts.noise ?? base * 0.005;
  const random = rng(seed);
  const out: KPIPoint[] = [];
  for (let i = 0; i < points; i++) {
    const phase = i / (points - 1);
    let v = base;
    if (mode === "decline" && phase > 0.5) {
      // smooth quadratic drop in the last half
      const t = (phase - 0.5) / 0.5;
      v = base + drop * (t * t);
    } else if (mode === "rise") {
      v = base + drop * phase;
    } else {
      // gentle sine for stability illusion
      v = base + Math.sin(phase * Math.PI * 2) * noise * 4;
    }
    v += (random() - 0.5) * 2 * noise;
    out.push({
      t: new Date(NOW - (points - 1 - i) * HOUR).toISOString(),
      v: Number(v.toFixed(4)),
    });
  }
  return out;
}

// ──────────── Models ────────────

const MODELS: readonly AegisModel[] = [
  {
    id: "credit-v1",
    name: "Credit Approval",
    family: "tabular",
    risk_class: "HIGH",
    active_version: "1.4.2",
    owner_id: "team-credit",
    model_card_url: "/datasets/hmda-2022",
    datasheet_url: "/datasets/hmda-2022#datasheet",
    created_at: ts(60 * 24 * 90),
    description:
      "HMDA-trained credit approval model serving production decisions. Monitored for demographic parity and equal opportunity across protected attributes.",
    domain: "credit",
    real_world_incident:
      "Apple Card 2019 — credit limit gender disparity (NY DFS investigation, Heinemeier-Hansson + Wozniak reports).",
  },
  {
    id: "toxicity-v1",
    name: "Comment Toxicity",
    family: "text",
    risk_class: "MEDIUM",
    active_version: "0.9.1",
    owner_id: "team-trust-safety",
    model_card_url: "/datasets/jigsaw",
    datasheet_url: "/datasets/jigsaw#datasheet",
    created_at: ts(60 * 24 * 60),
    description:
      "DistilBERT classifier flagging toxic user-generated content. Audited for cross-identity fairness and language-coverage drift.",
    domain: "content-moderation",
    real_world_incident:
      "Perspective API 2017 — disproportionate false positives on AAVE / mention-based identity terms (Sap et al., ACL 2019).",
  },
  {
    id: "readmission-v1",
    name: "Hospital Readmission",
    family: "tabular",
    risk_class: "CRITICAL",
    active_version: "2.1.0",
    owner_id: "team-clinical-ai",
    model_card_url: "/datasets/diabetes-130us",
    datasheet_url: "/datasets/diabetes-130us#datasheet",
    created_at: ts(60 * 24 * 30),
    description:
      "30-day readmission risk model trained on the Diabetes 130-US Hospitals dataset. Shadow-deployed; calibration is the active monitoring axis.",
    domain: "healthcare",
    real_world_incident:
      "Optum risk-prediction algorithm 2019 — race-correlated under-referral of Black patients (Obermeyer et al., Science 2019).",
  },
];

// ──────────── Versions ────────────

const VERSIONS: readonly ModelVersion[] = [
  {
    id: "ver-credit-1.4.2",
    model_id: "credit-v1",
    version: "1.4.2",
    artifact_url: "s3://aegis-models/credit-v1/1.4.2/model.joblib",
    status: "active",
    created_at: ts(60 * 24 * 7),
    qc_metrics: { auc: 0.872, ks: 0.41, brier: 0.131 },
    traffic_share: 95,
  },
  {
    id: "ver-credit-1.4.1",
    model_id: "credit-v1",
    version: "1.4.1",
    artifact_url: "s3://aegis-models/credit-v1/1.4.1/model.joblib",
    status: "canary",
    created_at: ts(60 * 24 * 14),
    qc_metrics: { auc: 0.869, ks: 0.4, brier: 0.133 },
    traffic_share: 5,
  },
  {
    id: "ver-credit-1.4.0",
    model_id: "credit-v1",
    version: "1.4.0",
    artifact_url: "s3://aegis-models/credit-v1/1.4.0/model.joblib",
    status: "retired",
    created_at: ts(60 * 24 * 28),
    qc_metrics: { auc: 0.864, ks: 0.39, brier: 0.135 },
  },
  {
    id: "ver-toxicity-0.9.1",
    model_id: "toxicity-v1",
    version: "0.9.1",
    artifact_url: "hf://aegis-models/toxicity-v1/0.9.1",
    status: "active",
    created_at: ts(60 * 24 * 5),
    qc_metrics: { f1: 0.81, precision: 0.79, recall: 0.83 },
    traffic_share: 100,
  },
  {
    id: "ver-readmission-2.1.0",
    model_id: "readmission-v1",
    version: "2.1.0",
    artifact_url: "s3://aegis-models/readmission-v1/2.1.0/model.joblib",
    status: "active",
    created_at: ts(60 * 24 * 3),
    qc_metrics: { auc: 0.78, calibration_ece: 0.04 },
    traffic_share: 100,
  },
];

// ──────────── KPI snapshots ────────────

const KPIS: readonly ModelKPI[] = [
  {
    model_id: "credit-v1",
    window: "24h",
    predictions_total: 41_204,
    predictions_trend: sparkline({ base: 1700, mode: "stable", noise: 80 }, 11),
    p50_latency_ms: 38,
    p95_latency_ms: 92,
    latency_trend: sparkline({ base: 38, mode: "stable", noise: 1.5 }, 12),
    error_rate: 0.0021,
    error_trend: sparkline({ base: 0.0021, noise: 0.0001, mode: "stable" }, 13),
    headline_metric: {
      key: "DP_gender",
      value: 0.71,
      floor: 0.8,
      // Smoothly drops from 0.94 → 0.71 over the last 12 hours — the demo signal.
      trend: sparkline({ base: 0.94, drop: -0.23, mode: "decline", noise: 0.005 }, 14),
      status: "danger",
    },
    severity: "HIGH",
    open_incidents: 1,
  },
  {
    model_id: "toxicity-v1",
    window: "24h",
    predictions_total: 128_402,
    predictions_trend: sparkline({ base: 5200, mode: "stable", noise: 200 }, 21),
    p50_latency_ms: 71,
    p95_latency_ms: 134,
    latency_trend: sparkline({ base: 71, mode: "stable", noise: 2 }, 22),
    error_rate: 0.0009,
    error_trend: sparkline({ base: 0.0009, noise: 0.00005, mode: "stable" }, 23),
    headline_metric: {
      key: "F1",
      value: 0.81,
      floor: 0.78,
      trend: sparkline({ base: 0.81, mode: "stable", noise: 0.004 }, 24),
      status: "ok",
    },
    severity: "OK",
    open_incidents: 0,
  },
  {
    model_id: "readmission-v1",
    window: "24h",
    predictions_total: 8_902,
    predictions_trend: sparkline({ base: 350, mode: "stable", noise: 30 }, 31),
    p50_latency_ms: 22,
    p95_latency_ms: 51,
    latency_trend: sparkline({ base: 22, mode: "stable", noise: 1 }, 32),
    error_rate: 0.0012,
    error_trend: sparkline({ base: 0.0012, noise: 0.00005, mode: "stable" }, 33),
    headline_metric: {
      key: "AUC",
      value: 0.78,
      floor: 0.75,
      trend: sparkline({ base: 0.78, mode: "stable", noise: 0.003 }, 34),
      status: "ok",
    },
    severity: "OK",
    open_incidents: 0,
  },
];

// ──────────── Apple-Card scenario — the central decision ────────────

const APPLE_CARD_DRIFT_SIGNAL = {
  model_id: "credit-v1",
  metric: "demographic_parity_ratio",
  value: 0.71,
  baseline: 0.94,
  severity: "HIGH" as Severity,
  observed_at: ts(165),
  subgroup: { protected_attribute: "gender", group: "female" },
};

const APPLE_CARD_CAUSAL: CausalAttribution = {
  target_metric: "demographic_parity_ratio",
  observed_value: 0.71,
  counterfactual_value: 0.93,
  root_causes: [
    {
      node: "dataset_drift.applicant_income_thousands",
      contribution: 0.62,
      explanation:
        "Income-bracket shift in incoming applications skews the female-applicant feature distribution outside the training support. PSI = 0.31 (above 0.20 alarm threshold).",
    },
    {
      node: "feature_interaction.income×credit_history",
      contribution: 0.21,
      explanation:
        "Joint distribution of income and credit history changed for joint-filing applicants — the 2019 Apple-Card pattern: shared finances, divergent allocations.",
    },
    {
      node: "model.threshold_uniformity",
      contribution: 0.12,
      explanation:
        "Single global threshold no longer satisfies equalized odds across the new income distribution.",
    },
    {
      node: "label_drift.approval_base_rate",
      contribution: 0.05,
      explanation:
        "Mild shift in overall approval base rate, dominated by the upstream dataset effect.",
    },
  ],
  dag_url: "/models/credit-v1?tab=causal",
};

const APPLE_CARD_PLAN: readonly CandidateAction[] = [
  {
    key: "rollback-1.4.0",
    label: "Roll back to credit-v1 / 1.4.0",
    kind: "rollback",
    reward: { utility: 0.86, safety: 0.92, cost: 0.05 },
    pareto: true,
    selected: true,
    explanation:
      "Reverts active version while retraining proceeds in the background. Restores DP_gender ≥ 0.92 within 5 minutes. Lowest immediate risk.",
  },
  {
    key: "retrain-with-stratify",
    label: "Retrain with stratified income sampling",
    kind: "retrain",
    reward: { utility: 0.91, safety: 0.95, cost: 0.41 },
    pareto: true,
    selected: false,
    explanation:
      "Highest projected DP_gender recovery (≥ 0.96) but 4-hour training window. Recommended after rollback stabilizes traffic.",
  },
  {
    key: "threshold-adjust",
    label: "Per-group threshold adjust",
    kind: "threshold_adjust",
    reward: { utility: 0.81, safety: 0.79, cost: 0.07 },
    pareto: true,
    selected: false,
    explanation:
      "Restores DP_gender via per-subgroup thresholds. Trades 4-point AUC and creates legal exposure under ECOA disparate-treatment doctrine.",
  },
  {
    key: "kill-switch",
    label: "Hard kill — return manual-review for 100% of female applicants",
    kind: "kill_switch",
    reward: { utility: 0.42, safety: 0.99, cost: 0.18 },
    pareto: false,
    selected: false,
    explanation: "Dominated by rollback on every dimension. Listed for audit completeness only.",
  },
];

const APPLE_CARD_APPROVAL: ApprovalRecord = {
  id: "appr-001",
  decision_id: "dec-001",
  required_role: "operator",
  requested_at: ts(110),
  decided_at: ts(75),
  decided_by: "ana.salah@aegis.dev",
  decision: "approved",
  justification:
    "Pareto-front shows rollback dominates on safety and cost; retrain enqueued in parallel for the long-term fix.",
};

const DECISIONS: readonly GovernanceDecision[] = [
  {
    id: "dec-001",
    model_id: "credit-v1",
    policy_id: "pol-credit-v1-active",
    state: "evaluated",
    severity: "HIGH",
    drift_signal: APPLE_CARD_DRIFT_SIGNAL,
    causal_attribution: APPLE_CARD_CAUSAL,
    plan: APPLE_CARD_PLAN,
    approval: APPLE_CARD_APPROVAL,
    action_result: {
      executed_action: "rollback-1.4.0",
      executed_at: ts(60),
      succeeded: true,
      post_action_metric: 0.92,
      post_action_trend: sparkline(
        { base: 0.71, drop: 0.21, mode: "rise", noise: 0.005, points: 12 },
        51,
      ),
      notes:
        "Rollback applied at 60m ago; DP_gender recovered to 0.92 within 5 minutes. Long-term retrain proceeding.",
    },
    opened_at: ts(165),
    evaluated_at: ts(45),
    title: "Demographic parity breach — credit-v1 (gender)",
  },
  {
    id: "dec-002",
    model_id: "credit-v1",
    policy_id: "pol-credit-v1-active",
    state: "evaluated",
    severity: "MEDIUM",
    drift_signal: {
      model_id: "credit-v1",
      metric: "psi_applicant_age",
      value: 0.18,
      baseline: 0.05,
      severity: "MEDIUM",
      observed_at: ts(60 * 11),
    },
    causal_attribution: {
      target_metric: "psi_applicant_age",
      observed_value: 0.18,
      counterfactual_value: 0.06,
      root_causes: [
        {
          node: "dataset_drift.applicant_age",
          contribution: 0.84,
          explanation:
            "Age distribution skew toward 25–34 bracket — recent product expansion to younger demographics.",
        },
        {
          node: "channel_change.mobile_app",
          contribution: 0.16,
          explanation: "Mobile-channel applicants overrepresented in the new cohort.",
        },
      ],
    },
    plan: [
      {
        key: "rebalance-training",
        label: "Add stratified subsample to training set",
        kind: "retrain",
        reward: { utility: 0.84, safety: 0.88, cost: 0.32 },
        pareto: true,
        selected: true,
        explanation:
          "Brings PSI back below the 0.10 alarm threshold without changing live thresholds.",
      },
    ],
    action_result: {
      executed_action: "rebalance-training",
      executed_at: ts(60 * 9),
      succeeded: true,
      post_action_metric: 0.06,
      post_action_trend: sparkline(
        { base: 0.18, drop: -0.12, mode: "decline", noise: 0.003, points: 8 },
        61,
      ),
    },
    opened_at: ts(60 * 11),
    evaluated_at: ts(60 * 8),
    title: "Age-distribution drift — credit-v1",
  },
  {
    id: "dec-003",
    model_id: "toxicity-v1",
    policy_id: "pol-toxicity-v1-active",
    state: "evaluated",
    severity: "LOW",
    drift_signal: {
      model_id: "toxicity-v1",
      metric: "false_positive_rate_aave",
      value: 0.08,
      baseline: 0.07,
      severity: "LOW",
      observed_at: ts(60 * 22),
      subgroup: { dialect: "AAVE" },
    },
    plan: [
      {
        key: "watch",
        label: "Tag for next monthly review",
        kind: "shadow",
        reward: { utility: 0.99, safety: 0.85, cost: 0.01 },
        pareto: true,
        selected: true,
        explanation: "Within natural variance (3σ). No production action needed.",
      },
    ],
    opened_at: ts(60 * 22),
    evaluated_at: ts(60 * 20),
    title: "AAVE false-positive uptick — toxicity-v1",
  },
];

// ──────────── Audit chain ────────────

const AUDIT: readonly AuditRow[] = [
  {
    sequence_n: 1,
    ts: ts(165),
    actor: "service:detect-tabular",
    action: "signal.detected",
    payload: {
      decision_id: "dec-001",
      metric: "demographic_parity_ratio",
      value: 0.71,
      baseline: 0.94,
      severity: "HIGH",
    },
    prev_hash: "0".repeat(64),
    row_hash: "3f9c4ef9b00fa6abef1c01ab12cd34ef9b00fa6abef1c01ab12cd34ef9b00fa6",
    signature: "sig-mock-001",
  },
  {
    sequence_n: 2,
    ts: ts(160),
    actor: "service:control-plane",
    action: "decision.opened",
    payload: { decision_id: "dec-001", state: "detected", severity: "HIGH" },
    prev_hash: "3f9c4ef9b00fa6abef1c01ab12cd34ef9b00fa6abef1c01ab12cd34ef9b00fa6",
    row_hash: "d04e0a91a376c3eef00bb1100029ee5588d04e0a91a376c3eef00bb1100029ee",
    signature: "sig-mock-002",
  },
  {
    sequence_n: 3,
    ts: ts(140),
    actor: "service:causal-attrib",
    action: "decision.analyzed",
    payload: {
      decision_id: "dec-001",
      root_causes: 4,
      top_contributor: "dataset_drift.applicant_income_thousands",
    },
    prev_hash: "d04e0a91a376c3eef00bb1100029ee5588d04e0a91a376c3eef00bb1100029ee",
    row_hash: "aa01b772c0b1e8c024118a1a2b3c4d5eaa01b772c0b1e8c024118a1a2b3c4d5e",
    signature: "sig-mock-003",
  },
  {
    sequence_n: 4,
    ts: ts(120),
    actor: "service:action-selector",
    action: "decision.planned",
    payload: { decision_id: "dec-001", pareto_front: 3, selected_action: "rollback-1.4.0" },
    prev_hash: "aa01b772c0b1e8c024118a1a2b3c4d5eaa01b772c0b1e8c024118a1a2b3c4d5e",
    row_hash: "5e78f3c0d4b2a1809f23aa11bb22cc335e78f3c0d4b2a1809f23aa11bb22cc33",
    signature: "sig-mock-004",
  },
  {
    sequence_n: 5,
    ts: ts(110),
    actor: "service:control-plane",
    action: "approval.requested",
    payload: { decision_id: "dec-001", required_role: "operator", action: "rollback-1.4.0" },
    prev_hash: "5e78f3c0d4b2a1809f23aa11bb22cc335e78f3c0d4b2a1809f23aa11bb22cc33",
    row_hash: "8b1f2a3c45e6d7891022aabbccddeeff8b1f2a3c45e6d7891022aabbccddeeff",
    signature: "sig-mock-005",
  },
  {
    sequence_n: 6,
    ts: ts(75),
    actor: "user:ana.salah@aegis.dev",
    action: "approval.decided",
    payload: { decision_id: "dec-001", decision: "approved", role: "operator" },
    prev_hash: "8b1f2a3c45e6d7891022aabbccddeeff8b1f2a3c45e6d7891022aabbccddeeff",
    row_hash: "c2d3e4f5a6b71829304050607080a0b0c2d3e4f5a6b71829304050607080a0b0",
    signature: "sig-mock-006",
  },
  {
    sequence_n: 7,
    ts: ts(60),
    actor: "service:executor",
    action: "action.executed",
    payload: {
      decision_id: "dec-001",
      action: "rollback-1.4.0",
      succeeded: true,
      from_version: "1.4.2",
      to_version: "1.4.0",
    },
    prev_hash: "c2d3e4f5a6b71829304050607080a0b0c2d3e4f5a6b71829304050607080a0b0",
    row_hash: "9a8b7c6d5e4f30210ffeedccbbaa99889a8b7c6d5e4f30210ffeedccbbaa9988",
    signature: "sig-mock-007",
  },
  {
    sequence_n: 8,
    ts: ts(45),
    actor: "service:evaluator",
    action: "decision.evaluated",
    payload: {
      decision_id: "dec-001",
      post_action_metric: 0.92,
      reward_vector: { utility: 0.86, safety: 0.92, cost: 0.05 },
    },
    prev_hash: "9a8b7c6d5e4f30210ffeedccbbaa99889a8b7c6d5e4f30210ffeedccbbaa9988",
    row_hash: "1e2d3c4b5a695878736261504030201f1e2d3c4b5a695878736261504030201f",
    signature: "sig-mock-008",
  },
];

// ──────────── Activity feed ────────────

const ACTIVITY: readonly ActivityEvent[] = [
  {
    id: "act-001",
    ts: ts(165),
    kind: "signal_detected",
    model_id: "credit-v1",
    severity: "HIGH",
    summary: "DP_gender breach (0.71) detected · credit-v1",
    actor: "detect-tabular",
  },
  {
    id: "act-002",
    ts: ts(160),
    kind: "decision_opened",
    model_id: "credit-v1",
    decision_id: "dec-001",
    severity: "HIGH",
    summary: "Decision dec-001 opened · MAPE-K → DETECTED",
    actor: "control-plane",
  },
  {
    id: "act-003",
    ts: ts(140),
    kind: "decision_advanced",
    model_id: "credit-v1",
    decision_id: "dec-001",
    summary: "Causal attribution complete · root cause = applicant_income drift (62%)",
    actor: "causal-attrib",
  },
  {
    id: "act-004",
    ts: ts(120),
    kind: "decision_advanced",
    model_id: "credit-v1",
    decision_id: "dec-001",
    summary: "Action plan ready · 3-action Pareto front · selected = rollback-1.4.0",
    actor: "action-selector",
  },
  {
    id: "act-005",
    ts: ts(110),
    kind: "approval_requested",
    model_id: "credit-v1",
    decision_id: "dec-001",
    summary: "Approval requested · role = operator",
    actor: "control-plane",
  },
  {
    id: "act-006",
    ts: ts(75),
    kind: "approval_decided",
    model_id: "credit-v1",
    decision_id: "dec-001",
    summary: "Approved by ana.salah@aegis.dev",
    actor: "user:ana.salah@aegis.dev",
  },
  {
    id: "act-007",
    ts: ts(60),
    kind: "action_executed",
    model_id: "credit-v1",
    decision_id: "dec-001",
    summary: "Rollback 1.4.2 → 1.4.0 succeeded",
    actor: "executor",
  },
  {
    id: "act-008",
    ts: ts(45),
    kind: "decision_evaluated",
    model_id: "credit-v1",
    decision_id: "dec-001",
    severity: "LOW",
    summary: "Post-action DP_gender = 0.92 · decision evaluated",
    actor: "evaluator",
  },
  {
    id: "act-009",
    ts: ts(30),
    kind: "deployment",
    model_id: "toxicity-v1",
    summary: "toxicity-v1 0.9.1 → 100% traffic share (canary promotion)",
    actor: "deployer",
  },
  {
    id: "act-010",
    ts: ts(15),
    kind: "policy_changed",
    model_id: "credit-v1",
    summary: "Policy v3 dry-run · DP_gender floor raised to 0.85",
    actor: "user:james.wu@aegis.dev",
  },
];

// ──────────── Datasets ────────────

const DATASETS: readonly Dataset[] = [
  {
    id: "ds-hmda-2022",
    name: "HMDA 2022",
    description:
      "Home Mortgage Disclosure Act public dataset. Includes applicant income, race, gender, action taken. Federal-publication-grade ground truth.",
    source: "Consumer Financial Protection Bureau",
    source_url: "https://www.consumerfinance.gov/data-research/hmda/",
    created_at: ts(60 * 24 * 90),
    row_count: 12_400_000,
    snapshot_id: "snap-hmda-2022-q4",
    model_ids: ["credit-v1"],
  },
  {
    id: "ds-jigsaw",
    name: "Jigsaw Toxic Comments",
    description:
      "Jigsaw / Conversation AI public dataset of online comments labeled for toxicity, identity-attack, and obscenity.",
    source: "Jigsaw / Conversation AI",
    source_url: "https://www.kaggle.com/c/jigsaw-toxic-comment-classification-challenge",
    created_at: ts(60 * 24 * 60),
    row_count: 159_571,
    snapshot_id: "snap-jigsaw-2024-train",
    model_ids: ["toxicity-v1"],
  },
  {
    id: "ds-diabetes-130us",
    name: "Diabetes 130-US Hospitals",
    description:
      "10-year dataset (1999–2008) of clinical encounters from 130 US hospitals. Used for 30-day readmission risk modeling.",
    source: "UCI Machine Learning Repository",
    source_url: "https://archive.ics.uci.edu/dataset/296/",
    created_at: ts(60 * 24 * 30),
    row_count: 101_766,
    snapshot_id: "snap-diabetes-130us-baseline",
    model_ids: ["readmission-v1"],
  },
];

// ──────────── Policies ────────────

const POLICY_DSL_CREDIT = `# Aegis policy DSL — credit-v1
version: 3
mode: live
triggers:
  - metric: demographic_parity_ratio
    subgroup: gender
    floor: 0.80
    window: 1h
    severity: HIGH
  - metric: psi
    feature: applicant_income_thousands
    ceiling: 0.20
    window: 24h
    severity: MEDIUM
actions:
  on_HIGH:
    - require_approval: operator
    - propose: [rollback, retrain_stratified, threshold_adjust]
  on_MEDIUM:
    - propose: [retrain_stratified]
  on_LOW:
    - propose: [shadow_review]
`;

const POLICIES: readonly Policy[] = [
  {
    id: "pol-credit-v1-active",
    model_id: "credit-v1",
    version: 3,
    active: true,
    mode: "live",
    dsl_yaml: POLICY_DSL_CREDIT,
    created_at: ts(60 * 24 * 14),
    created_by: "james.wu@aegis.dev",
  },
  {
    id: "pol-toxicity-v1-active",
    model_id: "toxicity-v1",
    version: 2,
    active: true,
    mode: "live",
    dsl_yaml: `# Aegis policy DSL — toxicity-v1
version: 2
mode: live
triggers:
  - metric: f1
    floor: 0.78
    severity: HIGH
  - metric: false_positive_rate
    subgroup: dialect
    ceiling: 0.10
    severity: MEDIUM
actions:
  on_HIGH:
    - require_approval: admin
  on_MEDIUM:
    - propose: [retrain_stratified, threshold_adjust]
`,
    created_at: ts(60 * 24 * 9),
    created_by: "team-trust-safety",
  },
];

// ──────────── Compliance mappings ────────────

const COMPLIANCE: readonly ComplianceMapping[] = [
  {
    framework: "EU AI Act",
    clauses: [
      {
        clause: "Article 9",
        title: "Risk management system",
        status: "complete",
        evidence: "MAPE-K audit chain + DAG of detected risks per model",
      },
      {
        clause: "Article 10",
        title: "Data and data governance",
        status: "complete",
        evidence: "Datasets page surfaces datasheets per Gebru (2021)",
      },
      {
        clause: "Article 14",
        title: "Human oversight",
        status: "complete",
        evidence: "Approvals queue + emergency-stop banner",
      },
      {
        clause: "Article 15",
        title: "Accuracy, robustness, cybersecurity",
        status: "partial",
        evidence: "Drift + fairness monitors live; chaos suite Phase 7",
      },
    ],
  },
  {
    framework: "NIST AI RMF",
    clauses: [
      { clause: "GOVERN-1.1", title: "Roles and responsibilities", status: "complete" },
      { clause: "MAP-3.4", title: "System context", status: "complete" },
      { clause: "MEASURE-2.6", title: "Continuous monitoring", status: "complete" },
      { clause: "MANAGE-4.1", title: "Risk treatment", status: "partial" },
    ],
  },
  {
    framework: "ECOA",
    clauses: [
      {
        clause: "Reg-B § 1002.4",
        title: "General rules",
        status: "complete",
        evidence: "Per-decision lineage prevents disparate-impact decisions reaching production",
      },
      { clause: "Reg-B § 1002.6", title: "Rules concerning evaluation", status: "complete" },
    ],
  },
  {
    framework: "FCRA",
    clauses: [
      { clause: "§ 615", title: "Adverse-action notice", status: "partial" },
      { clause: "§ 609", title: "Disclosures", status: "complete" },
    ],
  },
  {
    framework: "HIPAA",
    clauses: [
      { clause: "Privacy Rule § 164.502", title: "Permitted uses & disclosures", status: "n/a" },
      { clause: "Security Rule § 164.308", title: "Administrative safeguards", status: "complete" },
    ],
  },
];

// ──────────── Public surface ────────────

export const MOCK = {
  now: () => new Date(NOW).toISOString(),
  models: MODELS,
  versions: VERSIONS,
  kpis: KPIS,
  decisions: DECISIONS,
  audit: AUDIT,
  activity: ACTIVITY,
  datasets: DATASETS,
  policies: POLICIES,
  compliance: COMPLIANCE,
} as const;

export type MockSurface = typeof MOCK;

/** Sliding window helpers — used by /audit pagination + /incidents filters. */
export function withinWindow(iso: string, windowMs: number): boolean {
  const t = new Date(iso).getTime();
  return NOW - t <= windowMs;
}

export const ONE_DAY_MS = ONE_DAY;
