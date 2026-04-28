"""Tests for the shared Pydantic schemas and type enums."""

import pytest

from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity


class TestSeverity:
    def test_severity_values(self) -> None:
        assert Severity.LOW.value == "LOW"
        assert Severity.MEDIUM.value == "MEDIUM"
        assert Severity.HIGH.value == "HIGH"
        assert Severity.CRITICAL.value == "CRITICAL"

    def test_severity_ordering(self) -> None:
        assert Severity.LOW < Severity.MEDIUM < Severity.HIGH < Severity.CRITICAL

    def test_severity_from_str_invalid(self) -> None:
        with pytest.raises(ValueError, match="UNKNOWN"):
            Severity("UNKNOWN")


class TestDecisionState:
    def test_states(self) -> None:
        assert {s.value for s in DecisionState} == {
            "detected",
            "analyzed",
            "planned",
            "awaiting_approval",
            "executing",
            "evaluated",
        }


class TestRiskClass:
    def test_classes(self) -> None:
        assert {c.value for c in RiskClass} == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


class TestRole:
    def test_roles(self) -> None:
        assert {r.value for r in Role} == {"viewer", "operator", "admin"}


class TestModelFamily:
    def test_families(self) -> None:
        assert {f.value for f in ModelFamily} == {"tabular", "text"}
