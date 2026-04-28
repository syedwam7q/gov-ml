"""Lock the wire-type surface so the JSON-Schema codegen never silently drops a model.

Every name listed here is consumed by the dashboard via `@aegis/shared-ts`. If a
schema is removed or renamed in `aegis_shared.schemas` without updating this list,
the test fails — and the dashboard's typecheck fails minutes later. This is the
"schema is law" guarantee from spec §4.4.2 in test form.
"""

from __future__ import annotations

import importlib

REQUIRED_WIRE_TYPES: tuple[str, ...] = (
    "Model",
    "ModelVersion",
    "GovernanceDecision",
    "Approval",
    "DriftSignal",
    "Policy",
    "CandidateAction",
    "CausalAttribution",
    "ModelKPI",
    "KPIPoint",
    "ActivityEvent",
    "AuditRow",
    "AuditPage",
    "ChainVerificationResult",
    "Dataset",
    "ComplianceMapping",
)


def test_every_required_schema_is_exported_from_aegis_shared_schemas() -> None:
    """The codegen pulls these names — they must all be importable from one module."""
    mod = importlib.import_module("aegis_shared.schemas")
    missing = [name for name in REQUIRED_WIRE_TYPES if not hasattr(mod, name)]
    assert not missing, f"missing wire types in aegis_shared.schemas: {missing}"


def test_required_wire_types_appear_in_dunder_all() -> None:
    """`__all__` must list every wire type so `from schemas import *` is enough."""
    mod = importlib.import_module("aegis_shared.schemas")
    exported = set(getattr(mod, "__all__", ()))
    missing = [name for name in REQUIRED_WIRE_TYPES if name not in exported]
    assert not missing, f"missing names in aegis_shared.schemas.__all__: {missing}"
