"""Pydantic schemas for Aegis events, decisions, signals, and audit records.

This module is the single source of truth for the cross-service contract.
`packages/shared-ts` is generated from the JSON Schema produced here, so
adding or changing a field requires one edit here and one regenerate of
shared-ts (CI fails if shared-ts is out of date).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from aegis_shared.audit import AuditRow as _AuditRow
from aegis_shared.types import (
    AttributionQuality,
    DecisionState,
    ModelFamily,
    RiskClass,
    Severity,
)

# Re-export so codegen + downstream services can `from aegis_shared.schemas import AuditRow`.
AuditRow = _AuditRow


class AegisModel(BaseModel):
    """Base for all Aegis Pydantic models. Forbids extra fields and freezes instances."""

    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)


# -- Models registry ---------------------------------------------------------


class Model(AegisModel):
    """A registered ML model under Aegis governance."""

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    family: ModelFamily
    risk_class: RiskClass
    active_version: str = Field(min_length=1)
    owner_id: str = Field(min_length=1)
    causal_dag: dict[str, Any] | None = None
    model_card_url: str = Field(min_length=1)
    datasheet_url: str | None = None
    created_at: datetime


class ModelVersion(AegisModel):
    """One registered version of a model."""

    id: str  # uuid
    model_id: str
    version: str = Field(min_length=1)
    artifact_url: str = Field(min_length=1)
    training_data_snapshot_url: str = Field(min_length=1)
    qc_metrics: dict[str, float]
    status: str = Field(pattern=r"^(staged|canary|active|retired)$")
    created_at: datetime


# -- Detection signals -------------------------------------------------------


class DriftSignal(AegisModel):
    """One emitted detection signal — the trigger for opening a GovernanceDecision."""

    model_id: str
    metric: str = Field(min_length=1)
    value: float
    baseline: float
    severity: Severity
    observed_at: datetime
    subgroup: dict[str, str] | None = None


# -- The central artifact ----------------------------------------------------


class GovernanceDecision(AegisModel):
    """A governance event walking the MAPE-K lifecycle.

    Mutating fields advance through state transitions. Each state transition
    is mirrored by a Merkle-chained row in `audit_log`.
    """

    id: str  # uuid
    model_id: str
    policy_id: str  # uuid
    state: DecisionState
    severity: Severity
    drift_signal: dict[str, Any]
    causal_attribution: dict[str, Any] | None = None
    plan_evidence: dict[str, Any] | None = None
    action_result: dict[str, Any] | None = None
    reward_vector: dict[str, float] | None = None
    observation_window_secs: int = Field(ge=1)
    opened_at: datetime
    evaluated_at: datetime | None = None

    @field_validator("observation_window_secs")
    @classmethod
    def _validate_window(cls, v: int) -> int:
        if v < 1:
            msg = "observation_window_secs must be >= 1"
            raise ValueError(msg)
        return v


# -- Policies ----------------------------------------------------------------


class Policy(AegisModel):
    """A versioned governance policy expressed in YAML DSL."""

    id: str  # uuid
    model_id: str
    version: int = Field(ge=1)
    active: bool
    mode: str = Field(pattern=r"^(live|dry_run|shadow)$")
    dsl_yaml: str = Field(min_length=1)
    parsed_ast: dict[str, Any]
    created_at: datetime
    created_by: str


# -- Approvals ---------------------------------------------------------------


class Approval(AegisModel):
    """An approval request gating a high-risk action."""

    id: str  # uuid
    decision_id: str
    required_role: str = Field(pattern=r"^(operator|admin)$")
    requested_at: datetime
    decided_at: datetime | None = None
    decided_by: str | None = None
    decision: str | None = Field(default=None, pattern=r"^(approved|denied|held)$")
    justification: str | None = None


# -- Plan / Pareto front -----------------------------------------------------


class CandidateAction(AegisModel):
    """One option in the Pareto front returned by `services/action-selector`.

    `expected_reward` is the four-objective vector (acc, fairness, latency, cost)
    the bandit currently estimates for this action — its CB-Knapsacks posterior.
    `selected=True` marks the chosen action. Spec §12.2.
    """

    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    kind: str = Field(pattern=r"^(reweigh|recalibrate|retrain|swap|hold|rollback)$")
    risk_class: RiskClass
    rationale: str
    selected: bool = False
    expected_reward: dict[str, float] | None = None


# -- Causal root-cause attribution ------------------------------------------


class CausalRootCause(AegisModel):
    """One node in the causal-DAG attribution result."""

    node: str = Field(min_length=1)
    contribution: float = Field(ge=0.0, le=1.0)


class CausalAttribution(AegisModel):
    """The output of `services/causal-attrib` — DoWhy GCM or DBShap fallback.

    Spec §12.1. Method names mirror the attribution backend used so the
    dashboard's Shapley waterfall can label its source provenance.

    `recommended_action` is the primary value of the cause→action mapping
    (Phase 6 §12.1 paper artifact). It's a string action key that Phase 7's
    action-selector treats as a prior; the dashboard renders it as a chip
    on the `/incidents/<id>` decision page.

    `attribution_quality` is `HIGH` for DoWhy GCM successes and
    `DEGRADED` when the DBShap fallback fired (no DAG, timeout, or
    DoWhy runtime error).
    """

    method: str = Field(min_length=1)  # 'DoWhy GCM' | 'DBShap'
    root_causes: list[CausalRootCause]
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    recommended_action: str | None = None
    attribution_quality: AttributionQuality = AttributionQuality.HIGH


# -- KPI surface (Tinybird-backed) ------------------------------------------


class KPIPoint(AegisModel):
    """One sample in a sparkline series."""

    ts: datetime
    accuracy: float
    fairness: float


class ModelKPI(AegisModel):
    """Hot-window KPI rollup per model — accuracy, fairness, p95 latency, volume."""

    model_id: str = Field(min_length=1)
    window: str = Field(pattern=r"^(24h|7d|30d)$")
    accuracy: float
    fairness: float
    p95_latency_ms: float
    prediction_volume: int = Field(ge=0)
    sparkline: list[KPIPoint]


# -- Activity feed -----------------------------------------------------------


class ActivityEvent(AegisModel):
    """One row in the activity feed (also the SSE broadcast payload).

    `type` distinguishes the four broadcast variants the dashboard renders
    differently — see `apps/dashboard/app/(app)/_components/activity-feed.tsx`.
    """

    id: str = Field(min_length=1)
    ts: datetime
    type: str = Field(
        pattern=r"^(decision_open|state_transition|approval_decided|metrics_degraded)$"
    )
    severity: Severity
    actor: str = Field(min_length=1)
    title: str = Field(min_length=1)
    summary: str
    decision_id: str | None = None
    model_id: str | None = None


# -- Audit page + chain verification ----------------------------------------


class AuditPage(AegisModel):
    """One page of audit-log rows + pagination cursor."""

    rows: list[AuditRow]
    next_since_seq: int | None = None
    total: int = Field(ge=0)


class ChainVerificationResult(AegisModel):
    """Outcome of `POST /api/cp/audit/verify`.

    `valid` is the end-to-end answer; `first_failed_sequence` is set when the
    chain breaks so the dashboard can deep-link to the failed row.
    """

    valid: bool
    rows_checked: int = Field(ge=0)
    head_row_hash: str | None = None
    first_failed_sequence: int | None = None


# -- Datasets ----------------------------------------------------------------


class Dataset(AegisModel):
    """Datasheet-card surface for `/datasets` (Gebru 2021 schema)."""

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    family: ModelFamily
    rows: int = Field(ge=0)
    feature_count: int = Field(ge=0)
    snapshot_url: str = Field(min_length=1)
    datasheet_url: str = Field(min_length=1)
    license: str = Field(min_length=1)
    citation: str = Field(min_length=1)
    last_drift_psi: float | None = None
    attached_models: list[str] = Field(default_factory=list)


# -- Compliance mapping ------------------------------------------------------


class ComplianceMapping(AegisModel):
    """One regulatory anchor mapped to a dashboard panel.

    Sourced verbatim from spec Appendix B. The `panel_route` is a Next.js
    route literal so the compliance page can `<Link href={...}>` to it.
    """

    framework: str = Field(min_length=1)
    article: str = Field(min_length=1)
    requirement: str = Field(min_length=1)
    panel_route: str = Field(pattern=r"^/")
    panel_evidence: str = Field(min_length=1)


__all__ = [
    "ActivityEvent",
    "AegisModel",
    "Approval",
    "AuditPage",
    "AuditRow",
    "CandidateAction",
    "CausalAttribution",
    "CausalRootCause",
    "ChainVerificationResult",
    "ComplianceMapping",
    "Dataset",
    "DriftSignal",
    "GovernanceDecision",
    "KPIPoint",
    "Model",
    "ModelKPI",
    "ModelVersion",
    "Policy",
]
