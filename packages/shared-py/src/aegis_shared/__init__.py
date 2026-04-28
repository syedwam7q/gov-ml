"""Aegis shared schemas + audit-log primitives."""

from aegis_shared.audit import (
    GENESIS_PREV_HASH,
    AuditRow,
    canonicalize_payload,
    compute_row_hash,
    sign_row,
    verify_chain,
    verify_signature,
)
from aegis_shared.schemas import (
    AegisModel,
    Approval,
    DriftSignal,
    GovernanceDecision,
    Model,
    ModelVersion,
    Policy,
)
from aegis_shared.tinybird_client import (
    TINYBIRD_API_BASE,
    TinybirdClient,
    TinybirdError,
)
from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity

__all__ = [
    "GENESIS_PREV_HASH",
    "TINYBIRD_API_BASE",
    "AegisModel",
    "Approval",
    "AuditRow",
    "DecisionState",
    "DriftSignal",
    "GovernanceDecision",
    "Model",
    "ModelFamily",
    "ModelVersion",
    "Policy",
    "RiskClass",
    "Role",
    "Severity",
    "TinybirdClient",
    "TinybirdError",
    "canonicalize_payload",
    "compute_row_hash",
    "sign_row",
    "verify_chain",
    "verify_signature",
]
