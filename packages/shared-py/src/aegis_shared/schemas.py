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

from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Severity


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


__all__ = [
    "AegisModel",
    "Approval",
    "DriftSignal",
    "GovernanceDecision",
    "Model",
    "ModelVersion",
    "Policy",
]
