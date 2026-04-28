"""Per-node additive-noise structural causal model.

For each node V_i with parents PA(V_i):
  • If PA(V_i) is empty, fit a marginal distribution (categorical for
    integer-coded values, Gaussian otherwise).
  • Otherwise, fit a Ridge regression `V_i = f(PA(V_i)) + ε` and store
    the residual std for noise sampling.

Sampling traverses the DAG in topological order and draws each node
from its mechanism conditioned on its parents.

Used by the DBShap fallback (`dbshap.py`) and as a sanity check on the
DoWhy GCM auto-mechanism assignment in the test suite.
"""

from __future__ import annotations

from dataclasses import dataclass

import networkx as nx
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from aegis_causal_attrib.dag_loader import DAGSpec


def _is_integer_coded(series: pd.Series) -> bool:
    if series.dtype.kind in {"i", "u"}:
        return True
    if series.dtype.kind == "f":
        non_null = series.dropna()
        if len(non_null) == 0:
            return False
        return bool(np.all(non_null == non_null.astype(int)))
    return False


@dataclass(frozen=True)
class NodeMechanism:
    """One node's structural mechanism."""

    node: str
    parents: tuple[str, ...]
    is_categorical: bool
    marginal_values: np.ndarray | None
    marginal_probs: np.ndarray | None
    marginal_mu: float
    marginal_sigma: float
    coef: np.ndarray | None
    intercept: float
    residual_std: float


@dataclass(frozen=True)
class FittedFCM:
    """A fitted FCM ready for sampling."""

    spec: DAGSpec
    mechanisms: dict[str, NodeMechanism]
    column_means: dict[str, float]

    def sample(self, *, n: int, rng: np.random.Generator) -> pd.DataFrame:
        """Generate `n` synthetic rows from the joint."""
        order = list(nx.topological_sort(self.spec.to_networkx()))
        out: dict[str, np.ndarray] = {}
        for node in order:
            mech = self.mechanisms[node]
            if not mech.parents:
                if mech.is_categorical and mech.marginal_values is not None:
                    out[node] = rng.choice(mech.marginal_values, size=n, p=mech.marginal_probs)
                else:
                    out[node] = rng.normal(mech.marginal_mu, mech.marginal_sigma, size=n)
            else:
                stacked = np.column_stack([out[p] for p in mech.parents]).astype(float)
                assert mech.coef is not None
                pred = stacked @ mech.coef + mech.intercept
                noise = rng.normal(0.0, mech.residual_std, size=n)
                out[node] = pred + noise
        return pd.DataFrame({node: out[node] for node in self.spec.nodes})


def fit_fcm(spec: DAGSpec, frame: pd.DataFrame) -> FittedFCM:
    """Fit an additive-noise FCM on `frame` for the DAG in `spec`."""
    missing = [n for n in spec.nodes if n not in frame.columns]
    if missing:
        raise ValueError(f"frame missing required DAG nodes: {missing}")

    mechs: dict[str, NodeMechanism] = {}
    for node in spec.nodes:
        parents = spec.parents(node)
        series = frame[node].astype(float)
        if not parents:
            if _is_integer_coded(frame[node]):
                vals, counts = np.unique(frame[node].dropna().to_numpy(), return_counts=True)
                probs = counts / counts.sum()
                mechs[node] = NodeMechanism(
                    node=node,
                    parents=(),
                    is_categorical=True,
                    marginal_values=vals,
                    marginal_probs=probs,
                    marginal_mu=float(series.mean()),
                    marginal_sigma=float(series.std(ddof=1) or 1.0),
                    coef=None,
                    intercept=float(series.mean()),
                    residual_std=float(series.std(ddof=1) or 1.0),
                )
            else:
                mechs[node] = NodeMechanism(
                    node=node,
                    parents=(),
                    is_categorical=False,
                    marginal_values=None,
                    marginal_probs=None,
                    marginal_mu=float(series.mean()),
                    marginal_sigma=float(series.std(ddof=1) or 1.0),
                    coef=None,
                    intercept=float(series.mean()),
                    residual_std=float(series.std(ddof=1) or 1.0),
                )
        else:
            stacked = frame[list(parents)].to_numpy().astype(float)
            y = series.to_numpy().astype(float)
            model = Ridge(alpha=1.0)
            model.fit(stacked, y)
            preds = model.predict(stacked)
            residuals = y - preds
            mechs[node] = NodeMechanism(
                node=node,
                parents=parents,
                is_categorical=False,
                marginal_values=None,
                marginal_probs=None,
                marginal_mu=0.0,
                marginal_sigma=0.0,
                coef=np.asarray(model.coef_).copy(),
                intercept=float(model.intercept_),
                residual_std=float(residuals.std(ddof=1) or 1.0),
            )
    column_means = {n: float(frame[n].mean()) for n in spec.nodes}
    return FittedFCM(spec=spec, mechanisms=mechs, column_means=column_means)
