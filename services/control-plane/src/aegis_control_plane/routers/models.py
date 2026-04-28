"""REST API for the model registry — `/api/v1/models`."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from aegis_control_plane.db import get_session
from aegis_control_plane.orm import ModelRow, ModelVersionRow
from aegis_shared.schemas import Model, ModelVersion

router = APIRouter(prefix="/api/v1/models", tags=["models"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _row_to_model(row: ModelRow) -> Model:
    return Model.model_validate(
        {
            "id": row.id,
            "name": row.name,
            "family": row.family,
            "risk_class": row.risk_class,
            "active_version": row.active_version,
            "owner_id": row.owner_id,
            "causal_dag": row.causal_dag,
            "model_card_url": row.model_card_url,
            "datasheet_url": row.datasheet_url,
            "created_at": row.created_at,
        }
    )


def _row_to_version(row: ModelVersionRow) -> ModelVersion:
    return ModelVersion.model_validate(
        {
            "id": str(row.id),
            "model_id": row.model_id,
            "version": row.version,
            "artifact_url": row.artifact_url,
            "training_data_snapshot_url": row.training_data_snapshot_url,
            "qc_metrics": row.qc_metrics,
            "status": row.status,
            "created_at": row.created_at,
        }
    )


@router.get("", response_model=list[Model])
async def list_models(session: SessionDep) -> list[Model]:
    """List every model registered with Aegis."""
    result = await session.execute(select(ModelRow).order_by(ModelRow.id))
    return [_row_to_model(r) for r in result.scalars().all()]


@router.get("/{model_id}", response_model=Model)
async def get_model(model_id: str, session: SessionDep) -> Model:
    row = await session.get(ModelRow, model_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"model {model_id!r} not found")
    return _row_to_model(row)


@router.post("", response_model=Model, status_code=status.HTTP_201_CREATED)
async def register_model(payload: Model, session: SessionDep) -> Model:
    """Register a new model. The control plane is the source of truth.

    The caller chooses the id (e.g. `credit-v1`); the control plane stores
    everything verbatim. Audit-log entries for model lifecycle events are
    written by Phase 3+ — Phase 2 just persists.
    """
    row = ModelRow(
        id=payload.id,
        name=payload.name,
        family=payload.family.value,
        risk_class=payload.risk_class.value,
        active_version=payload.active_version,
        owner_id=payload.owner_id,
        causal_dag=payload.causal_dag,
        model_card_url=payload.model_card_url,
        datasheet_url=payload.datasheet_url,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"model {payload.id!r} already exists"
        ) from exc
    await session.refresh(row)
    return _row_to_model(row)


@router.get("/{model_id}/versions", response_model=list[ModelVersion])
async def list_versions(model_id: str, session: SessionDep) -> list[ModelVersion]:
    parent = await session.get(ModelRow, model_id)
    if parent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"model {model_id!r} not found")
    result = await session.execute(
        select(ModelVersionRow)
        .where(ModelVersionRow.model_id == model_id)
        .order_by(ModelVersionRow.created_at)
    )
    return [_row_to_version(r) for r in result.scalars().all()]


@router.post(
    "/{model_id}/versions",
    response_model=ModelVersion,
    status_code=status.HTTP_201_CREATED,
)
async def register_version(
    model_id: str, payload: ModelVersion, session: SessionDep
) -> ModelVersion:
    if payload.model_id != model_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"payload.model_id ({payload.model_id!r}) does not match path ({model_id!r})",
        )
    parent = await session.get(ModelRow, model_id)
    if parent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"model {model_id!r} not found")
    row = ModelVersionRow(
        id=payload.id,
        model_id=payload.model_id,
        version=payload.version,
        artifact_url=payload.artifact_url,
        training_data_snapshot_url=payload.training_data_snapshot_url,
        qc_metrics=payload.qc_metrics,
        status=payload.status,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"version {payload.version!r} already exists for model {model_id!r}",
        ) from exc
    await session.refresh(row)
    return _row_to_version(row)
