"""Tool registry — 7 grounded tools dispatched against live Aegis backends.

Spec §11.2. The full registry (per-tool dispatchers) is wired in
Task 5; for now only the OpenAI-compatible JSON Schemas are exposed.
"""

from aegis_assistant.tools.schemas import TOOL_SPECS

__all__ = ["TOOL_SPECS"]
