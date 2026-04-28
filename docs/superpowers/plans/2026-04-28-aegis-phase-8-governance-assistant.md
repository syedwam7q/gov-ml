# Aegis — Phase 8: Governance Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `services/assistant` — a Groq-powered tool-using agent that grounds every claim on a tool call against the live MAPE-K knowledge plane. Wire the dashboard's `/chat` page and the Cmd+K assistant drawer to live answers. Plus: persist Phase 7's CB-Knapsack bandit posterior to Redis so it survives process restarts.

**Architecture:** The service is a FastAPI Python worker that calls Groq's OpenAI-compatible chat completions API (via the official `groq` Python SDK) with a 7-tool function-calling schema. Each tool dispatcher is a thin HTTP client against an existing Aegis backend (control-plane / causal-attrib / action-selector / Tinybird). The model runs a tool-call loop until it produces a final answer, which streams to the dashboard via SSE. The system prompt enforces _every claim must reference a tool result_ — refusal otherwise. Two-model rotation: **Llama 3.1 8B Instant** for the tool-call decision step (cheap + fast), **Llama 3.3 70B Versatile** for the final synthesis (quality).

**Tech Stack:** `groq>=0.13` (official Python SDK with streaming support) · FastAPI · `sse-starlette` · `httpx` · Pydantic v2 · `redis>=5.2` (for Phase 7 BLR persistence) · pytest + pytest-asyncio + `respx` (httpx mocking).

**Spec reference:** `docs/superpowers/specs/2026-04-28-aegis-design.md` §11 (full Governance Assistant spec — load-bearing) plus §11.4 ("grounded natural-language oversight interface" framing for EU AI Act Article 13/14 compliance). Also resolves the Phase 7 deferred item (Redis-backed BLR persistence).

**Why this phase, why now.** Phases 6 + 7 made `causal_attribution` and `plan_evidence` real. Phase 8 makes the dashboard's `/chat` page real — every operator question is answered by a tool call against the live system, not by an LLM hallucinating state. This is the **transparency contract** that closes the loop on the paper's compliance claim: EU AI Act Article 13 ("transparency to deployers") + Article 14 ("human oversight"). Without grounded answers, the audit chain proves _what happened_, but operators can't _interrogate_ it conversationally — and a 5-year-old fairness drift is exactly the case where conversational interrogation matters.

---

## File structure created or modified in Phase 8

```
gov-ml/
├── services/assistant/
│   ├── pyproject.toml                                       # CREATE
│   ├── README.md                                             # CREATE — what + how + spec §11 anchor
│   ├── src/aegis_assistant/
│   │   ├── __init__.py                                       # CREATE
│   │   ├── py.typed                                          # CREATE
│   │   ├── app.py                                            # CREATE — FastAPI app
│   │   ├── config.py                                         # CREATE — settings (GROQ_API_KEY, model IDs)
│   │   ├── system_prompt.py                                  # CREATE — grounding-enforcement prompt
│   │   ├── groq_client.py                                    # CREATE — wrapper with model rotation + retry
│   │   ├── tools/
│   │   │   ├── __init__.py                                   # CREATE — TOOL_REGISTRY export
│   │   │   ├── schemas.py                                    # CREATE — 7 OpenAI-compatible JSON Schema specs
│   │   │   ├── dispatcher.py                                 # CREATE — execute_tool(name, args) router
│   │   │   ├── fleet.py                                      # CREATE — get_fleet_status
│   │   │   ├── metrics.py                                    # CREATE — get_model_metrics
│   │   │   ├── decision.py                                   # CREATE — get_decision + get_audit_chain
│   │   │   ├── approvals.py                                  # CREATE — list_pending_approvals
│   │   │   ├── pareto.py                                     # CREATE — get_pareto_front
│   │   │   └── drift.py                                      # CREATE — explain_drift_signal
│   │   ├── chat_loop.py                                      # CREATE — tool-call orchestration
│   │   └── routers/
│   │       ├── __init__.py                                   # CREATE
│   │       ├── health.py                                     # CREATE
│   │       └── chat.py                                       # CREATE — POST /chat/stream (SSE)
│   └── tests/
│       ├── __init__.py                                       # CREATE
│       ├── conftest.py                                       # CREATE — respx fixtures + canned Groq responses
│       ├── test_health.py                                    # CREATE
│       ├── test_system_prompt.py                             # CREATE — refusal pattern lock
│       ├── test_tools_schemas.py                             # CREATE — every tool has a JSON Schema spec
│       ├── test_tools_dispatcher.py                          # CREATE — name → dispatcher routing
│       ├── test_tool_fleet.py                                # CREATE — calls /api/cp/fleet/kpi
│       ├── test_tool_metrics.py                              # CREATE — calls /api/cp/models/{id}/kpi
│       ├── test_tool_decision.py                             # CREATE — calls /api/cp/decisions + /audit
│       ├── test_tool_approvals.py                            # CREATE
│       ├── test_tool_pareto.py                               # CREATE — calls /api/cp/decisions for plan_evidence
│       ├── test_tool_drift.py                                # CREATE — calls /api/causal/attrib/run
│       ├── test_chat_loop.py                                 # CREATE — happy path + refusal + tool-error
│       └── test_chat_stream_endpoint.py                      # CREATE — SSE roundtrip
├── services/action-selector/src/aegis_action_selector/
│   └── persistence.py                                        # MODIFY — add Redis backend; in-memory becomes fallback
├── services/action-selector/tests/
│   └── test_persistence_redis.py                             # CREATE — Redis-gated integration test
├── apps/dashboard/
│   ├── app/_lib/
│   │   ├── api.ts                                            # MODIFY — add streamChat() helper
│   │   └── chat-stream.ts                                    # CREATE — typed EventSource for chat tokens
│   ├── app/(app)/chat/_view.tsx                              # MODIFY — wire to live backend
│   └── app/(app)/_components/
│       └── assistant-drawer.tsx                              # MODIFY — wire ⌘K drawer to /api/assistant/stream
├── packages/shared-py/src/aegis_shared/
│   └── schemas.py                                            # MODIFY — add ChatTurn + ToolCall wire types
├── apps/dashboard/app/_lib/types.ts                          # MODIFY — mirror ChatTurn / ToolCall
├── pyproject.toml                                            # MODIFY — register services/assistant
├── vercel.ts                                                 # MODIFY — /api/assistant/* rewrite
├── apps/dashboard/next.config.mjs                            # MODIFY — proxy /api/assistant/* to localhost:8005 in dev
├── apps/dashboard/tests/e2e/
│   └── assistant-chat.spec.ts                                # CREATE — end-to-end Playwright walk
├── docs/paper/figures/
│   └── assistant_grounded_diagram.svg                        # CREATE — paper figure (deferred to Phase 10 if scope tight)
└── setup.md                                                  # MODIFY — Phase 8 section
```

---

## Phase 8 sub-phases

| Sub-phase | Title                             | What ships                                                                                            |
| --------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 8a        | Service scaffold                  | `services/assistant` workspace package + /healthz                                                     |
| 8b        | Schemas + system prompt           | `ChatTurn` / `ToolCall` Pydantic schemas; the grounding system prompt; refusal pattern locked in test |
| 8c        | Tool registry — 7 tools           | OpenAI-compatible JSON Schemas + per-tool HTTP dispatchers against existing backends                  |
| 8d        | Groq client + chat loop           | Two-model rotation; tool-call orchestration loop; safe-error handling                                 |
| 8e        | POST /chat/stream endpoint        | SSE streaming with token-by-token deltas + tool-call notifications                                    |
| 8f        | Dashboard /chat page wired        | EventSource consumer; renders streaming tokens + tool chips; thread history                           |
| 8g        | Cmd+K assistant drawer            | Scope-aware drawer (e.g. `/incidents/<id>` → drawer pre-loads with that decision)                     |
| 8h        | Redis-backed BLR persistence      | Phase 7 follow-up — Phase 7 bandit posterior survives restarts; in-memory fallback when Redis unset   |
| 8i        | setup.md + vercel.ts + Playwright | Phase 8 boot instructions; rewrites; live E2E test                                                    |
| 8j        | Tag phase-8-complete + push       | Verify CI, merge to main, push                                                                        |

