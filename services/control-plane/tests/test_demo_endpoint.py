"""Tests for the Apple Card demo endpoint."""

from __future__ import annotations

import asyncio
import json

import pytest
from aegis_control_plane.app import build_app
from aegis_control_plane.routers.demo import (
    _CHOREOGRAPHY,
    _PENDING_DEMO_TASKS,
    APPLE_CARD_SCENARIO,
    _build_event,
)
from aegis_control_plane.routers.stream import get_bus
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_replay_apple_card_returns_demo_id_and_duration() -> None:
    """POST /api/cp/internal/demo/apple-card returns 202 with a
    demo_id and the expected total duration so the dashboard can
    pre-size its progress bar."""
    app = build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/cp/internal/demo/apple-card")
    assert res.status_code == 202
    body = res.json()
    assert "demo_id" in body
    assert body["scenario"] == "apple_card_2019"
    expected = sum(d for _, d in _CHOREOGRAPHY)
    assert float(body["expected_duration_s"]) == pytest.approx(expected)


@pytest.mark.asyncio
async def test_choreography_broadcasts_full_sequence_to_bus() -> None:
    """A subscriber to the bus receives every demo_* event in order."""
    app = build_app()
    bus = get_bus()
    queue = bus.subscribe()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/cp/internal/demo/apple-card")
        assert res.status_code == 202
        # Wait for the choreography to finish (with margin).
        deadline = sum(d for _, d in _CHOREOGRAPHY) + 1.0
        kinds: list[str] = []
        while True:
            try:
                raw = await asyncio.wait_for(queue.get(), timeout=deadline)
            except TimeoutError:
                break
            payload = json.loads(raw)
            kinds.append(payload["type"])
            if payload["type"] == "demo_complete":
                break
    finally:
        bus.unsubscribe(queue)
    assert [kind for kind, _ in _CHOREOGRAPHY] == kinds


def test_apple_card_scenario_payloads_are_self_consistent() -> None:
    """The synthetic data the dashboard renders must satisfy the same
    invariants the real backends enforce — Shapley sum ≈ 1.0, recommended
    action appears in the Pareto candidates, fairness rises post-action."""
    drift = APPLE_CARD_SCENARIO["drift_signal"]
    assert drift["value"] < drift["floor"], "demo must be below floor to be a drift"
    attribution = APPLE_CARD_SCENARIO["causal_attribution"]
    contrib_sum = sum(rc["contribution"] for rc in attribution["root_causes"])
    assert abs(contrib_sum - 1.0) < 1e-6, "Shapley contributions must sum to 1.0"
    plan = APPLE_CARD_SCENARIO["plan_evidence"]
    chosen = plan["chosen_action"]
    candidates = {c["action"] for c in plan["candidates"]}
    assert chosen in candidates, "chosen action must be a Pareto candidate"
    assert chosen == attribution["recommended_action"], (
        "demo: chosen action should match Phase 6 recommendation"
    )
    selected = [c for c in plan["candidates"] if c.get("selected")]
    assert len(selected) == 1, "exactly one candidate must carry selected=True"
    post = APPLE_CARD_SCENARIO["action_result"]["post_mitigation"]
    assert post["demographic_parity_gender"] >= drift["floor"], (
        "post-mitigation fairness must clear the floor"
    )


def test_build_event_rejects_unknown_kind() -> None:
    with pytest.raises(ValueError, match="unknown demo event"):
        _build_event(kind="not_real", demo_id="x", scenario=APPLE_CARD_SCENARIO)


@pytest.mark.asyncio
async def test_choreography_task_is_strong_referenced() -> None:
    """Without a strong reference Python's GC can cancel the task
    between the response returning and the first `await asyncio.sleep`
    boundary, leaving the dashboard frozen on the briefing scene.
    Regression guard for that exact bug."""
    app = build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/cp/internal/demo/apple-card")
    assert res.status_code == 202
    # Right after the response, the task must be tracked.
    assert len(_PENDING_DEMO_TASKS) >= 1
    pending = next(iter(_PENDING_DEMO_TASKS))
    assert not pending.done()


@pytest.mark.asyncio
async def test_first_choreography_event_is_delayed_for_subscribers() -> None:
    """The first event must not fire at t=0 — the dashboard's
    EventSource needs a settle window after the POST returns to
    attach to /api/cp/stream before the briefing event lands."""
    first_kind, first_delay = _CHOREOGRAPHY[0]
    assert first_kind == "demo_started"
    assert first_delay >= 0.5, (
        "first event delay must allow the SSE subscriber to attach; "
        "anything below ~0.5s races the EventSource handshake on slow "
        "browsers (especially Safari)."
    )
