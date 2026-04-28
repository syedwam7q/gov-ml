"""Load + validate per-model causal DAGs.

Each model has a `causal_dag.json` file in `ml-pipelines/<family>/` with
nodes, directed edges, and cause-kind annotations. The loader returns a
validated `DAGSpec` that the FCM fitter and the attribution router consume.

Spec §12.1 — the four cause kinds (`proxy_attribute`, `upstream_covariate`,
`conditional_mechanism`, `calibration_mechanism`) are the keys of the
cause→action mapping that's the novel paper contribution.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any

import networkx as nx


class CauseKind(StrEnum):
    """The four mechanism kinds spec §12.1's cause→action table maps over."""

    PROXY_ATTRIBUTE = "proxy_attribute"
    UPSTREAM_COVARIATE = "upstream_covariate"
    CONDITIONAL_MECHANISM = "conditional_mechanism"
    CALIBRATION_MECHANISM = "calibration_mechanism"


class DAGValidationError(ValueError):
    """Raised when a causal DAG fails validation."""


# model_id → pipeline directory name. The DAG file lives at
# `ml-pipelines/<pipeline>/causal_dag.json`.
_MODEL_TO_PIPELINE: dict[str, str] = {
    "credit-v1": "credit",
    "toxicity-v1": "toxicity",
    "readmission-v1": "readmission",
}


@dataclass(frozen=True)
class DAGSpec:
    """Validated causal DAG."""

    name: str
    nodes: tuple[str, ...]
    edges: tuple[tuple[str, str], ...]
    cause_kinds: dict[str, CauseKind]
    notes: str | None

    def is_acyclic(self) -> bool:
        return nx.is_directed_acyclic_graph(self.to_networkx())

    def to_networkx(self) -> nx.DiGraph:
        g = nx.DiGraph()
        g.add_nodes_from(self.nodes)
        g.add_edges_from(self.edges)
        return g

    def parents(self, node: str) -> tuple[str, ...]:
        return tuple(p for (p, c) in self.edges if c == node)


def validate_dag(payload: dict[str, Any]) -> DAGSpec:
    """Validate a JSON payload and return a `DAGSpec`. Raises on errors."""
    name = payload.get("name")
    nodes = payload.get("nodes")
    edges = payload.get("edges")
    cause_kinds_raw = payload.get("cause_kinds")
    notes = payload.get("notes")

    if not isinstance(name, str) or not name:
        raise DAGValidationError("missing or empty `name`")
    if not isinstance(nodes, list) or not nodes:
        raise DAGValidationError("missing or empty `nodes`")
    if not isinstance(edges, list):
        raise DAGValidationError("missing `edges` (must be a list)")
    if not isinstance(cause_kinds_raw, dict):
        raise DAGValidationError("missing `cause_kinds` (must be an object)")

    node_set = set(nodes)
    if len(node_set) != len(nodes):
        raise DAGValidationError("duplicate node names in `nodes`")

    typed_edges: list[tuple[str, str]] = []
    for edge in edges:
        if not (isinstance(edge, list) and len(edge) == 2):
            raise DAGValidationError(f"malformed edge {edge!r}")
        parent, child = edge[0], edge[1]
        if parent not in node_set or child not in node_set:
            raise DAGValidationError(f"edge {edge!r} references undeclared node")
        typed_edges.append((parent, child))

    if set(cause_kinds_raw.keys()) != node_set:
        missing = node_set - set(cause_kinds_raw.keys())
        extra = set(cause_kinds_raw.keys()) - node_set
        raise DAGValidationError(
            f"cause_kinds keys must equal nodes; missing={sorted(missing)} extra={sorted(extra)}"
        )

    valid_kinds = {k.value for k in CauseKind}
    typed_kinds: dict[str, CauseKind] = {}
    for k, v in cause_kinds_raw.items():
        if v not in valid_kinds:
            raise DAGValidationError(
                f"node {k!r} has unknown cause_kind {v!r}; valid: {sorted(valid_kinds)}"
            )
        typed_kinds[k] = CauseKind(v)

    spec = DAGSpec(
        name=name,
        nodes=tuple(nodes),
        edges=tuple(typed_edges),
        cause_kinds=typed_kinds,
        notes=notes if isinstance(notes, str) else None,
    )
    if not spec.is_acyclic():
        raise DAGValidationError("DAG contains a cycle")
    return spec


def load_dag_for_model(model_id: str, *, repo_root: Path) -> DAGSpec:
    """Load + validate the DAG for `model_id`."""
    pipeline = _MODEL_TO_PIPELINE.get(model_id)
    if pipeline is None:
        raise DAGValidationError(f"no pipeline registered for model_id={model_id!r}")
    path = repo_root / "ml-pipelines" / pipeline / "causal_dag.json"
    if not path.exists():
        raise DAGValidationError(f"DAG file missing: {path}")
    return validate_dag(json.loads(path.read_text()))
