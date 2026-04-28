"""Aegis action-selector — Pareto-optimal action selection.

Spec §12.2 (research extension 2). The service receives a context
vector + constraints + available actions and returns the chosen
remediation action plus the Pareto front, posterior intervals,
exploration bonus, and current Lagrangian dual `λ`.

Algorithm: Contextual Bandits with Knapsacks (Slivkins, Sankararaman
& Foster, JMLR 2024) with conjugate-Gaussian Bayesian linear
regression oracles per (action, reward dim).
"""

__version__ = "0.1.0"