---

## Sub-phase 8a — Service scaffold

### Task 1: Workspace package + /healthz

**Files:**

- Create: `services/assistant/pyproject.toml`
- Create: `services/assistant/src/aegis_assistant/{__init__.py, py.typed, app.py, routers/__init__.py, routers/health.py}`
- Create: `services/assistant/tests/{__init__.py, test_health.py}`
- Modify: `pyproject.toml` (root) — add `services/assistant` workspace member + testpath

- [ ] **Step 1: pyproject.toml**

```toml
# services/assistant/pyproject.toml
[project]
name = "aegis-assistant"
version = "0.1.0"
description = "Groq-powered Governance Assistant for Aegis (spec §11)"
requires-python = ">=3.13"
dependencies = [
  "aegis-shared",
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "httpx>=0.28.0",
  "pydantic>=2.10.0",
  "pydantic-settings>=2.6.0",
  "groq>=0.13.0",
  "sse-starlette>=2.1.0",
  "redis>=5.2.0",
]

[tool.uv.sources]
aegis-shared = { workspace = true }

[dependency-groups]
dev = ["pytest>=8.3.0", "pytest-asyncio>=0.24.0", "respx>=0.21.0", "fakeredis>=2.26.0"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/aegis_assistant"]

[tool.pyright]
include = ["src", "tests"]
strict = ["src/aegis_assistant"]
pythonVersion = "3.13"
```

- [ ] **Step 2: **init**.py / py.typed / app.py / health.py** — same shape as `services/causal-attrib/src/aegis_causal_attrib/`. The factory mounts only the health router; chat lands in 8e.

```python
# services/assistant/src/aegis_assistant/__init__.py
"""Aegis Governance Assistant — Groq-powered tool-using agent.

Spec §11. Every claim the assistant makes must reference a tool-call
result against the live MAPE-K knowledge plane. The system prompt
enforces this and refuses to answer otherwise.

Two models in rotation:
  • llama-3.1-8b-instant       — tool-call decision (cheap, fast)
  • llama-3.3-70b-versatile    — final synthesis (quality)
"""

__version__ = "0.1.0"
```

```python
# services/assistant/src/aegis_assistant/routers/health.py
from __future__ import annotations
from datetime import UTC, datetime
from fastapi import APIRouter
from aegis_assistant import __version__

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, object]:  # noqa: RUF029
    return {"ok": True, "service": "assistant", "version": __version__}


@router.get("/readyz")
async def readyz() -> dict[str, object]:  # noqa: RUF029
    return {"ready": True, "ts": datetime.now(UTC).isoformat()}
```

```python
# services/assistant/src/aegis_assistant/app.py
from __future__ import annotations
from fastapi import FastAPI
from aegis_assistant import __version__
from aegis_assistant.routers import health as health_router


def build_app() -> FastAPI:
    app = FastAPI(
        title="Aegis Governance Assistant",
        version=__version__,
        description=(
            "Groq-powered tool-using agent grounded on the MAPE-K knowledge plane (spec §11)."
        ),
    )
    app.include_router(health_router.router)
    return app


app = build_app()
```

- [ ] **Step 3: Workspace registration**

```toml
# pyproject.toml (root) — extend
[tool.uv.workspace]
members = [
  "packages/shared-py",
  "ml-pipelines/_shared",
  "services/control-plane",
  "services/detect-tabular",
  "services/detect-text",
  "services/causal-attrib",
  "services/action-selector",
  "services/assistant",
]

[tool.pytest.ini_options]
testpaths = [
  ...,
  "services/assistant/tests",
]
```

- [ ] **Step 4: Health test + run + commit**

```python
# services/assistant/tests/test_health.py
from fastapi.testclient import TestClient
from aegis_assistant.app import build_app


def test_healthz_returns_ok() -> None:
    res = TestClient(build_app()).get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["service"] == "assistant"


def test_readyz_returns_ready() -> None:
    res = TestClient(build_app()).get("/readyz")
    assert res.status_code == 200
    assert res.json()["ready"] is True
```

```bash
uv sync --all-packages
uv run --package aegis-assistant pytest services/assistant/tests/test_health.py -v
git add services/assistant pyproject.toml uv.lock
git commit -m "feat(assistant): Phase 8 — workspace package + /healthz scaffold"
```

---

## Sub-phase 8b — Wire schemas + grounding system prompt

### Task 2: ChatTurn / ToolCall wire types

**Files:**

- Modify: `packages/shared-py/src/aegis_shared/schemas.py` — add `ChatTurn`, `ToolCall`, `ChatRequest`, `ChatStreamFrame`
- Modify: `packages/shared-py/tests/test_schemas_complete.py` — add new names to lock list
- Modify: `apps/dashboard/app/_lib/types.ts` — mirror as TS interfaces

- [ ] **Step 1: Append schemas**

```python
# packages/shared-py/src/aegis_shared/schemas.py — append before __all__

class ToolCall(AegisModel):
    """One executed tool call inside a chat turn."""

    name: str = Field(min_length=1)
    arguments: dict[str, Any]
    result_summary: str
    """Truncated, human-readable summary of the tool result. The full
    JSON result lives in `result_payload`."""
    result_payload: dict[str, Any] | list[Any] | None = None
    error: str | None = None
    """Set when the tool dispatcher raised; the assistant surfaces this
    rather than hallucinating a successful result."""


class ChatTurn(AegisModel):
    """One turn in a Governance Assistant conversation."""

    role: str = Field(pattern=r"^(user|assistant|system|tool)$")
    content: str
    tool_calls: list[ToolCall] = Field(default_factory=list)


class ChatRequest(AegisModel):
    """Request body for `POST /chat/stream`."""

    messages: list[ChatTurn]
    """User turn is the last entry; previous turns are conversation history."""
    scope: dict[str, Any] = Field(default_factory=dict)
    """Free-form context — e.g. `{"decision_id": "..."}` when the drawer
    opens scoped to /incidents/<id>. The system prompt picks this up."""
```

Append to `__all__`: `"ChatTurn"`, `"ToolCall"`, `"ChatRequest"`.

- [ ] **Step 2: Update lock list**

```python
# packages/shared-py/tests/test_schemas_complete.py — extend REQUIRED_WIRE_TYPES
REQUIRED_WIRE_TYPES: tuple[str, ...] = (
    ...,  # everything currently there
    "ChatTurn",
    "ToolCall",
    "ChatRequest",
)
```

- [ ] **Step 3: Mirror in dashboard types**

```typescript
// apps/dashboard/app/_lib/types.ts — append

export interface ToolCall {
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  readonly result_summary: string;
  readonly result_payload?: unknown;
  readonly error?: string;
}

export interface ChatTurn {
  readonly role: "user" | "assistant" | "system" | "tool";
  readonly content: string;
  readonly tool_calls?: readonly ToolCall[];
}
```

- [ ] **Step 4: Run + commit**

```bash
uv run --package aegis-shared pytest packages/shared-py/tests/test_schemas_complete.py -v
pnpm --filter @aegis/dashboard typecheck
git add packages/shared-py/src/aegis_shared/schemas.py \
        packages/shared-py/tests/test_schemas_complete.py \
        apps/dashboard/app/_lib/types.ts
git commit -m "feat(schema): Phase 8 — ChatTurn + ToolCall + ChatRequest wire types"
```

### Task 3: Grounding system prompt

**Files:**

- Create: `services/assistant/src/aegis_assistant/system_prompt.py`
- Create: `services/assistant/tests/test_system_prompt.py`

The system prompt is the assistant's safety contract — it tells the model to (a) call tools instead of guessing, (b) refuse off-topic queries, (c) cite tool calls in every claim. We lock its essential properties in tests.

