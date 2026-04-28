"""Aegis Governance Assistant — Groq-powered tool-using agent.

Spec §11. Every claim the assistant makes must reference a tool-call
result against the live MAPE-K knowledge plane. The system prompt
enforces this and refuses to answer otherwise.

Two models in rotation:
  * llama-3.1-8b-instant       — tool-call decision (cheap, fast)
  * llama-3.3-70b-versatile    — final synthesis (quality)
"""

__version__ = "0.1.0"
