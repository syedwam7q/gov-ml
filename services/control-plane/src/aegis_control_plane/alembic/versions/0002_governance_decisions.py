"""governance_decisions

Revision ID: 0002_governance_decisions
Revises: 0001_models_and_versions
Create Date: 2026-04-28 12:01:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_governance_decisions"
down_revision: str | None = "0001_models_and_versions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "governance_decisions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("model_id", sa.Text(), sa.ForeignKey("models.id"), nullable=False),
        sa.Column("policy_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("state", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("drift_signal", sa.JSON(), nullable=False),
        sa.Column("causal_attribution", sa.JSON()),
        sa.Column("plan_evidence", sa.JSON()),
        sa.Column("action_result", sa.JSON()),
        sa.Column("reward_vector", sa.JSON()),
        sa.Column("observation_window_secs", sa.Integer(), nullable=False),
        sa.Column(
            "opened_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("evaluated_at", sa.TIMESTAMP(timezone=True)),
        sa.CheckConstraint(
            "state IN ('detected', 'analyzed', 'planned', 'awaiting_approval', "
            "'executing', 'evaluated')",
            name="decisions_state_check",
        ),
        sa.CheckConstraint(
            "severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
            name="decisions_severity_check",
        ),
        sa.CheckConstraint("observation_window_secs >= 1", name="decisions_window_check"),
    )
    op.create_index("decisions_model_state_idx", "governance_decisions", ["model_id", "state"])


def downgrade() -> None:
    op.drop_index("decisions_model_state_idx", table_name="governance_decisions")
    op.drop_table("governance_decisions")