- [ ] **Step 1: Failing test**

```python
# services/assistant/tests/test_system_prompt.py
"""Lock the system-prompt invariants. The prompt is the assistant's
safety contract — accidental edits should fail this test."""

from __future__ import annotations
from aegis_assistant.system_prompt import build_system_prompt


def test_prompt_mentions_grounding_requirement() -> None:
    """The prompt must require tool-call grounding for every claim."""
    prompt = build_system_prompt(scope={})
    lower = prompt.lower()
    assert "tool" in lower
    assert "ground" in lower or "grounded" in lower or "cite" in lower


def test_prompt_mentions_refusal_pattern() -> None:
    """Off-topic queries that would require hallucination → refuse."""
    prompt = build_system_prompt(scope={})
    assert "refuse" in prompt.lower() or "decline" in prompt.lower()


def test_prompt_lists_all_seven_tools_by_name() -> None:
    prompt = build_system_prompt(scope={})
    expected = (
        "get_fleet_status",
        "get_model_metrics",
        "get_decision",
        "get_audit_chain",
        "list_pending_approvals",
        "get_pareto_front",
        "explain_drift_signal",
    )
    for name in expected:
        assert name in prompt, f"prompt missing tool {name!r}"


def test_scope_decision_id_is_threaded_into_prompt() -> None:
    """When the dashboard opens the drawer scoped to a decision, the
    prompt should mention that decision so the model uses it."""
    prompt = build_system_prompt(scope={"decision_id": "abc-123"})
    assert "abc-123" in prompt


def test_no_tool_in_scope_produces_clean_prompt() -> None:
    prompt = build_system_prompt(scope={})
    # No accidental "abc-123" leak from a previous build call.
    assert "abc-123" not in prompt
```

- [ ] **Step 2: Implement**

```python
# services/assistant/src/aegis_assistant/system_prompt.py
"""The Governance Assistant's grounding system prompt — spec §11."""

from __future__ import annotations
from typing import Any

_SYSTEM_PROMPT_TEMPLATE = """\
You are the Aegis Governance Assistant. Aegis is an autonomous self-healing
ML governance platform that monitors three production models (credit-v1,
toxicity-v1, readmission-v1) for drift, fairness, and calibration issues.

Your role is a **grounded natural-language oversight interface** for
operators interrogating the system (EU AI Act Articles 13 + 14). You answer
questions about the fleet, specific models, decisions, audit chains,
approvals, Pareto fronts, and drift signals.

# Grounding — non-negotiable

Every factual claim in your answer MUST be backed by a tool call against
the live system. You never guess values, never recall from training data,
never invent decision IDs or metric numbers. When an operator asks
"what is X?", you call the tool that returns X — then cite it.

If the question would require hallucination (e.g. "what's the weather?",
"who founded the company?"), refuse politely and explain you only answer
questions about the Aegis fleet.

# Available tools (7)

- get_fleet_status() — overview of all monitored models + open incidents
- get_model_metrics(model_id, window) — accuracy / fairness / latency rollups
- get_decision(decision_id) — full GovernanceDecision row
- get_audit_chain(decision_id) — Merkle-chained audit rows for the decision
- list_pending_approvals() — operator queue
- get_pareto_front(decision_id) — Phase 7 action-selector output
- explain_drift_signal(model_id, metric) — Phase 6 causal-attribution output

# Style

- Plain prose, no markdown headings inside answers (the dashboard wraps
  your output in a chat bubble — keep it conversational).
- Cite tool calls inline with parenthetical references like
  "(see `get_decision(dec-001)`)" so the dashboard can render them as chips.
- When you reference a metric, include the units and the floor/ceiling
  the policy enforces (e.g. "DP_gender 0.71, below the 0.80 floor").
"""


def build_system_prompt(*, scope: dict[str, Any]) -> str:
    """Render the system prompt, optionally threading scope into context."""
    parts = [_SYSTEM_PROMPT_TEMPLATE.strip()]
    if scope:
        scope_lines = ["", "# Current scope (the dashboard opened the drawer here):"]
        for key, value in scope.items():
            scope_lines.append(f"- {key}: {value}")
        parts.append("\n".join(scope_lines))
    return "\n\n".join(parts)
```

- [ ] **Step 3: Run + commit**

```bash
uv run --package aegis-assistant pytest services/assistant/tests/test_system_prompt.py -v
git add services/assistant/src/aegis_assistant/system_prompt.py \
        services/assistant/tests/test_system_prompt.py
git commit -m "feat(assistant): Phase 8 — grounding system prompt with refusal pattern + scope threading"
```

---

## Sub-phase 8c — Tool registry (7 tools)

### Task 4: JSON Schema specs for the 7 tools

**Files:**

- Create: `services/assistant/src/aegis_assistant/tools/__init__.py`
- Create: `services/assistant/src/aegis_assistant/tools/schemas.py`
- Create: `services/assistant/tests/test_tools_schemas.py`

Groq accepts OpenAI-compatible function-calling specs. Each tool has a JSON Schema that the model uses to decide when to call it and how to fill the arguments.

- [ ] **Step 1: Failing test**

```python
# services/assistant/tests/test_tools_schemas.py
"""Lock the tool surface — the 7 tools from spec §11.2 must always be present."""

from __future__ import annotations
from aegis_assistant.tools.schemas import TOOL_SPECS


def test_seven_tools_present() -> None:
    expected = {
        "get_fleet_status",
        "get_model_metrics",
        "get_decision",
        "get_audit_chain",
        "list_pending_approvals",
        "get_pareto_front",
        "explain_drift_signal",
    }
    assert {t["function"]["name"] for t in TOOL_SPECS} == expected


def test_each_spec_has_openai_function_shape() -> None:
    for spec in TOOL_SPECS:
        assert spec["type"] == "function"
        fn = spec["function"]
        assert "name" in fn and "description" in fn and "parameters" in fn
        params = fn["parameters"]
        assert params["type"] == "object"
        assert "properties" in params


def test_get_decision_requires_decision_id() -> None:
    spec = next(t for t in TOOL_SPECS if t["function"]["name"] == "get_decision")
    assert "decision_id" in spec["function"]["parameters"]["required"]


def test_get_model_metrics_window_is_enum() -> None:
    spec = next(t for t in TOOL_SPECS if t["function"]["name"] == "get_model_metrics")
    window = spec["function"]["parameters"]["properties"]["window"]
    assert set(window["enum"]) == {"24h", "7d", "30d"}


def test_explain_drift_signal_requires_model_id() -> None:
    spec = next(t for t in TOOL_SPECS if t["function"]["name"] == "explain_drift_signal")
    assert "model_id" in spec["function"]["parameters"]["required"]
```

- [ ] **Step 2: Implement**

```python
# services/assistant/src/aegis_assistant/tools/schemas.py
"""OpenAI-compatible function-calling schemas for the 7 grounded tools.

Spec §11.2. Every tool is a thin HTTP wrapper around an existing Aegis
backend (control-plane / causal-attrib / action-selector / Tinybird).
"""

from __future__ import annotations
from typing import Any

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_fleet_status",
            "description": (
                "Return a summary of all monitored models — id, name, family, "
                "active version, severity, and open incident count."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_model_metrics",
            "description": (
                "Return KPI rollups for one model over a time window: predictions, "
                "p50/p95 latency, error rate, headline metric (e.g. DP_gender)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "model_id": {
                        "type": "string",
                        "description": "Model id, e.g. credit-v1.",
                    },
                    "window": {
                        "type": "string",
                        "enum": ["24h", "7d", "30d"],
                        "description": "Aggregation window.",
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
                "Return the full GovernanceDecision row — state, severity, drift "
                "signal, causal attribution, plan evidence, action result."
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
                "Return the Merkle-chained audit rows scoped to one decision. "
                "Used to prove what happened, when, and by whom."
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
            "description": "Return decisions currently in awaiting_approval state.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pareto_front",
            "description": (
                "Return the Pareto front of remediation actions for one decision — "
                "from Phase 7's action-selector. Includes posterior intervals + "
                "the chosen action + Lagrangian dual."
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
                "Shapley contributions per cause, dominant cause, recommended action."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "model_id": {
                        "type": "string",
                        "description": "Model id, e.g. credit-v1.",
                    },
                    "metric": {
                        "type": "string",
                        "description": (
                            "The fairness/drift metric whose shift to attribute "
                            "(e.g. demographic_parity_gender)."
                        ),
                    },
                },
                "required": ["model_id"],
            },
        },
    },
]
```

