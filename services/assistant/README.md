# `services/assistant` — Aegis Governance Assistant

Groq-powered tool-using agent. Spec §11.

The assistant is a FastAPI worker that turns operator questions into
**grounded** answers — every factual claim is backed by a tool call
against the live Aegis backends (control-plane, causal-attrib,
action-selector). The system prompt forbids hallucination; the model
either calls a tool or refuses.

## Tools (7)

| Name                     | Backed by                                       |
| ------------------------ | ----------------------------------------------- |
| `get_fleet_status`       | `GET /api/cp/models`                            |
| `get_model_metrics`      | `GET /api/cp/models/{id}/kpi`                   |
| `get_decision`           | `GET /api/cp/decisions/{id}`                    |
| `get_audit_chain`        | `GET /api/cp/audit?decision_id=...`             |
| `list_pending_approvals` | `GET /api/cp/decisions?state=awaiting_approval` |
| `get_pareto_front`       | reads `plan_evidence` from a decision           |
| `explain_drift_signal`   | reads `causal_attribution` from a decision      |

## Models

Two-model rotation (spec §11.1):

- `llama-3.1-8b-instant` — tool-call decision (fast, cheap)
- `llama-3.3-70b-versatile` — final synthesis (quality)

Configured via `GROQ_MODEL_FAST` and `GROQ_MODEL_QUALITY`.

## Boot

```bash
GROQ_API_KEY=... uv run --package aegis-assistant uvicorn aegis_assistant.app:app --port 8005
```

When `GROQ_API_KEY` is unset, `/chat/stream` returns 503 and the
dashboard renders a fallback message — the rest of the surface
(health, dashboard pages) keeps working.
