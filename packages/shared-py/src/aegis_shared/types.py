"""Type enums shared across Aegis services."""

from enum import StrEnum
from functools import total_ordering


@total_ordering
class Severity(StrEnum):
    """Severity of a detected signal or decision. Ordered LOW < MEDIUM < HIGH < CRITICAL."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

    @property
    def _ordinal(self) -> int:
        return {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}[self.value]

    def __lt__(self, other: object) -> bool:
        if not isinstance(other, Severity):
            return NotImplemented
        return self._ordinal < other._ordinal


class DecisionState(StrEnum):
    """The five durable states of a GovernanceDecision (plus awaiting_approval)."""

    DETECTED = "detected"
    ANALYZED = "analyzed"
    PLANNED = "planned"
    AWAITING_APPROVAL = "awaiting_approval"
    EXECUTING = "executing"
    EVALUATED = "evaluated"


class RiskClass(StrEnum):
    """Per-model and per-action risk classification."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Role(StrEnum):
    """RBAC roles enforced by control-plane and Clerk."""

    VIEWER = "viewer"
    OPERATOR = "operator"
    ADMIN = "admin"


class ModelFamily(StrEnum):
    """ML model family — drives which detection service handles the model."""

    TABULAR = "tabular"
    TEXT = "text"