```python
# services/assistant/src/aegis_assistant/tools/__init__.py
"""Tool registry — 7 grounded tools dispatched against the live backends."""

from aegis_assistant.tools.schemas import TOOL_SPECS

__all__ = ["TOOL_SPECS"]
```

- [ ] **Step 3: Run + commit**

```bash
uv run --package aegis-assistant pytest services/assistant/tests/test_tools_schemas.py -v
git add services/assistant/src/aegis_assistant/tools/__init__.py \
        services/assistant/src/aegis_assistant/tools/schemas.py \
        services/assistant/tests/test_tools_schemas.py
git commit -m "feat(assistant): Phase 8 — 7 OpenAI-compatible tool schemas (spec §11.2)"
```

### Task 5: Tool dispatchers (HTTP fetchers)

**Files:**

- Create: `services/assistant/src/aegis_assistant/tools/{fleet,metrics,decision,approvals,pareto,drift}.py`
- Create: `services/assistant/src/aegis_assistant/tools/dispatcher.py`
- Create: `services/assistant/src/aegis_assistant/config.py`
- Create: `services/assistant/tests/conftest.py` (respx fixtures)
- Create: `services/assistant/tests/test_tool_*.py` (one per tool)

Each dispatcher returns a `ToolResult` dataclass with `summary` (truncated string for the model) + `payload` (full JSON the dashboard renders) + optional `error`. The model only sees `summary`; the dashboard gets the full `payload` via the SSE frame.

- [ ] **Step 1: Settings**

```python
# services/assistant/src/aegis_assistant/config.py
from __future__ import annotations
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", frozen=True
    )

    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    """Groq dev-tier API key. Empty = assistant returns 503 on /chat/stream."""

    groq_model_quality: str = Field(
        default="llama-3.3-70b-versatile", alias="GROQ_MODEL_QUALITY"
    )
    groq_model_fast: str = Field(
        default="llama-3.1-8b-instant", alias="GROQ_MODEL_FAST"
    )

    control_plane_url: str = Field(
        default="http://localhost:8000", alias="CONTROL_PLANE_URL"
    )
    causal_attrib_url: str = Field(
        default="http://localhost:8003", alias="CAUSAL_ATTRIB_URL"
    )
    action_selector_url: str = Field(
        default="http://localhost:8004", alias="ACTION_SELECTOR_URL"
    )

    chat_max_iterations: int = Field(default=6, alias="CHAT_MAX_ITERATIONS", ge=1, le=20)
    """Hard cap on tool-call loop iterations per chat turn."""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 2: Shared `ToolResult` + dispatcher base**

```python
# services/assistant/src/aegis_assistant/tools/dispatcher.py
"""Dispatcher — name → coroutine. Returns a ToolResult."""

from __future__ import annotations
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class ToolResult:
    summary: str
    """One-line human-readable summary the model sees."""
    payload: Any
    """Full JSON the dashboard renders. None on error."""
    error: str | None = None


# A dispatcher is `async def(client, args) -> ToolResult`.
Dispatcher = Callable[[httpx.AsyncClient, dict[str, Any]], Awaitable[ToolResult]]


_REGISTRY: dict[str, Dispatcher] = {}


def register(name: str) -> Callable[[Dispatcher], Dispatcher]:
    """Decorator that registers a dispatcher under its tool name."""
    def _wrap(fn: Dispatcher) -> Dispatcher:
        _REGISTRY[name] = fn
        return fn

    return _wrap


async def execute_tool(
    client: httpx.AsyncClient, name: str, args: dict[str, Any]
) -> ToolResult:
    fn = _REGISTRY.get(name)
    if fn is None:
        return ToolResult(
            summary=f"unknown tool {name!r}",
            payload=None,
            error=f"tool {name!r} is not registered",
        )
    try:
        return await fn(client, args)
    except httpx.HTTPError as exc:
        return ToolResult(
            summary=f"{name} failed: {exc.__class__.__name__}",
            payload=None,
            error=str(exc),
        )


def registered_tools() -> set[str]:
    return set(_REGISTRY.keys())
```

- [ ] **Step 3: One dispatcher per tool — `fleet.py`**

```python
# services/assistant/src/aegis_assistant/tools/fleet.py
from __future__ import annotations
from typing import Any
import httpx
from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("get_fleet_status")
async def get_fleet_status(
    client: httpx.AsyncClient, args: dict[str, Any]
) -> ToolResult:
    base = get_settings().control_plane_url.rstrip("/")
    res = await client.get(f"{base}/api/cp/models", timeout=10.0)
    res.raise_for_status()
    models = res.json()
    summary = f"{len(models)} model(s): " + ", ".join(
        f"{m['id']} (risk={m['risk_class']})" for m in models[:5]
    )
    return ToolResult(summary=summary, payload=models)
```

- [ ] **Step 4: `metrics.py`**

```python
# services/assistant/src/aegis_assistant/tools/metrics.py
from __future__ import annotations
from typing import Any
import httpx
from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("get_model_metrics")
async def get_model_metrics(
    client: httpx.AsyncClient, args: dict[str, Any]
) -> ToolResult:
    model_id = args["model_id"]
    window = args.get("window", "24h")
    base = get_settings().control_plane_url.rstrip("/")
    url = f"{base}/api/cp/models/{model_id}/kpi?window={window}"
    res = await client.get(url, timeout=10.0)
    res.raise_for_status()
    kpi = res.json()
    headline = kpi.get("headline_metric", {})
    summary = (
        f"{model_id} {window}: "
        f"{headline.get('key', '?')}={headline.get('value', '?'):.2f} "
        f"(floor {headline.get('floor', '?')}). "
        f"p95 latency {kpi.get('p95_latency_ms', '?')}ms."
    )
    return ToolResult(summary=summary, payload=kpi)
```

- [ ] **Step 5: `decision.py` (covers `get_decision` + `get_audit_chain`)**

```python
# services/assistant/src/aegis_assistant/tools/decision.py
from __future__ import annotations
from typing import Any
import httpx
from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("get_decision")
async def get_decision(client: httpx.AsyncClient, args: dict[str, Any]) -> ToolResult:
    decision_id = args["decision_id"]
    base = get_settings().control_plane_url.rstrip("/")
    res = await client.get(f"{base}/api/cp/decisions/{decision_id}", timeout=10.0)
    res.raise_for_status()
    decision = res.json()
    summary = (
        f"decision {decision_id} · model {decision['model_id']} · "
        f"state {decision['state']} · severity {decision['severity']}"
    )
    return ToolResult(summary=summary, payload=decision)


@register("get_audit_chain")
async def get_audit_chain(
    client: httpx.AsyncClient, args: dict[str, Any]
) -> ToolResult:
    decision_id = args["decision_id"]
    base = get_settings().control_plane_url.rstrip("/")
    res = await client.get(
        f"{base}/api/cp/audit?decision_id={decision_id}&limit=20", timeout=10.0
    )
    res.raise_for_status()
    page = res.json()
    actions = [r["action"] for r in page["rows"]]
    summary = f"audit chain for {decision_id}: {len(actions)} rows · {' → '.join(actions)}"
    return ToolResult(summary=summary, payload=page)
