"""models + versions

Revision ID: 0001_models_and_versions
Revises:
Create Date: 2026-04-28 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_models_and_versions"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "models",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("family", sa.Text(), nullable=False),
        sa.Column("risk_class", sa.Text(), nullable=False),
        sa.Column("active_version", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Text(), nullable=False),
        sa.Column("causal_dag", sa.JSON()),
        sa.Column("model_card_url", sa.Text(), nullable=False),
        sa.Column("datasheet_url", sa.Text()),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("family IN ('tabular', 'text')", name="models_family_check"),
        sa.CheckConstraint(
            "risk_class IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="models_risk_class_check",
        ),
    )
    op.create_table(
        "model_versions",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("model_id", sa.Text(), sa.ForeignKey("models.id"), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("artifact_url", sa.Text(), nullable=False),
        sa.Column("training_data_snapshot_url", sa.Text(), nullable=False),
        sa.Column("qc_metrics", sa.JSON(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("model_id", "version", name="model_versions_model_version_key"),
        sa.CheckConstraint(
            "status IN ('staged', 'canary', 'active', 'retired')",
            name="model_versions_status_check",
        ),
    )


def downgrade() -> None:
    op.drop_table("model_versions")
    op.drop_table("models")
