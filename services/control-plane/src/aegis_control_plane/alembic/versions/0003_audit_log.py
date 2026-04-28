"""audit_log + append-only RULEs

Revision ID: 0003_audit_log
Revises: 0002_governance_decisions
Create Date: 2026-04-28 12:02:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_audit_log"
down_revision: str | None = "0002_governance_decisions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column("sequence_n", sa.BigInteger(), primary_key=True),
        sa.Column(
            "decision_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("governance_decisions.id"),
        ),
        sa.Column(
            "ts",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("actor", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("prev_hash", sa.Text(), nullable=False),
        sa.Column("row_hash", sa.Text(), nullable=False),
        sa.Column("signature", sa.Text(), nullable=False),
    )
    op.execute(
        "CREATE SEQUENCE IF NOT EXISTS audit_log_sequence_n_seq OWNED BY audit_log.sequence_n"
    )
    op.execute(
        "ALTER TABLE audit_log ALTER COLUMN sequence_n "
        "SET DEFAULT nextval('audit_log_sequence_n_seq')"
    )
    # The append-only invariant: no UPDATE, no DELETE on audit_log, ever.
    op.execute("CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING")
    op.execute("CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING")
    op.create_index("audit_log_decision_id_idx", "audit_log", ["decision_id"])
    op.create_index("audit_log_ts_idx", "audit_log", ["ts"])


def downgrade() -> None:
    op.execute("DROP RULE IF EXISTS audit_log_no_update ON audit_log")
    op.execute("DROP RULE IF EXISTS audit_log_no_delete ON audit_log")
    op.drop_index("audit_log_ts_idx", table_name="audit_log")
    op.drop_index("audit_log_decision_id_idx", table_name="audit_log")
    op.drop_table("audit_log")
    op.execute("DROP SEQUENCE IF EXISTS audit_log_sequence_n_seq")
