"""Text drift + fairness detection worker.

MMD (Maximum Mean Discrepancy) on sentence-transformer embeddings detects
distribution shifts in text comments. Subgroup-AUC / BPSN / BNSP for
fairness use the Borkan 2019 metrics already wired in
`aegis_pipelines.eval` (Phase 1c). The worker forwards severity ≥ MEDIUM
signals to the control plane for decision-opening.
"""

__version__ = "0.1.0"