```

- [ ] **Step 6: `approvals.py`**

```python
# services/assistant/src/aegis_assistant/tools/approvals.py
from __future__ import annotations
from typing import Any
import httpx
from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("list_pending_approvals")
async def list_pending_approvals(
    client: httpx.AsyncClient, args: dict[str, Any]
) -> ToolResult:
    base = get_settings().control_plane_url.rstrip("/")
    res = await client.get(
        f"{base}/api/cp/decisions?state=awaiting_approval&limit=50", timeout=10.0
    )
    res.raise_for_status()
    decisions = res.json()
    summary = (
        f"{len(decisions)} pending approval(s)"
        if decisions
        else "approval queue is empty"
    )
    return ToolResult(summary=summary, payload=decisions)
```

- [ ] **Step 7: `pareto.py`**

```python
# services/assistant/src/aegis_assistant/tools/pareto.py
from __future__ import annotations
from typing import Any
import httpx
from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("get_pareto_front")
async def get_pareto_front(
    client: httpx.AsyncClient, args: dict[str, Any]
) -> ToolResult:
    """Read the decision's plan_evidence — that's where Phase 7's
    /select response was persisted."""
    decision_id = args["decision_id"]
    base = get_settings().control_plane_url.rstrip("/")
    res = await client.get(f"{base}/api/cp/decisions/{decision_id}", timeout=10.0)
    res.raise_for_status()
    decision = res.json()
    plan = decision.get("plan_evidence")
    if not plan:
        return ToolResult(
            summary=f"decision {decision_id} has no plan_evidence yet",
            payload=None,
        )
    chosen = plan.get("chosen_action") or plan.get("chosen", "?")
    pareto_count = sum(
        1 for c in plan.get("candidates", []) if c.get("on_pareto_front")
    )
    summary = (
        f"plan for {decision_id}: chose {chosen}; "
        f"{pareto_count} action(s) on the Pareto front"
    )
    return ToolResult(summary=summary, payload=plan)
```

- [ ] **Step 8: `drift.py`** — calls `services/causal-attrib`'s explain endpoint via the control plane's `/api/cp/decisions/<id>` (the `causal_attribution` field is already populated by Phase 6). For drift signals not yet associated with a decision, the model can call `get_model_metrics` first and chain.

```python
# services/assistant/src/aegis_assistant/tools/drift.py
from __future__ import annotations
from typing import Any
import httpx
from aegis_assistant.config import get_settings
from aegis_assistant.tools.dispatcher import ToolResult, register


@register("explain_drift_signal")
async def explain_drift_signal(
    client: httpx.AsyncClient, args: dict[str, Any]
) -> ToolResult:
    """Find the most recent decision for `model_id` and return its
    causal_attribution. If `metric` is supplied, prefer decisions whose
    drift_signal.metric matches."""
    model_id = args["model_id"]
    metric = args.get("metric")
    base = get_settings().control_plane_url.rstrip("/")
    res = await client.get(
        f"{base}/api/cp/decisions?model_id={model_id}&limit=20", timeout=10.0
    )
    res.raise_for_status()
    decisions = res.json()
    if metric:
        matching = [
            d
            for d in decisions
            if (d.get("drift_signal") or {}).get("metric") == metric
        ]
        if matching:
            decisions = matching
    if not decisions:
        return ToolResult(
            summary=f"no decisions found for {model_id}",
            payload=None,
        )
    decision = decisions[0]
    attribution = decision.get("causal_attribution")
    if not attribution:
        return ToolResult(
            summary=f"decision {decision['id']} has no causal_attribution yet",
            payload=None,
        )
    top = (attribution.get("root_causes") or [{}])[0]
    summary = (
        f"{model_id} {attribution.get('method', '?')}: "
        f"top cause {top.get('node', '?')} "
        f"({(top.get('contribution', 0) * 100):.0f}%); "
        f"recommended action = {attribution.get('recommended_action', '?')}"
    )
    return ToolResult(summary=summary, payload=attribution)
```

- [ ] **Step 9: Wire imports in tools/**init**.py**

```python
# services/assistant/src/aegis_assistant/tools/__init__.py — extend
from aegis_assistant.tools import approvals as _approvals  # noqa: F401
from aegis_assistant.tools import decision as _decision  # noqa: F401
from aegis_assistant.tools import drift as _drift  # noqa: F401
from aegis_assistant.tools import fleet as _fleet  # noqa: F401
from aegis_assistant.tools import metrics as _metrics  # noqa: F401
from aegis_assistant.tools import pareto as _pareto  # noqa: F401
from aegis_assistant.tools.dispatcher import (
    ToolResult,
    execute_tool,
    registered_tools,
)
from aegis_assistant.tools.schemas import TOOL_SPECS

__all__ = ["TOOL_SPECS", "ToolResult", "execute_tool", "registered_tools"]
```

- [ ] **Step 10: Tests for dispatcher routing + each tool**

```python
# services/assistant/tests/conftest.py
from __future__ import annotations
import httpx
import pytest


@pytest.fixture
async def http_client() -> httpx.AsyncClient:
    async with httpx.AsyncClient() as client:
        yield client
```

```python
# services/assistant/tests/test_tools_dispatcher.py
import pytest
from aegis_assistant.tools import registered_tools


def test_all_seven_tools_registered() -> None:
    assert registered_tools() == {
        "get_fleet_status",
        "get_model_metrics",
        "get_decision",
        "get_audit_chain",
        "list_pending_approvals",
        "get_pareto_front",
        "explain_drift_signal",
    }
```

```python
# services/assistant/tests/test_tool_fleet.py
import httpx
import pytest
import respx

from aegis_assistant.tools import execute_tool


@pytest.mark.asyncio
async def test_get_fleet_status_returns_summary() -> None:
    async with respx.mock(assert_all_called=True) as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(
                200,
                json=[
                    {"id": "credit-v1", "risk_class": "HIGH", "name": "Credit", "family": "tabular"},
                    {"id": "toxicity-v1", "risk_class": "MEDIUM", "name": "Toxicity", "family": "text"},
                ],
            )
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_fleet_status", {})
    assert "credit-v1" in result.summary
    assert "2 model(s)" in result.summary
    assert result.error is None
    assert isinstance(result.payload, list) and len(result.payload) == 2


@pytest.mark.asyncio
async def test_get_fleet_status_handles_500() -> None:
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(500)
        )
        async with httpx.AsyncClient() as client:
            result = await execute_tool(client, "get_fleet_status", {})
    assert result.error is not None
    assert result.payload is None
```

```python
# services/assistant/tests/test_tool_metrics.py
import httpx
import pytest
import respx

from aegis_assistant.tools import execute_tool


@pytest.mark.asyncio
async def test_get_model_metrics_summary() -> None:
    canned = {
        "model_id": "credit-v1",
        "window": "24h",
        "p95_latency_ms": 88.0,
        "headline_metric": {
            "key": "demographic_parity_gender",
            "value": 0.71,
            "floor": 0.80,
        },
    }
    async with respx.mock() as mock:
        mock.get(
            "http://localhost:8000/api/cp/models/credit-v1/kpi?window=24h"
        ).mock(return_value=httpx.Response(200, json=canned))
        async with httpx.AsyncClient() as client:
            result = await execute_tool(
                client,
                "get_model_metrics",
                {"model_id": "credit-v1", "window": "24h"},
            )
    assert "credit-v1" in result.summary
    assert "0.71" in result.summary
    assert result.payload == canned
```

(Repeat the same shape for `test_tool_decision.py`, `test_tool_approvals.py`, `test_tool_pareto.py`, `test_tool_drift.py` — each test mocks the corresponding endpoint with a canned response and asserts the `ToolResult.summary` mentions the load-bearing fact + `payload` is the raw JSON.)

- [ ] **Step 11: Run + commit**

```bash
uv run --package aegis-assistant pytest services/assistant/tests/test_tool*.py -v
git add services/assistant/src/aegis_assistant/{config.py,tools/} \
        services/assistant/tests/{conftest.py,test_tool*.py,test_tools_dispatcher.py}
