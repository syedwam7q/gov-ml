"""Static regulatory mapping table — sourced from spec Appendix B.

The compliance page renders one row per (framework, clause) tuple. Each
row points at the dashboard panel that produces the evidence for that
clause — the panel itself produces a self-contained PDF artifact via
`/compliance` "Generate report".

This file is the single source of truth for the table. Updates happen
here when the spec's compliance appendix changes; the test in
`test_compliance_router.py` locks the framework set so additions or
deletions are visible in CI.
"""

from __future__ import annotations

from typing import Final

# UI-facing shape mirroring `apps/dashboard/app/_lib/types.ts::ComplianceMapping`
# (one entry per framework, with a list of clauses).

# Each clause carries:
#   clause       — article / section identifier
#   title        — short human-readable title
#   status       — 'complete' | 'partial' | 'n/a'
#   evidence     — one-line pointer to the panel proving the control

COMPLIANCE_MAPPINGS: Final[list[dict[str, object]]] = [
    {
        "framework": "EU AI Act",
        "clauses": [
            {
                "clause": "Article 9",
                "title": "Risk management system",
                "status": "complete",
                "evidence": "Versioned policy DSL with dry-run / shadow / live modes — /policies",
            },
            {
                "clause": "Article 12",
                "title": "Logging across the lifetime of the AI system",
                "status": "complete",
                "evidence": "Merkle-chained audit log with daily external anchor — /audit",
            },
            {
                "clause": "Article 13",
                "title": "Transparency to deployers and users",
                "status": "complete",
                "evidence": (
                    "Tool-grounded Governance Assistant — every claim cites an audit row — /chat"
                ),
            },
            {
                "clause": "Article 14",
                "title": "Human oversight",
                "status": "complete",
                "evidence": (
                    "Approval queue with role-gated transitions + emergency stop — /approvals"
                ),
            },
            {
                "clause": "Article 15",
                "title": "Accuracy, robustness, cybersecurity",
                "status": "complete",
                "evidence": "Fleet KPI rollup with 24h fairness + drift monitors — /fleet",
            },
            {
                "clause": "Article 17",
                "title": "Quality management system",
                "status": "complete",
                "evidence": "QC metrics on every model version + canary discipline — /models/[id]",
            },
            {
                "clause": "Article 72 / 73",
                "title": "Post-market monitoring + incident reporting",
                "status": "complete",
                "evidence": "Closed-loop incident feed with full MAPE-K timeline — /incidents",
            },
        ],
    },
    {
        "framework": "NIST AI RMF",
        "clauses": [
            {
                "clause": "GOVERN-1.1",
                "title": "Policies, processes, and procedures for managing AI risks",
                "status": "complete",
                "evidence": "Versioned, signed, mode-gated policy DSL — /policies",
            },
            {
                "clause": "MAP-2.3",
                "title": "Mapping AI risks to specific contexts of use",
                "status": "complete",
                "evidence": "Per-model risk class + datasheet — /datasets, /models/[id]",
            },
            {
                "clause": "MEASURE-2.6",
                "title": "Performance, robustness, safety, and trustworthiness measured",
                "status": "complete",
                "evidence": "Per-model drift / fairness / calibration / performance tabs",
            },
            {
                "clause": "MANAGE-2.4",
                "title": "Mechanisms to mitigate, modify, or terminate AI systems",
                "status": "complete",
                "evidence": "Pareto action selector + rollback + emergency stop — /approvals",
            },
        ],
    },
    {
        "framework": "ECOA",
        "clauses": [
            {
                "clause": "Reg B § 1002.4",
                "title": "Equal credit access — disparate-impact testing",
                "status": "complete",
                "evidence": "Fairlearn subgroup metrics on credit-v1 — /models/credit-v1",
            },
            {
                "clause": "CFPB Circular 2022-03",
                "title": "Adverse-action notices for credit denials",
                "status": "partial",
                "evidence": (
                    "Causal attribution provides a per-decision reason; UI integration pending"
                ),
            },
        ],
    },
    {
        "framework": "HIPAA",
        "clauses": [
            {
                "clause": "§ 164.312",
                "title": "Technical safeguards (audit controls)",
                "status": "complete",
                "evidence": "Append-only Merkle chain — /audit",
            },
            {
                "clause": "§ 164.514",
                "title": "De-identification of protected health information",
                "status": "n/a",
                "evidence": "Diabetes-130 dataset is already de-identified per UCI release notes",
            },
        ],
    },
    {
        "framework": "FCRA",
        "clauses": [
            {
                "clause": "§ 1681i",
                "title": "Procedure in case of disputed accuracy",
                "status": "complete",
                "evidence": (
                    "Decision detail page + audit chain provides full traceability — "
                    "/incidents/[id]"
                ),
            },
        ],
    },
]
