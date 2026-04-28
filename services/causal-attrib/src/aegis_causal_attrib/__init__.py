"""Aegis causal-attribution worker — DoWhy GCM + DBShap fallback.

Spec §12.1 (research extension 1). The service receives a drift signal
plus reference / current frames, runs Shapley decomposition over the
model's causal DAG, and returns a `CausalAttribution` payload that
identifies the dominant mechanism and recommends a remediation action.
"""

__version__ = "0.1.0"