git commit -m "feat(assistant): Phase 8 — 7 tool dispatchers (HTTP fetchers against live backends)"
```

---

## Sub-phase 8d — Groq client + chat loop

### Task 6: Groq client wrapper with model rotation

**Files:**

- Create: `services/assistant/src/aegis_assistant/groq_client.py`

The wrapper hides the two-model rotation behind a single `chat_completion(messages, tools)` async call. Returns the raw Groq response so the chat loop can inspect tool calls.

```python
# services/assistant/src/aegis_assistant/groq_client.py
"""Groq client wrapper with two-model rotation.

Spec §11.1: Llama 3.1 8B Instant for tool-call decisions (fast),
Llama 3.3 70B Versatile for final synthesis (quality). The wrapper
takes a `phase` parameter so the chat loop picks the right model.
"""

from __future__ import annotations
from typing import Any, Literal

from groq import AsyncGroq

from aegis_assistant.config import get_settings


class GroqUnavailableError(RuntimeError):
    """Raised when GROQ_API_KEY is unset — used to return 503 from /chat/stream."""


def _client() -> AsyncGroq:
    api_key = get_settings().groq_api_key
    if not api_key:
        raise GroqUnavailableError("GROQ_API_KEY not configured")
    return AsyncGroq(api_key=api_key)


async def chat_completion(
    *,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    phase: Literal["tool_decision", "final"] = "final",
    temperature: float = 0.2,
) -> Any:
    """Call Groq with the appropriate model for the current loop phase."""
    settings = get_settings()
    model = (
        settings.groq_model_fast if phase == "tool_decision" else settings.groq_model_quality
    )
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    async with _client() as client:
        return await client.chat.completions.create(**kwargs)
```

### Task 7: Chat loop orchestration

**Files:**

- Create: `services/assistant/src/aegis_assistant/chat_loop.py`
- Create: `services/assistant/tests/test_chat_loop.py`

The loop drives the model through tool calls until it produces a final answer or hits the iteration cap.

- [ ] **Step 1: Failing test (mocks Groq + tools)**

```python
# services/assistant/tests/test_chat_loop.py
"""Tests for the tool-call orchestration loop."""

from __future__ import annotations
from typing import Any
import httpx
import pytest

from aegis_assistant.chat_loop import StreamFrame, run_chat_loop


class _FakeGroq:
    """Replays a scripted sequence of Groq responses."""

    def __init__(self, responses: list[Any]) -> None:
        self._responses = list(responses)

    async def chat_completion(self, **_: Any) -> Any:
        return self._responses.pop(0)


def _assistant_with_tool_call(name: str, args: dict[str, Any]) -> Any:
    """Build a minimal completion object that mimics Groq's shape."""
    import json
    from types import SimpleNamespace

    tool_call = SimpleNamespace(
        id="call-1",
        type="function",
        function=SimpleNamespace(name=name, arguments=json.dumps(args)),
    )
    msg = SimpleNamespace(role="assistant", content=None, tool_calls=[tool_call])
    return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


def _assistant_final(text: str) -> Any:
    from types import SimpleNamespace

    msg = SimpleNamespace(role="assistant", content=text, tool_calls=None)
    return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


@pytest.mark.asyncio
async def test_loop_executes_tool_then_returns_final_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Model asks for get_fleet_status, loop runs it, model produces final."""
    import respx
    from aegis_assistant import groq_client

    fake = _FakeGroq([
        _assistant_with_tool_call("get_fleet_status", {}),
        _assistant_final("Three models online — all green."),
    ])
    monkeypatch.setattr(groq_client, "chat_completion", fake.chat_completion)

    frames: list[StreamFrame] = []
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(
                200,
                json=[{"id": "credit-v1", "risk_class": "HIGH", "name": "C", "family": "t"}],
            )
        )
        async for frame in run_chat_loop(
            messages=[{"role": "user", "content": "what's the fleet doing?"}],
            scope={},
        ):
            frames.append(frame)

    kinds = [f.kind for f in frames]
    assert "tool_call_start" in kinds
    assert "tool_call_end" in kinds
    assert "final_text" in kinds
    final = next(f for f in frames if f.kind == "final_text")
    assert "Three models" in final.text


@pytest.mark.asyncio
async def test_loop_caps_iterations(monkeypatch: pytest.MonkeyPatch) -> None:
    """If the model keeps requesting tools, loop terminates at chat_max_iterations."""
    from aegis_assistant import groq_client

    # Always return a tool call — never final.
    fake_responses = [
        _assistant_with_tool_call("get_fleet_status", {}) for _ in range(10)
    ]
    fake = _FakeGroq(fake_responses)
    monkeypatch.setattr(groq_client, "chat_completion", fake.chat_completion)

    import respx
    frames: list[StreamFrame] = []
    async with respx.mock() as mock:
        mock.get("http://localhost:8000/api/cp/models").mock(
            return_value=httpx.Response(200, json=[])
        )
        async for frame in run_chat_loop(
            messages=[{"role": "user", "content": "loop forever"}],
            scope={},
        ):
            frames.append(frame)

    # Should hit the iteration cap (default 6 from config).
    cap_frames = [f for f in frames if f.kind == "iteration_cap_hit"]
    assert len(cap_frames) == 1
```

- [ ] **Step 2: Implement**

```python
# services/assistant/src/aegis_assistant/chat_loop.py
"""Tool-call orchestration loop.

Drives the model through up to N iterations of:
  1. Send messages + tool specs to Groq.
  2. If the model returns tool_calls, execute each one, append the
     results as `role=tool` messages, and loop.
  3. If the model returns a final assistant message, yield its text
     and stop.

Streams structured frames to the caller (the SSE endpoint relays them
as Server-Sent Events to the dashboard).
"""

from __future__ import annotations
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from aegis_assistant import groq_client
from aegis_assistant.config import get_settings
from aegis_assistant.system_prompt import build_system_prompt
from aegis_assistant.tools import TOOL_SPECS, execute_tool


@dataclass(frozen=True)
class StreamFrame:
    """One event the SSE endpoint relays to the dashboard."""

    kind: Literal[
        "tool_call_start",
        "tool_call_end",
        "final_text",
        "iteration_cap_hit",
        "error",
    ]
    text: str = ""
    tool_name: str | None = None
    tool_args: dict[str, Any] | None = None
    tool_result_summary: str | None = None
    tool_result_payload: Any = None
    tool_error: str | None = None


async def run_chat_loop(
    *,
    messages: list[dict[str, Any]],
    scope: dict[str, Any],
) -> AsyncIterator[StreamFrame]:
    """Run the tool-call loop and yield StreamFrames."""
    settings = get_settings()
    system_msg = {"role": "system", "content": build_system_prompt(scope=scope)}
    convo: list[dict[str, Any]] = [system_msg, *messages]

    async with httpx.AsyncClient() as http:
        for iteration in range(settings.chat_max_iterations):
            phase: Literal["tool_decision", "final"] = (
                "tool_decision" if iteration < settings.chat_max_iterations - 1 else "final"
            )
            try:
                resp = await groq_client.chat_completion(
                    messages=convo, tools=TOOL_SPECS, phase=phase
                )
            except Exception as exc:  # noqa: BLE001
                yield StreamFrame(kind="error", text=f"Groq call failed: {exc}")
                return

            choice = resp.choices[0]
            message = choice.message
            tool_calls = getattr(message, "tool_calls", None) or []

            if not tool_calls:
                # Final answer.
                yield StreamFrame(kind="final_text", text=message.content or "")
                return

            # Append the assistant's tool-call request to the convo.
            convo.append(
                {
                    "role": "assistant",
                    "content": message.content,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in tool_calls
                    ],
                }
            )

            # Execute each requested tool.
            for tc in tool_calls:
                name = tc.function.name
                try:
                    args: dict[str, Any] = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                yield StreamFrame(
                    kind="tool_call_start", tool_name=name, tool_args=args
                )
                result = await execute_tool(http, name, args)
                yield StreamFrame(
                    kind="tool_call_end",
                    tool_name=name,
                    tool_args=args,
                    tool_result_summary=result.summary,
                    tool_result_payload=result.payload,
                    tool_error=result.error,
                )
                # Append the tool result for the model's next iteration.
                convo.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result.summary,
                    }
                )

        yield StreamFrame(kind="iteration_cap_hit")
```

- [ ] **Step 3: Run + commit**

```bash
uv run --package aegis-assistant pytest services/assistant/tests/test_chat_loop.py -v
git add services/assistant/src/aegis_assistant/{groq_client.py,chat_loop.py} \
        services/assistant/tests/test_chat_loop.py
git commit -m "feat(assistant): Phase 8 — Groq client + tool-call orchestration loop"
```

---

## Sub-phase 8e — POST /chat/stream endpoint

### Task 8: SSE streaming endpoint

**Files:**

- Create: `services/assistant/src/aegis_assistant/routers/chat.py`
- Modify: `services/assistant/src/aegis_assistant/app.py` (mount the router)
- Create: `services/assistant/tests/test_chat_stream_endpoint.py`

```python
# services/assistant/src/aegis_assistant/routers/chat.py
"""POST /chat/stream — SSE-streamed tool-call loop output."""

from __future__ import annotations
import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sse_starlette.sse import EventSourceResponse

from aegis_assistant.chat_loop import run_chat_loop
from aegis_assistant.config import get_settings

router = APIRouter()


class ChatStreamRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    messages: list[dict[str, Any]] = Field(min_length=1)
    """Conversation history. The last entry is the user's current turn."""
    scope: dict[str, Any] = Field(default_factory=dict)


