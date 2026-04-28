"""POST /attrib/run — run causal attribution + recommend action.

The handler tries DoWhy GCM first (primary path) and falls back to
DBShap when DoWhy times out or throws a runtime error. Both branches
end in `recommend_action()` which applies the cause→action mapping.

Response shape mirrors the dashboard's `CausalAttribution` interface
in `apps/dashboard/app/_lib/types.ts` so the JSON lands directly in
`governance_decisions.causal_attribution` without a wire transform.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from aegis_causal_attrib.cause_mapping import (
    AttributionEvidence,
    recommend_action,
)
from aegis_causal_attrib.config import get_settings
from aegis_causal_attrib.dag_loader import (
    CauseKind,
    DAGValidationError,
    load_dag_for_model,
)
from aegis_causal_attrib.dbshap import run_dbshap
from aegis_causal_attrib.dowhy_attrib import (
    AttributionRuntimeError,
    AttributionTimeoutError,
    run_dowhy_attribution,
)
from aegis_shared.types import AttributionQuality

router = APIRouter()

# services/causal-attrib/src/aegis_causal_attrib/routers/attrib.py
# parents:                ↑                    ↑          ↑       ↑
#                        [4]                  [3]        [2]     [1]
# parents[5] is the repo root (gov-ml/).
REPO_ROOT = Path(__file__).resolve().parents[5]


class AttribRunRequest(BaseModel):
    """Body of `POST /attrib/run`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    model_id: str = Field(min_length=1)
    target_node: str = Field(min_length=1)
    reference_rows: list[dict[str, Any]] = Field(min_length=1)
    current_rows: list[dict[str, Any]] = Field(min_length=1)
    num_samples: int = Field(default=1_000, ge=10, le=10_000)


@router.post("/attrib/run")
def attrib_run(payload: AttribRunRequest) -> dict[str, Any]:
    """Run causal attribution. Tries DoWhy first; falls back to DBShap."""
    settings = get_settings()
    try:
        spec = load_dag_for_model(payload.model_id, repo_root=REPO_ROOT)
    except DAGValidationError as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=f"no DAG for model_id={payload.model_id!r}",
        ) from exc

    reference = pd.DataFrame(payload.reference_rows)
    current = pd.DataFrame(payload.current_rows)

    if payload.target_node not in reference.columns:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"target_node {payload.target_node!r} not in reference frame columns",
        )

    try:
        result = run_dowhy_attribution(
            model_id=payload.model_id,
            spec=spec,
            reference=reference,
            current=current,
            target_node=payload.target_node,
            timeout_s=settings.attrib_timeout_s,
            num_samples=payload.num_samples,
        )
        method = "DoWhy GCM"
        quality = AttributionQuality.HIGH
        shapley = result.shapley
        dominant = result.dominant_cause
        target_delta = result.target_delta
    except (AttributionTimeoutError, AttributionRuntimeError):
        dbshap = run_dbshap(
            reference=reference,
            current=current,
            target_column=payload.target_node,
            num_samples=settings.dbshap_samples,
        )
        method = "DBShap"
        quality = AttributionQuality.DEGRADED
        shapley = dbshap.shapley
        dominant = dbshap.dominant_cause
        target_delta = dbshap.target_delta

    total = sum(abs(v) for v in shapley.values()) or 1.0
    confidence = abs(shapley.get(dominant, 0.0)) / total
    dominant_kind = spec.cause_kinds.get(dominant, CauseKind.UPSTREAM_COVARIATE)
    action = recommend_action(
        AttributionEvidence(
            dominant_cause_node=dominant,
            dominant_cause_kind=dominant_kind,
            shapley=shapley,
            confidence=confidence,
        )
    )

    root_causes = [
        {"node": node, "contribution": abs(v) / total}
        for node, v in sorted(shapley.items(), key=lambda kv: abs(kv[1]), reverse=True)
    ]

    return {
        "method": method,
        "target_metric": payload.target_node,
        "observed_value": float(current[payload.target_node].mean()),
        "counterfactual_value": float(reference[payload.target_node].mean()),
        "target_delta": target_delta,
        "root_causes": root_causes,
        "confidence": confidence,
        "recommended_action": action.value,
        "attribution_quality": quality.value,
    }
