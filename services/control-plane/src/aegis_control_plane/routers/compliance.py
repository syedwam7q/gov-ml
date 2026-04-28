"""Static regulatory mapping endpoint — `/api/cp/compliance`.

Returns the list of frameworks the platform demonstrably supports, with
a clause-level breakdown and a one-line pointer to the dashboard panel
that produces the evidence. The data is static — sourced from spec
Appendix B in `compliance_data.py`.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from aegis_control_plane.compliance_data import COMPLIANCE_MAPPINGS

router = APIRouter(prefix="/api/cp/compliance", tags=["compliance"])


@router.get("")
async def list_compliance() -> list[dict[str, Any]]:  # noqa: RUF029
    """Read the regulatory mapping table — one entry per framework."""
    return COMPLIANCE_MAPPINGS
