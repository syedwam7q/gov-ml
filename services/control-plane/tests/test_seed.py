"""Tests for the Apple-Card-2019 hero scenario seeder."""

from __future__ import annotations

import os

import pytest
from aegis_control_plane.config import get_settings
from aegis_control_plane.orm import (
    AuditLogRow,
    GovernanceDecisionRow,
    ModelRow,
    PolicyRow,
)
from aegis_control_plane.seed import HERO_DECISION_ID, seed_hero_scenario
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.db


@pytest.fixture(autouse=True)
def _audit_secret(hmac_secret: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """Configure the HMAC secret for every seeder test (audit append needs it)."""
    monkeypatch.setenv("AUDIT_LOG_HMAC_SECRET", hmac_secret)
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_seed_inserts_three_models_one_decision_six_audit_rows(
    db_session: AsyncSession,
) -> None:
    seeded = await seed_hero_scenario(db_session)
    assert seeded is True

    models = (await db_session.execute(select(ModelRow))).scalars().all()
    decisions = (await db_session.execute(select(GovernanceDecisionRow))).scalars().all()
    audit_rows = (
        (await db_session.execute(select(AuditLogRow).order_by(AuditLogRow.sequence_n)))
        .scalars()
        .all()
    )
    policies = (await db_session.execute(select(PolicyRow))).scalars().all()

    assert {m.id for m in models} == {"credit-v1", "toxicity-v1", "readmission-v1"}
    assert len(decisions) == 1
    assert decisions[0].id == HERO_DECISION_ID
    assert decisions[0].state == "evaluated"
    assert decisions[0].severity == "HIGH"
    assert len(policies) == 1

    actions = [r.action for r in audit_rows]
    assert actions == ["detect", "analyze", "plan", "approval", "execute", "evaluate"]
    # Every row references the hero decision.
    assert {str(r.decision_id) for r in audit_rows} == {HERO_DECISION_ID}


@pytest.mark.asyncio
async def test_seed_is_idempotent(db_session: AsyncSession) -> None:
    first = await seed_hero_scenario(db_session)
    second = await seed_hero_scenario(db_session)
    assert first is True
    assert second is False

    model_count = (
        await db_session.execute(select(func.count()).select_from(ModelRow))
    ).scalar_one()
    decision_count = (
        await db_session.execute(select(func.count()).select_from(GovernanceDecisionRow))
    ).scalar_one()
    audit_count = (
        await db_session.execute(select(func.count()).select_from(AuditLogRow))
    ).scalar_one()

    assert model_count == 3, "second seed must not insert duplicate models"
    assert decision_count == 1, "second seed must not insert a duplicate decision"
    assert audit_count == 6, "second seed must not extend the audit chain again"


@pytest.mark.asyncio
async def test_seeded_audit_chain_verifies(db_session: AsyncSession, hmac_secret: str) -> None:
    """Every seeded audit row hashes correctly and the chain is valid end-to-end."""
    from aegis_shared.audit import AuditRow, verify_chain

    await seed_hero_scenario(db_session)
    rows = (
        (await db_session.execute(select(AuditLogRow).order_by(AuditLogRow.sequence_n)))
        .scalars()
        .all()
    )
    chain = [
        AuditRow(
            sequence_n=r.sequence_n,
            ts=r.ts,
            actor=r.actor,
            action=r.action,
            payload=r.payload,
            prev_hash=r.prev_hash,
            row_hash=r.row_hash,
            signature=r.signature,
        )
        for r in rows
    ]
    # The seeded chain re-uses the configured HMAC secret — same one that
    # signed the rows in `_audit_secret` above.
    assert verify_chain(chain, secret=os.environ["AUDIT_LOG_HMAC_SECRET"]) is True
