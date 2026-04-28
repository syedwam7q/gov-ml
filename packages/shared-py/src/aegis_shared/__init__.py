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
from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity

__all__ = [
    "GENESIS_PREV_HASH",
    "AuditRow",
    "DecisionState",
    "ModelFamily",
    "RiskClass",
    "Role",
    "Severity",
    "canonicalize_payload",
    "compute_row_hash",
    "sign_row",
    "verify_chain",
    "verify_signature",
]
