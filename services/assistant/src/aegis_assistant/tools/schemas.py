"""OpenAI-compatible function-calling schemas for the 7 grounded tools.

Spec §11.2. Groq accepts the OpenAI tool-calling shape unchanged.
Every tool is a thin HTTP wrapper around an existing Aegis backend
(control-plane / causal-attrib / action-selector). The schema here is
what the model uses to decide *when* to call a tool and *how* to fill
the arguments — the dispatcher in `tools/dispatcher.py` is what runs.
"""

from __future__ import annotations

from typing import Any

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_fleet_status",
            "description": (
                "Return a summary of all monitored models — id, name, "
                "family, active version, severity, and open-incident "
                "count. Use this when the operator asks 'what models are "
                "we monitoring' or 'what's the fleet doing'."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_model_metrics",
            "description": (
                "Return KPI rollups for one model over a time window: "
                "prediction volume, p50/p95 latency, error rate, headline "
                "fairness/calibration metric. Use this when the operator "
                "asks about a specific model's recent behavior."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "model_id": {
                        "type": "string",
                        "description": "Model id, e.g. 'credit-v1'.",
                    },
                    "window": {
                        "type": "string",
                        "enum": ["24h", "7d", "30d"],
                        "description": "Aggregation window. Defaults to 24h.",
                    },
                },
                "required": ["model_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_decision",
            "description": (
                "Return the full GovernanceDecision row — state, severity, "
                "drift signal, causal attribution, plan evidence, action "
                "result. Use this when the operator references a specific "
                "decision by id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "decision_id": {
                        "type": "string",
                        "description": "UUID of the decision.",
                    },
                },
                "required": ["decision_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_audit_chain",
            "description": (
                "Return the Merkle-chained audit rows scoped to one "
                "decision (max 20). Used to prove what happened, when, "
                "and by whom — chronological log of MAPE-K state "
                "transitions and human approvals."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "decision_id": {
                        "type": "string",
                        "description": "UUID of the decision.",
                    },
                },
                "required": ["decision_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_pending_approvals",
            "description": (
                "Return decisions currently in awaiting_approval state. "
                "Use this when the operator asks 'what's waiting for me?' "
                "or 'is there anything pending?'."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pareto_front",
            "description": (
                "Return the Pareto front of remediation actions for one "
                "decision — Phase 7 action-selector output stored in "
                "`plan_evidence`. Includes posterior intervals, the chosen "
                "action, and the Lagrangian dual. Use when the operator "
                "asks 'why this action?' or 'what were the alternatives?'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "decision_id": {
                        "type": "string",
                        "description": "UUID of the decision.",
                    },
                },
                "required": ["decision_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "explain_drift_signal",
            "description": (
                "Return Phase 6's causal attribution for a drift signal — "
                "Shapley contributions per cause, dominant cause, "
                "recommended action. Use when the operator asks 'why is "
                "X drifting?' or 'what's behind this signal?'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "model_id": {
                        "type": "string",
                        "description": "Model id, e.g. 'credit-v1'.",
                    },
                    "metric": {
                        "type": "string",
                        "description": (
                            "The fairness/drift metric whose shift to "
                            "attribute, e.g. 'demographic_parity_gender'. "
                            "Optional — if omitted, picks the most recent "
                            "decision for that model."
                        ),
                    },
                },
                "required": ["model_id"],
            },
        },
    },
]
