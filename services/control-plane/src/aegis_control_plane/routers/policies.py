"""REST API for governance policies — `/api/v1/policies`.

Policies are versioned per model. New / changed policies start in `dry_run`
mode by spec discipline; transitioning to `live` is an explicit `PATCH`
that the dashboard surfaces as an admin action. The DSL is YAML; we parse
it into `parsed_ast` at write time so syntax errors surface as 400.
"""

from __future__ import annotations

from typing import Annotated, Any

import yaml
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.db import get_session
from aegis_control_plane.orm import ModelRow, PolicyRow
from aegis_shared.schemas import Policy

router = APIRouter(prefix="/api/cp/policies", tags=["policies"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class PolicyCreate(BaseModel):
    """Inbound payload — fewer fields than `Policy` (server fills the rest)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    model_id: str = Field(min_length=1)
    version: int = Field(ge=1)
    dsl_yaml: str = Field(min_length=1)
    created_by: str = Field(min_length=1)


def _parse_dsl(dsl_yaml: str) -> dict[str, Any]:
    try:
        ast = yaml.safe_load(dsl_yaml)  # type: ignore[no-untyped-call]
    except yaml.YAMLError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=f"policy DSL is not valid YAML: {exc}"
        ) from exc
    if not isinstance(ast, dict):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="policy DSL must parse to a YAML mapping at the top level",
        )
    return ast  # type: ignore[no-any-return]


def _row_to_policy(row: PolicyRow) -> Policy:
    return Policy.model_validate(
        {
            "id": str(row.id),
            "model_id": row.model_id,
            "version": row.version,
            "active": row.active,
            "mode": row.mode,
            "dsl_yaml": row.dsl_yaml,
            "parsed_ast": row.parsed_ast,
            "created_at": row.created_at,
            "created_by": row.created_by,
        }
    )


@router.get("", response_model=list[Policy])
async def list_policies(session: SessionDep, model_id: str | None = None) -> list[Policy]:
    stmt = select(PolicyRow).order_by(PolicyRow.created_at)
    if model_id is not None:
        stmt = stmt.where(PolicyRow.model_id == model_id)
    result = await session.execute(stmt)
    return [_row_to_policy(r) for r in result.scalars().all()]


@router.get("/{policy_id}", response_model=Policy)
async def get_policy(policy_id: str, session: SessionDep) -> Policy:
    row = await session.get(PolicyRow, policy_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"policy {policy_id!r} not found")
    return _row_to_policy(row)


@router.post("", response_model=Policy, status_code=status.HTTP_201_CREATED)
async def create_policy(payload: PolicyCreate, session: SessionDep) -> Policy:
    """Create a new policy. Always lands in `dry_run` mode by spec discipline."""
    parent = await session.get(ModelRow, payload.model_id)
    if parent is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=f"model {payload.model_id!r} not found",
        )
    parsed = _parse_dsl(payload.dsl_yaml)

    row = PolicyRow(
        model_id=payload.model_id,
        version=payload.version,
        active=False,
        mode="dry_run",
        dsl_yaml=payload.dsl_yaml,
        parsed_ast=parsed,
        created_by=payload.created_by,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"policy version {payload.version} already exists for model {payload.model_id!r}"
            ),
        ) from exc
    await session.refresh(row)
    return _row_to_policy(row)
