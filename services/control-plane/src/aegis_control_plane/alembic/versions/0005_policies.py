"""policies

Revision ID: 0005_policies
Revises: 0004_approvals
Create Date: 2026-04-28 12:04:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_policies"
down_revision: str | None = "0004_approvals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "policies",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("model_id", sa.Text(), sa.ForeignKey("models.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "mode",
            sa.Text(),
            nullable=False,
            server_default="dry_run",
        ),
        sa.Column("dsl_yaml", sa.Text(), nullable=False),
        sa.Column("parsed_ast", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.UniqueConstraint("model_id", "version", name="policies_model_version_key"),
        sa.CheckConstraint("mode IN ('live', 'dry_run', 'shadow')", name="policies_mode_check"),
    )


def downgrade() -> None:
    op.drop_table("policies")
