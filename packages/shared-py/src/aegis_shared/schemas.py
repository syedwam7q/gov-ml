"""Pydantic schemas for Aegis events, decisions, signals, and audit records.

This module is the single source of truth. `packages/shared-ts` is generated
from the JSON Schema produced here. Concrete schemas land in subsequent phases.
"""

from pydantic import BaseModel, ConfigDict


class AegisModel(BaseModel):
    """Base for all Aegis Pydantic models. Forbids extra fields and freezes instances."""

    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)
