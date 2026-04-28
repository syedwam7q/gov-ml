"""approvals

Revision ID: 0004_approvals
Revises: 0003_audit_log
Create Date: 2026-04-28 12:03:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_approvals"
down_revision: str | None = "0003_audit_log"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "approvals",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "decision_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("governance_decisions.id"),
            nullable=False,
        ),
        sa.Column("required_role", sa.Text(), nullable=False),
        sa.Column(
            "requested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("decided_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("decided_by", sa.Text()),
        sa.Column("decision", sa.Text()),
        sa.Column("justification", sa.Text()),
        sa.CheckConstraint("required_role IN ('operator', 'admin')", name="approvals_role_check"),
        sa.CheckConstraint(
            "decision IS NULL OR decision IN ('approved', 'denied', 'held')",
            name="approvals_decision_check",
        ),
    )


def downgrade() -> None:
    op.drop_table("approvals")
