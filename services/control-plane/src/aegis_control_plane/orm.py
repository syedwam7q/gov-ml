"""SQLAlchemy ORM models — mirror the Alembic migrations 1:1.

These are the ORM rows persisted by the control plane. Pydantic schemas in
`aegis_shared.schemas` are the API contract; conversion between the two
happens at the router boundary (Pydantic in, ORM out for writes; ORM in,
Pydantic out for reads).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Common DeclarativeBase. Empty by design — each table is explicit."""


class ModelRow(Base):
    """`models` — the registered ML models under Aegis governance."""

    __tablename__ = "models"

    id: Mapped[str] = mapped_column(Text(), primary_key=True)
    name: Mapped[str] = mapped_column(Text(), nullable=False)
    family: Mapped[str] = mapped_column(Text(), nullable=False)
    risk_class: Mapped[str] = mapped_column(Text(), nullable=False)
    active_version: Mapped[str] = mapped_column(Text(), nullable=False)
    owner_id: Mapped[str] = mapped_column(Text(), nullable=False)
    causal_dag: Mapped[dict[str, Any] | None] = mapped_column(JSON(), nullable=True)
    model_card_url: Mapped[str] = mapped_column(Text(), nullable=False)
    datasheet_url: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("family IN ('tabular', 'text')", name="models_family_check"),
        CheckConstraint(
            "risk_class IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="models_risk_class_check",
        ),
    )


class ModelVersionRow(Base):
    """`model_versions` — versioned artifacts per model."""

    __tablename__ = "model_versions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    model_id: Mapped[str] = mapped_column(Text(), ForeignKey("models.id"), nullable=False)
    version: Mapped[str] = mapped_column(Text(), nullable=False)
    artifact_url: Mapped[str] = mapped_column(Text(), nullable=False)
    training_data_snapshot_url: Mapped[str] = mapped_column(Text(), nullable=False)
    qc_metrics: Mapped[dict[str, float]] = mapped_column(JSON(), nullable=False)
    status: Mapped[str] = mapped_column(Text(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("model_id", "version", name="model_versions_model_version_key"),
        CheckConstraint(
            "status IN ('staged', 'canary', 'active', 'retired')",
            name="model_versions_status_check",
        ),
    )


class GovernanceDecisionRow(Base):
    """`governance_decisions` — the central MAPE-K artifact."""

    __tablename__ = "governance_decisions"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    model_id: Mapped[str] = mapped_column(Text(), ForeignKey("models.id"), nullable=False)
    policy_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    state: Mapped[str] = mapped_column(Text(), nullable=False)
    severity: Mapped[str] = mapped_column(Text(), nullable=False)
    drift_signal: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False)
    causal_attribution: Mapped[dict[str, Any] | None] = mapped_column(JSON())
    plan_evidence: Mapped[dict[str, Any] | None] = mapped_column(JSON())
    action_result: Mapped[dict[str, Any] | None] = mapped_column(JSON())
    reward_vector: Mapped[dict[str, float] | None] = mapped_column(JSON())
    observation_window_secs: Mapped[int] = mapped_column(Integer(), nullable=False)
    opened_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    evaluated_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))


class AuditLogRow(Base):
    """`audit_log` — append-only Merkle-chained ledger.

    Database `RULE`s prevent UPDATE / DELETE. The control plane is the only
    writer (all other services emit events that the control plane validates
    and chains).
    """

    __tablename__ = "audit_log"

    sequence_n: Mapped[int] = mapped_column(BigInteger(), primary_key=True)
    decision_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("governance_decisions.id")
    )
    ts: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    actor: Mapped[str] = mapped_column(Text(), nullable=False)
    action: Mapped[str] = mapped_column(Text(), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False)
    prev_hash: Mapped[str] = mapped_column(Text(), nullable=False)
    row_hash: Mapped[str] = mapped_column(Text(), nullable=False)
    signature: Mapped[str] = mapped_column(Text(), nullable=False)


class ApprovalRow(Base):
    """`approvals` — gate for high-risk and critical actions."""

    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    decision_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("governance_decisions.id"),
        nullable=False,
    )
    required_role: Mapped[str] = mapped_column(Text(), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    decided_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    decided_by: Mapped[str | None] = mapped_column(Text())
    decision: Mapped[str | None] = mapped_column(Text())
    justification: Mapped[str | None] = mapped_column(Text())


class PolicyRow(Base):
    """`policies` — the YAML DSL governing each model's actions."""

    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    model_id: Mapped[str] = mapped_column(Text(), ForeignKey("models.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer(), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    mode: Mapped[str] = mapped_column(Text(), nullable=False, default="dry_run")
    dsl_yaml: Mapped[str] = mapped_column(Text(), nullable=False)
    parsed_ast: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    created_by: Mapped[str] = mapped_column(Text(), nullable=False)


class ActionHistoryRow(Base):
    """`action_history` — feedback store for the bandit's posterior."""

    __tablename__ = "action_history"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    decision_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("governance_decisions.id"),
        nullable=False,
    )
    model_id: Mapped[str] = mapped_column(Text(), nullable=False)
    context: Mapped[dict[str, Any]] = mapped_column(JSON(), nullable=False)
    action: Mapped[str] = mapped_column(Text(), nullable=False)
    reward: Mapped[dict[str, float] | None] = mapped_column(JSON())
    observed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
