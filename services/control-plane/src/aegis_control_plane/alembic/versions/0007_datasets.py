"""datasets

Revision ID: 0007_datasets
Revises: 0006_action_history
Create Date: 2026-04-28 22:30:00.000000

Adds the `datasets` table — Datasheet-for-Datasets (Gebru 2021) surface
per spec Appendix A. The dashboard's `/datasets` page reads from
`/api/cp/datasets` which projects DatasetRow into the UI's Dataset shape.

Three rows are seeded by `aegis_control_plane.seed.seed_datasets()`:
HMDA Public LAR (credit), Jigsaw Civil Comments (toxicity), and
Diabetes 130-US UCI (readmission) — each with verified citations.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_datasets"
down_revision: str | None = "0006_action_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("row_count", sa.BigInteger(), nullable=False),
        sa.Column("snapshot_id", sa.Text(), nullable=False),
        sa.Column("model_ids", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("datasheet", sa.JSON(), nullable=True),
        sa.Column("snapshots", sa.JSON(), nullable=True),
        sa.Column("schema_overview", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("datasets")
