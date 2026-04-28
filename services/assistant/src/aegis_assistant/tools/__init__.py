"""Tool registry — 7 grounded tools dispatched against live Aegis backends.

Spec §11.2. Importing the per-tool modules at package init triggers
the `@register(...)` decorators that populate the dispatcher registry —
`execute_tool(name, args)` then just looks the name up.
"""

# Per-tool modules are imported for their @register() side-effects.
# pyright: reportUnusedImport=false
from aegis_assistant.tools import (
    approvals,  # noqa: F401
    decision,  # noqa: F401
    drift,  # noqa: F401
    fleet,  # noqa: F401
    metrics,  # noqa: F401
    pareto,  # noqa: F401
)
from aegis_assistant.tools.dispatcher import (
    ToolResult,
    execute_tool,
    registered_tools,
)
from aegis_assistant.tools.schemas import TOOL_SPECS

__all__ = ["TOOL_SPECS", "ToolResult", "execute_tool", "registered_tools"]
