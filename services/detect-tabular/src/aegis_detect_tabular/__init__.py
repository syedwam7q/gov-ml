"""Tabular drift + fairness + calibration detection worker.

Runs Evidently for distribution drift, fairlearn for subgroup fairness,
and NannyML CBPE for label-free performance estimation. Each detector
emits one or more `DriftSignal` objects; the worker forwards severity
≥ MEDIUM signals to the control plane for decision-opening.
"""

__version__ = "0.1.0"
