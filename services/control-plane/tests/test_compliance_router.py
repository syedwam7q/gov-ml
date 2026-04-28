"""Tests for `/api/cp/compliance`.

Locks the regulatory frameworks the platform claims to support.
Adding a framework requires updating both this list and the static
data in `compliance_data.py` — that's intentional friction so claims
the dashboard renders are explicitly authored.
"""

from __future__ import annotations

from aegis_control_plane.app import build_app
from fastapi.testclient import TestClient

REQUIRED_FRAMEWORKS = {"EU AI Act", "NIST AI RMF", "ECOA", "HIPAA", "FCRA"}


def test_compliance_returns_required_frameworks() -> None:
    res = TestClient(build_app()).get("/api/cp/compliance")
    assert res.status_code == 200
    body = res.json()
    frameworks = {row["framework"] for row in body}
    assert frameworks >= REQUIRED_FRAMEWORKS


def test_every_clause_has_status_and_evidence() -> None:
    res = TestClient(build_app()).get("/api/cp/compliance")
    body = res.json()
    for framework in body:
        assert framework["clauses"], f"{framework['framework']} has zero clauses"
        for clause in framework["clauses"]:
            assert clause["clause"]
            assert clause["title"]
            assert clause["status"] in {"complete", "partial", "n/a"}
            assert clause["evidence"]


def test_eu_ai_act_covers_articles_12_and_14() -> None:
    """Two articles the spec calls out as load-bearing — verify they're declared."""
    body = TestClient(build_app()).get("/api/cp/compliance").json()
    eu = next(r for r in body if r["framework"] == "EU AI Act")
    articles = {c["clause"] for c in eu["clauses"]}
    assert any("12" in a for a in articles)
    assert any("14" in a for a in articles)