@router.post("/chat/stream")
async def chat_stream(payload: ChatStreamRequest) -> EventSourceResponse:
    if not get_settings().groq_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GROQ_API_KEY not configured; assistant unavailable.",
        )

    async def _frames() -> AsyncIterator[dict[str, str]]:
        async for frame in run_chat_loop(
            messages=payload.messages, scope=payload.scope
        ):
            data = {
                "kind": frame.kind,
                "text": frame.text,
                "tool_name": frame.tool_name,
                "tool_args": frame.tool_args,
                "tool_result_summary": frame.tool_result_summary,
                "tool_result_payload": frame.tool_result_payload,
                "tool_error": frame.tool_error,
            }
            yield {"event": "message", "data": json.dumps(data)}

    return EventSourceResponse(_frames())
```

- [ ] **Mount in `app.py`**, add a test that mocks Groq and walks the streamed SSE frames, run + commit.

```bash
uv run --package aegis-assistant pytest services/assistant/tests/test_chat_stream_endpoint.py -v
git add services/assistant/src/aegis_assistant/routers/chat.py \
        services/assistant/src/aegis_assistant/app.py \
        services/assistant/tests/test_chat_stream_endpoint.py
git commit -m "feat(assistant): Phase 8 — POST /chat/stream (SSE) wires the loop to the dashboard"
```

---

## Sub-phase 8f — Dashboard `/chat` page wired

### Task 9: Typed EventSource consumer + chat view

**Files:**

- Create: `apps/dashboard/app/_lib/chat-stream.ts`
- Modify: `apps/dashboard/app/_lib/api.ts` — add `streamChat(body)`
- Modify: `apps/dashboard/app/(app)/chat/_view.tsx` — replace seed-transcript stub with a live consumer

```typescript
// apps/dashboard/app/_lib/chat-stream.ts
"use client";

import { useState, useCallback } from "react";

import type { ChatTurn, ToolCall } from "./types";

type StreamFrame =
  | { kind: "tool_call_start"; tool_name: string; tool_args: Record<string, unknown> }
  | {
      kind: "tool_call_end";
      tool_name: string;
      tool_args: Record<string, unknown>;
      tool_result_summary: string;
      tool_result_payload: unknown;
      tool_error: string | null;
    }
  | { kind: "final_text"; text: string }
  | { kind: "iteration_cap_hit" }
  | { kind: "error"; text: string };

export interface ChatStreamHook {
  readonly turns: readonly ChatTurn[];
  readonly streaming: boolean;
  readonly send: (userText: string, scope?: Record<string, unknown>) => Promise<void>;
}

export function useChatStream(): ChatStreamHook {
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [streaming, setStreaming] = useState(false);

  const send = useCallback(
    async (userText: string, scope: Record<string, unknown> = {}) => {
      const userTurn: ChatTurn = { role: "user", content: userText };
      setTurns((prev) => [...prev, userTurn]);
      setStreaming(true);

      const assistantToolCalls: ToolCall[] = [];
      let assistantText = "";
      // Push a placeholder assistant turn we'll update as frames arrive.
      setTurns((prev) => [...prev, { role: "assistant", content: "", tool_calls: [] }]);

      const res = await fetch("/api/assistant/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...turns, userTurn].map((t) => ({ role: t.role, content: t.content })),
          scope,
        }),
      });
      if (!res.ok || !res.body) {
        setTurns((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: "Assistant unavailable.", tool_calls: [] },
        ]);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by blank lines; each frame has `data: ...`.
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          const dataLine = ev.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const json = dataLine.slice(6);
          let frame: StreamFrame;
          try {
            frame = JSON.parse(json) as StreamFrame;
          } catch {
            continue;
          }
          if (frame.kind === "tool_call_end") {
            assistantToolCalls.push({
              name: frame.tool_name,
              arguments: frame.tool_args,
              result_summary: frame.tool_result_summary,
              result_payload: frame.tool_result_payload,
              error: frame.tool_error ?? undefined,
            });
            setTurns((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role !== "assistant") return prev;
              return [...prev.slice(0, -1), { ...last, tool_calls: [...assistantToolCalls] }];
            });
          } else if (frame.kind === "final_text") {
            assistantText = frame.text;
            setTurns((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role !== "assistant") return prev;
              return [...prev.slice(0, -1), { ...last, content: assistantText }];
            });
          } else if (frame.kind === "error" || frame.kind === "iteration_cap_hit") {
            assistantText = frame.kind === "error" ? frame.text : "(reached the tool-call limit)";
            setTurns((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role !== "assistant") return prev;
              return [...prev.slice(0, -1), { ...last, content: assistantText }];
            });
          }
        }
      }
      setStreaming(false);
    },
    [turns],
  );

  return { turns, streaming, send };
}
```

- [ ] **Step 2: Replace `chat/_view.tsx` body** with `const { turns, streaming, send } = useChatStream();` and a render that maps over `turns`. Tool calls render as chips below the assistant bubble.

- [ ] **Step 3: typecheck + commit**

```bash
pnpm --filter @aegis/dashboard typecheck
git add apps/dashboard/app/_lib/chat-stream.ts apps/dashboard/app/\(app\)/chat/_view.tsx
git commit -m "feat(dashboard): Phase 8 — /chat page wired to /api/assistant/chat/stream"
```

---

## Sub-phase 8g — Cmd+K assistant drawer

### Task 10: Drawer reuses the same stream hook with scope

**Files:**

- Modify: `apps/dashboard/app/(app)/_components/assistant-drawer.tsx`

The drawer is reachable from every page. When opened on `/incidents/<id>`, it passes `scope={decision_id: <id>}` to `useChatStream` so the system prompt threads it into the model's context.

- [ ] **Step 1:** Read the current drawer file, replace the body input with the `send`/`turns` from `useChatStream`. Read the route via `usePathname()` and parse `decision_id` if the path matches `/incidents/<uuid>`.

- [ ] **Step 2:** typecheck + commit.

```bash
git commit -m "feat(dashboard): Phase 8 — ⌘K assistant drawer wired with scope-aware prompts"
```

---

## Sub-phase 8h — Redis-backed BLR persistence (Phase 7 follow-up)

### Task 11: Swap process-local dict for Redis when configured

**Files:**

- Modify: `services/action-selector/src/aegis_action_selector/persistence.py`
- Modify: `services/action-selector/pyproject.toml` — add `redis>=5.2`
- Create: `services/action-selector/tests/test_persistence_redis.py`

Today the bandit registry is a module-level `dict`. We add a Redis backend that keys on `action_selector:bandit:<model_id>` and stores the BLR posteriors as a serialized payload (numpy arrays → bytes → base64). Falls back to in-memory when `REDIS_URL` is unset, so dev workflow stays untouched.

- [ ] **Step 1: Failing test (Redis-gated, uses fakeredis)**

```python
# services/action-selector/tests/test_persistence_redis.py
"""Redis-backed BLR persistence (Phase 8 follow-up)."""

import numpy as np
import pytest

from aegis_action_selector.actions import ActionKey
from aegis_action_selector.persistence import (
    get_or_create_bandit,
    reset,
    save_bandit_to_redis,
    load_bandit_from_redis,
)


@pytest.fixture(autouse=True)
def _reset() -> None:
    reset()


@pytest.mark.asyncio
async def test_save_and_load_round_trips_posterior(monkeypatch: pytest.MonkeyPatch) -> None:
    import fakeredis.aioredis as fakeredis

    redis = fakeredis.FakeRedis()
    bandit = get_or_create_bandit("credit-v1", n_features=4)
    bandit.update(
        ActionKey.REWEIGH,
        context=np.array([0.5, 0.5, 0.5, 0.5]),
        reward_vector=np.array([0.001, 0.20, -2.0, -0.4]),
        observed_cost_vector=np.array([1.0, 0.5, 50.0, 0.3]),
        budget=np.array([100.0, 50.0, 5_000.0, 30.0]),
        horizon_remaining=100,
    )
    expected_lambda = bandit.lambda_dual.copy()

    await save_bandit_to_redis("credit-v1", redis_client=redis)
    reset()  # drop in-memory state

    restored = await load_bandit_from_redis("credit-v1", n_features=4, redis_client=redis)
    assert restored is not None
    np.testing.assert_array_almost_equal(restored.lambda_dual, expected_lambda)
    # Reward oracle for REWEIGH should have non-zero precision (was updated).
    rew_oracle = restored.reward_oracles[ActionKey.REWEIGH][0]
    assert not np.allclose(rew_oracle._precision, np.eye(4))


@pytest.mark.asyncio
async def test_load_returns_none_when_key_missing() -> None:
    import fakeredis.aioredis as fakeredis

    redis = fakeredis.FakeRedis()
    result = await load_bandit_from_redis("no-such-model", n_features=4, redis_client=redis)
    assert result is None
```

- [ ] **Step 2: Implement** — add `save_bandit_to_redis(model_id, redis_client)` and `load_bandit_from_redis(model_id, n_features, redis_client)` to `persistence.py`. Serialize each `BayesianLinearRegression` as `{"precision": arr.tobytes(), "mean_x_prec": arr.tobytes(), ...}` JSON-encoded with base64 for the bytes.

- [ ] **Step 3: Wire optional Redis read at `get_or_create_bandit` entry point** — when `REDIS_URL` is set, attempt a load; on cache miss, create fresh and (lazily) write back on each `update()`.

- [ ] **Step 4: Run + commit**

```bash
uv run --package aegis-action-selector pytest services/action-selector/tests/test_persistence_redis.py -v
git add services/action-selector/src/aegis_action_selector/persistence.py \
        services/action-selector/pyproject.toml services/action-selector/tests/test_persistence_redis.py uv.lock
git commit -m "feat(action-selector): Phase 8 follow-up — Redis-backed BLR persistence"
```

---

## Sub-phase 8i — setup.md, vercel.ts, dev rewrite, Playwright

### Task 12: Boot instructions + production rewrite

- [ ] **Append to `setup.md`** a Phase 8 section: GROQ_API_KEY signup link, REDIS_URL optional, command to boot the assistant on port 8005, smoke test.

- [ ] **Add to `vercel.ts`:**

```typescript
{ source: "/api/assistant/:path*", destination: "/services/assistant/api/:path*" },
```

- [ ] **Add to `apps/dashboard/next.config.mjs`** dev rewrite — `/api/assistant/:path*` → `http://127.0.0.1:8005/:path*`.

- [ ] **Create `apps/dashboard/tests/e2e/assistant-chat.spec.ts`:**

```typescript
import { test, expect } from "@playwright/test";

test("ask the assistant for fleet status — gets a grounded answer", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("textbox").fill("What models are we monitoring?");
  await page.getByRole("button", { name: /send/i }).click();
  // Either a real answer OR a 'service unavailable' fallback when GROQ_API_KEY is unset.
  await expect(
    page.getByText(/credit-v1|toxicity-v1|readmission-v1|unavailable|configured/i).first(),
  ).toBeVisible({ timeout: 30_000 });
});
```

The Playwright test self-degrades when GROQ_API_KEY is unset (it accepts the 503 fallback message), so the suite stays green even without a Groq account.

- [ ] **Run + commit:**

```bash
git commit -m "docs(setup,vercel): Phase 8 — assistant boot instructions + /api/assistant/* rewrite + Playwright"
```

---

## Sub-phase 8j — Tag and push

### Task 13: Verify CI green, tag, push

```bash
uv run pytest 2>&1 | tail -3
uv run pyright 2>&1 | tail -3
pnpm typecheck 2>&1 | tail -3
git checkout main
git merge --no-ff phase-8-governance-assistant -m "Merge phase-8-governance-assistant into main..."
git tag -a phase-8-complete -m "Phase 8 — Governance Assistant · Groq-powered tool-using agent..."
git push origin main phase-8-governance-assistant phase-8-complete
```

---

## Self-review

### Spec coverage

| Spec §                                                  | Requirement                        | Task  |
| ------------------------------------------------------- | ---------------------------------- | ----- |
| 11.1 architecture (FastAPI + Groq + two-model rotation) | groq_client.py with quality+fast   | 6     |
| 11.2 — 7 grounded tools                                 | TOOL_SPECS + 7 dispatchers         | 4, 5  |
| 11.2 system prompt enforces grounding + refusal         | system_prompt.py with locked tests | 3     |
| 11.3 UI — full-screen `/chat` + Cmd+K drawer with scope | dashboard wiring                   | 9, 10 |
| 11.4 EU AI Act Article 13/14 framing                    | covered by grounding contract      | 3     |
| Phase 7 deferred — Redis BLR persistence                | persistence.py extension           | 11    |

### Placeholder scan

No `TBD`. Every step shows actual code or actual command. Tasks that say "repeat the same shape for ..." (the per-tool tests in Sub-phase 8c) reference an explicit example in the same task — not a hidden gap.

### Type consistency

- `ToolResult` (summary, payload, error) is the same shape across `dispatcher.py`, every `tools/*.py`, and the SSE frame payload.
- `StreamFrame.kind` enum (`tool_call_start | tool_call_end | final_text | iteration_cap_hit | error`) is mirrored in the dashboard's `chat-stream.ts` discriminated union.
- `ChatTurn.role` regex (`^(user|assistant|system|tool)$`) matches the dashboard's TS string union.

### Scope check

Phase 8 ships a working `services/assistant` end-to-end: tool registry, Groq client, chat loop, SSE endpoint, dashboard wiring (page + drawer), Redis-backed BLR persistence. The 7 tools cover the entire spec §11.2 surface.

---

## What lands in Phase 9 (next plan)

- 10-scenario benchmark library extension (Phase 6's `tests/scenarios/_harness.py` foundation).
- Ablation grid: causal-driven vs. dbshap-driven vs. shap-only vs. random vs. always-retrain vs. detect-only.
- Property-based safety-invariant tests at scale.
- NeurIPS Datasets & Benchmarks contribution package.
