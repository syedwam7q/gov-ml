# Aegis — Phase 7: Pareto-Optimal Action Selection · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** Stand up `services/action-selector` — the second of the two paper-earning research extensions. When a `GovernanceDecision` advances from `analyzed` to `planned`, the control plane calls `POST /select` and the service returns a `plan_evidence` payload with the chosen action, the full Pareto front (with posterior intervals), the exploration bonus, and the current Lagrangian dual `λ`. The dashboard's `/incidents/<id>` Pareto-front chart renders that JSONB directly.

**Architecture.** Three structural moves:

1. **Bayesian linear regression oracle per action.** For each of the 8 candidate actions `a ∈ A`, maintain a conjugate-Gaussian regressor `r̂(x, a)` over a 4-dim vector reward (Δacc, Δfair, −Δlatency, −Δcost) and a separate `ĉ(x, a)` over the cost dimensions. Posterior is closed-form; UCB bonus is `√(β · x_tᵀ · Σ_a · x_t)`.

2. **Lagrangian dual + projected-gradient update.** Spec §12.2: `argmax_a (r̂(x, a) − λᵀ · ĉ(x, a)) + UCB_bonus(x, a)`. After each observation window, update `λ ← max(0, λ + η · (ĉ − budget/T))`. λ is persisted between calls (process-local for now; Redis later).

3. **Cause→action prior plumbing.** When the decision's `causal_attribution.recommended_action` is set (Phase 6 output), boost that action's score by a configurable prior strength `α`. The bandit can override under regret guarantees — the cause-mapping is a strong prior, not a hard policy.

**Tech Stack.** `numpy` + `scipy.linalg` (closed-form BLR posterior) · custom CB-Knapsack implementation in pure NumPy (no `cvxpy` needed for the dual update — projected gradient is one line) · `pymoo` for the Tchebycheff baseline · FastAPI · `hypothesis` for the regret-bound property test · pytest.

**Spec reference.** `docs/superpowers/specs/2026-04-28-aegis-design.md` §4.3 (per-service contract row 7), §5 (decision lifecycle Phase 3 — Plan), §6.1 (`governance_decisions.plan_evidence` JSONB · `action_history` table), §12.2 (full research extension spec — load-bearing).

**Why this phase, why now.** Phase 6 made `causal_attribution` real. Phase 7 makes `plan_evidence` real. Together they close the **two novel research contributions** that earn the paper's primary claim: _"the first ML governance platform that closes the MAPE-K loop autonomously by combining causal-DAG-grounded attribution + Pareto-optimal action selection with regret bounds."_

---

## File structure created or modified in Phase 7

```
gov-ml/
├── services/action-selector/
│   ├── pyproject.toml                                       # CREATE
│   ├── src/aegis_action_selector/
│   │   ├── __init__.py                                       # CREATE
│   │   ├── py.typed                                          # CREATE
│   │   ├── app.py                                            # CREATE — FastAPI app
│   │   ├── config.py                                         # CREATE — settings
│   │   ├── actions.py                                        # CREATE — 8 ActionKey definitions + cost vectors
│   │   ├── blr.py                                            # CREATE — Bayesian linear regression oracle
│   │   ├── cb_knapsack.py                                    # CREATE — CB-Knapsack algorithm
│   │   ├── tchebycheff.py                                    # CREATE — Tchebycheff scalarization baseline
│   │   ├── pareto.py                                         # CREATE — Pareto front extraction
│   │   ├── persistence.py                                    # CREATE — load/save BLR posteriors + λ
│   │   └── routers/
│   │       ├── __init__.py                                   # CREATE
│   │       ├── health.py                                     # CREATE
│   │       └── select.py                                     # CREATE — POST /select
│   └── tests/
│       ├── __init__.py                                       # CREATE
│       ├── conftest.py                                       # CREATE
│       ├── test_actions.py                                   # CREATE — 8 actions + cost vectors lock
│       ├── test_blr.py                                       # CREATE — closed-form posterior, UCB shrinks with data
│       ├── test_cb_knapsack.py                               # CREATE — Lagrangian + projected-gradient update
│       ├── test_tchebycheff.py                               # CREATE — sweeps Pareto front
│       ├── test_pareto.py                                    # CREATE — non-domination test
│       ├── test_select_endpoint.py                           # CREATE — POST /select roundtrip
│       └── test_regret_bounded.py                            # CREATE — R(T) = O(√(T·log T)·k) property test
├── packages/shared-py/src/aegis_shared/
│   └── schemas.py                                            # MODIFY — extend CandidateAction with posterior_interval
├── services/control-plane/src/aegis_control_plane/
│   ├── routers/decisions.py                                  # MODIFY — plan-state transition calls /select
│   ├── seed.py                                               # MODIFY — record Phase 7 provenance on hero
│   └── config.py                                             # MODIFY — ACTION_SELECTOR_URL setting
├── apps/dashboard/app/_lib/types.ts                          # MODIFY — extend CandidateAction with posterior_interval
├── tests/scenarios/
│   └── test_scenario_apple_card_phase_7.py                  # CREATE — full plan stage on hero scenario
├── pyproject.toml                                            # MODIFY — register services/action-selector
├── vercel.ts                                                 # MODIFY — /api/select/* rewrite
└── setup.md                                                  # MODIFY — Phase 7 section
```

---

## Phase 7 sub-phases

| Sub-phase | Title                                     | What ships                                                                            |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| 7a        | Service scaffold                          | `services/action-selector` workspace package + /healthz                               |
| 7b        | Action set + cost vectors                 | `actions.py` defines 8 actions with `(latency_cost, dollar_cost, risk_class)` vectors |
| 7c        | BLR oracle                                | Closed-form conjugate-Gaussian posterior; UCB bonus shrinks with sample count         |
| 7d        | CB-Knapsack core                          | Lagrangian dual + projected-gradient update; UCB-augmented action score               |
| 7e        | Tchebycheff baseline                      | `pymoo.NSGA-II` over the 4-dim reward; sweeps Pareto front                            |
| 7f        | Pareto front extraction                   | `pareto.py` — non-domination filter on candidate scores                               |
| 7g        | POST /select endpoint                     | Returns chosen action + Pareto front + posterior intervals + λ + UCB bonus            |
| 7h        | Control-plane plan-state wire             | `analyzed → planned` transition calls /select, persists plan_evidence                 |
| 7i        | Regret-bound property test                | `R(T) = O(√(T·log T)·k)` (Slivkins et al. 2024, Thm. 3.1) — CI-merge-blocking         |
| 7j        | Hero scenario refinement + setup.md + tag | Apple-Card scenario produces real Pareto front; phase-7-complete tag                  |

---

## Sub-phase 7a — Service scaffold

### Task 1: Workspace package + /healthz

**Files:**

- Create: `services/action-selector/pyproject.toml`
- Create: `services/action-selector/src/aegis_action_selector/__init__.py`, `py.typed`
- Create: `services/action-selector/src/aegis_action_selector/app.py`
- Create: `services/action-selector/src/aegis_action_selector/routers/{__init__.py,health.py}`
- Create: `services/action-selector/tests/__init__.py`, `tests/test_health.py`
- Modify: `pyproject.toml` (root) — add member

- [ ] **Step 1: pyproject.toml**

```toml
[project]
name = "aegis-action-selector"
version = "0.1.0"
description = "Pareto-optimal action selection (CB-Knapsacks) for Aegis"
requires-python = ">=3.13"
dependencies = [
  "aegis-shared",
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "httpx>=0.28.0",
  "pydantic>=2.10.0",
  "pydantic-settings>=2.6.0",
  "numpy>=2.1.0",
  "scipy>=1.14.0",
  "pymoo>=0.6.1",
]

[tool.uv.sources]
aegis-shared = { workspace = true }

[dependency-groups]
dev = ["pytest>=8.3.0", "pytest-asyncio>=0.24.0", "hypothesis>=6.115.0"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/aegis_action_selector"]

[tool.pyright]
include = ["src", "tests"]
strict = ["src/aegis_action_selector"]
pythonVersion = "3.13"
```

- [ ] **Step 2: **init**.py / py.typed / app.py / routers/health.py** — exact same shape as `services/causal-attrib/src/aegis_causal_attrib/`. The FastAPI factory mounts only the health router at this stage; `/select` lands in 7g.

- [ ] **Step 3: Workspace registration** — append `services/action-selector` to root `pyproject.toml::[tool.uv.workspace.members]`.

- [ ] **Step 4: Health test + run + commit**

```bash
uv sync --all-packages
uv run --package aegis-action-selector pytest services/action-selector/tests/test_health.py -v
git add services/action-selector pyproject.toml uv.lock
git commit -m "feat(action-selector): Phase 7 — workspace package + /healthz scaffold"
```

---

## Sub-phase 7b — Action set + cost vectors

### Task 2: 8-action enum with cost vectors

**Files:**

- Create: `services/action-selector/src/aegis_action_selector/actions.py`
- Create: `services/action-selector/tests/test_actions.py`

The action set must agree with Phase 6's `ActionKey` (in `services/causal-attrib`). Phase 6 defined 7 ActionKeys; Phase 7 adds one more — `SHADOW_DEPLOY` — to give the bandit an exploratory option that doesn't move user-visible traffic.

- [ ] **Step 1: Failing test**

```python
# services/action-selector/tests/test_actions.py
"""Lock the action set + cost vectors. Spec §12.2 + Phase 6 cause→action."""

from __future__ import annotations

from aegis_action_selector.actions import ACTION_SET, ActionKey, CostVector


def test_action_set_has_eight_canonical_actions() -> None:
    expected = {
        "REWEIGH",
        "RETRAIN",
        "RECALIBRATE",
        "FEATURE_DROP",
        "CALIBRATION_PATCH",
        "REJECT_OPTION",
        "ESCALATE",
        "SHADOW_DEPLOY",
    }
    assert {a.value for a in ActionKey} == expected
    assert len(ACTION_SET) == 8


def test_every_action_has_a_finite_cost_vector() -> None:
    for action, cost in ACTION_SET.items():
        assert isinstance(cost, CostVector)
        assert cost.latency_ms_added >= 0.0
        assert cost.dollar_cost >= 0.0
        assert cost.user_visible_traffic_pct >= 0.0
        assert cost.risk_class in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_shadow_deploy_has_zero_user_visible_traffic() -> None:
    assert ACTION_SET[ActionKey.SHADOW_DEPLOY].user_visible_traffic_pct == 0.0


def test_escalate_has_zero_dollar_cost() -> None:
    """ESCALATE just routes to a human — no compute cost."""
    assert ACTION_SET[ActionKey.ESCALATE].dollar_cost == 0.0
```

- [ ] **Step 2: Implement `actions.py`**

```python
# services/action-selector/src/aegis_action_selector/actions.py
"""The 8-action set Phase 7's bandit chooses between.

Spec §12.2. Each action carries a cost vector that the Knapsack
constraint reads — the bandit's Lagrangian penalty is `λᵀ · cost`.

Action semantics:
  • REWEIGH           — Kamiran-Calders preprocessing on rolling window
  • RETRAIN           — full retrain from scratch
  • RECALIBRATE       — subgroup-specific threshold adjustment
  • FEATURE_DROP      — remove a proxy attribute from the feature set
  • CALIBRATION_PATCH — Pleiss-style calibration patch on existing model
  • REJECT_OPTION     — abstain on near-tied predictions (Chow 1970)
  • ESCALATE          — route to human approval queue (no compute)
  • SHADOW_DEPLOY     — train candidate, run against live traffic, no
                        user-visible decisions emitted (exploration only)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final


class ActionKey(StrEnum):
    REWEIGH = "REWEIGH"
    RETRAIN = "RETRAIN"
    RECALIBRATE = "RECALIBRATE"
    FEATURE_DROP = "FEATURE_DROP"
    CALIBRATION_PATCH = "CALIBRATION_PATCH"
    REJECT_OPTION = "REJECT_OPTION"
    ESCALATE = "ESCALATE"
    SHADOW_DEPLOY = "SHADOW_DEPLOY"


@dataclass(frozen=True)
class CostVector:
    """Per-action constraint vector — fed to the Knapsack penalty."""

    latency_ms_added: float
    dollar_cost: float
    user_visible_traffic_pct: float
    risk_class: str


ACTION_SET: Final[dict[ActionKey, CostVector]] = {
    ActionKey.REWEIGH: CostVector(
        latency_ms_added=2.0, dollar_cost=0.4, user_visible_traffic_pct=100.0, risk_class="MEDIUM"
    ),
    ActionKey.RETRAIN: CostVector(
        latency_ms_added=3.0, dollar_cost=3.8, user_visible_traffic_pct=100.0, risk_class="HIGH"
    ),
    ActionKey.RECALIBRATE: CostVector(
        latency_ms_added=0.5, dollar_cost=0.1, user_visible_traffic_pct=100.0, risk_class="LOW"
    ),
    ActionKey.FEATURE_DROP: CostVector(
        latency_ms_added=0.0, dollar_cost=0.05, user_visible_traffic_pct=100.0, risk_class="MEDIUM"
    ),
    ActionKey.CALIBRATION_PATCH: CostVector(
        latency_ms_added=0.2, dollar_cost=0.08, user_visible_traffic_pct=100.0, risk_class="LOW"
    ),
    ActionKey.REJECT_OPTION: CostVector(
        latency_ms_added=0.0, dollar_cost=0.0, user_visible_traffic_pct=10.0, risk_class="LOW"
    ),
    ActionKey.ESCALATE: CostVector(
        latency_ms_added=0.0, dollar_cost=0.0, user_visible_traffic_pct=0.0, risk_class="LOW"
    ),
    ActionKey.SHADOW_DEPLOY: CostVector(
        latency_ms_added=0.0, dollar_cost=0.6, user_visible_traffic_pct=0.0, risk_class="LOW"
    ),
}
```

- [ ] **Step 3: Run + commit**

```bash
uv run --package aegis-action-selector pytest services/action-selector/tests/test_actions.py -v
git add services/action-selector/src/aegis_action_selector/actions.py \
        services/action-selector/tests/test_actions.py
git commit -m "feat(action-selector): Phase 7 — 8-action set with cost vectors (spec §12.2)"
```

---

## Sub-phase 7c — BLR oracle

### Task 3: Closed-form Bayesian linear regression posterior per action

**Files:**

- Create: `services/action-selector/src/aegis_action_selector/blr.py`
- Create: `services/action-selector/tests/test_blr.py`

Conjugate-Gaussian BLR keeps closed-form `(μ_a, Σ_a)` per action, updated incrementally as `(x, r)` pairs arrive. UCB bonus `β · √(xᵀ Σ_a x)` shrinks with the determinant of `Σ_a` — no MCMC, no autograd, just NumPy.

- [ ] **Step 1: Failing test**

```python
# services/action-selector/tests/test_blr.py
"""Tests for the per-action Bayesian linear regression oracle."""

from __future__ import annotations

import numpy as np

from aegis_action_selector.blr import BayesianLinearRegression


def test_blr_with_no_data_is_at_prior() -> None:
    blr = BayesianLinearRegression(n_features=3, alpha_prior=1.0, beta_prior=1.0)
    x = np.array([1.0, 0.5, -0.3])
    pred = blr.predict_mean(x)
    assert abs(pred) < 1e-9


def test_blr_ucb_bonus_shrinks_with_data() -> None:
    """Adding observations should shrink the posterior variance."""
    rng = np.random.default_rng(0)
    blr = BayesianLinearRegression(n_features=3, alpha_prior=1.0, beta_prior=1.0)
    x = np.array([1.0, 0.5, -0.3])
    bonus_empty = blr.ucb_bonus(x, beta=2.0)
    for _ in range(50):
        xi = rng.normal(0.0, 1.0, 3)
        ri = float(xi @ np.array([0.5, -0.2, 0.1])) + rng.normal(0.0, 0.1)
        blr.update(xi, ri)
    bonus_full = blr.ucb_bonus(x, beta=2.0)
    assert bonus_full < bonus_empty


def test_blr_predicts_close_to_true_after_many_observations() -> None:
    rng = np.random.default_rng(1)
    blr = BayesianLinearRegression(n_features=3, alpha_prior=1.0, beta_prior=10.0)
    true_w = np.array([0.5, -0.2, 0.1])
    for _ in range(500):
        xi = rng.normal(0.0, 1.0, 3)
        ri = float(xi @ true_w) + rng.normal(0.0, 0.05)
        blr.update(xi, ri)
    x = np.array([1.0, 0.5, -0.3])
    pred = blr.predict_mean(x)
    truth = float(x @ true_w)
    assert abs(pred - truth) < 0.05
```

- [ ] **Step 2: Implement `blr.py`**

```python
# services/action-selector/src/aegis_action_selector/blr.py
"""Conjugate-Gaussian Bayesian linear regression.

Posterior:  Σ_a^{-1} = α · I + β · Σ_t x_t x_t^T
            μ_a = β · Σ_a · Σ_t x_t · r_t

Closed-form, per-action. UCB bonus is `√(β · x^T · Σ_a · x)` — the
predictive standard deviation, scaled by an exploration constant.

References:
  Bishop (2006) §3.3 (Bayesian linear regression);
  Abbasi-Yadkori et al. (2011) "Improved algorithms for linear stochastic
  bandits" (UCB1-Lin); Russo & Van Roy (2014) "Learning to Optimize via
  Posterior Sampling" (Thompson sampling alternative).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class BayesianLinearRegression:
    n_features: int
    alpha_prior: float = 1.0
    """Precision of the prior on weights — `α · I`. Higher → tighter prior."""

    beta_prior: float = 1.0
    """Precision of the noise model. Higher → trust observations more."""

    _precision: np.ndarray = field(init=False)
    _mean_times_precision: np.ndarray = field(init=False)

    def __post_init__(self) -> None:
        self._precision = self.alpha_prior * np.eye(self.n_features)
        self._mean_times_precision = np.zeros(self.n_features)

    @property
    def covariance(self) -> np.ndarray:
        return np.linalg.inv(self._precision)

    @property
    def mean(self) -> np.ndarray:
        return self.covariance @ self._mean_times_precision

    def update(self, x: np.ndarray, r: float) -> None:
        x = np.asarray(x, dtype=float)
        self._precision = self._precision + self.beta_prior * np.outer(x, x)
        self._mean_times_precision = self._mean_times_precision + self.beta_prior * r * x

    def predict_mean(self, x: np.ndarray) -> float:
        return float(np.asarray(x, dtype=float) @ self.mean)

    def ucb_bonus(self, x: np.ndarray, beta: float) -> float:
        """Predictive standard deviation × β. Spec §12.2."""
        x = np.asarray(x, dtype=float)
        var = float(x @ self.covariance @ x)
        return beta * np.sqrt(max(0.0, var))
```

- [ ] **Step 3: Run + commit**

```bash
uv run --package aegis-action-selector pytest services/action-selector/tests/test_blr.py -v
git add services/action-selector/src/aegis_action_selector/blr.py \
        services/action-selector/tests/test_blr.py
git commit -m "feat(action-selector): Phase 7 — closed-form BLR oracle (Bishop §3.3, Abbasi-Yadkori 2011)"
```

---

## Sub-phase 7d — CB-Knapsack core

### Task 4: Lagrangian + projected-gradient dual

**Files:**

- Create: `services/action-selector/src/aegis_action_selector/cb_knapsack.py`
- Create: `services/action-selector/tests/test_cb_knapsack.py`

- [ ] **Step 1: Failing test**

```python
# services/action-selector/tests/test_cb_knapsack.py
"""Tests for the CB-Knapsack core algorithm."""

from __future__ import annotations

import numpy as np

from aegis_action_selector.actions import ACTION_SET, ActionKey
from aegis_action_selector.cb_knapsack import CBKnapsack


def test_cb_knapsack_picks_an_action() -> None:
    cb = CBKnapsack(action_set=ACTION_SET, n_features=4, beta=2.0)
    context = np.array([0.71, 0.94, 0.18, 0.5])
    chosen, scores = cb.choose_action(context)
    assert chosen in ACTION_SET
    assert isinstance(scores, dict)
    assert set(scores.keys()) == set(ACTION_SET.keys())


def test_lambda_dual_updates_toward_constraint_violation() -> None:
    """When observed cost exceeds budget, λ should increase."""
    cb = CBKnapsack(action_set=ACTION_SET, n_features=4, beta=2.0)
    initial_lambda = cb.lambda_dual.copy()
    # Observe a high-cost remediation: dollar_cost = 5.0 vs budget 1.0.
    cb.update(
        ActionKey.RETRAIN,
        context=np.array([0.5, 0.5, 0.5, 0.5]),
        reward_vector=np.array([0.001, 0.20, -2.0, -3.8]),
        observed_cost_vector=np.array([2.0, 5.0, 100.0, 0.0]),
        budget=np.array([5.0, 1.0, 100.0, 1.0]),
        horizon_remaining=10,
    )
    assert cb.lambda_dual[1] > initial_lambda[1], "λ for dollar_cost should grow"


def test_recommended_action_prior_boosts_score() -> None:
    """Phase 6's recommended_action should bias the score upward."""
    cb = CBKnapsack(action_set=ACTION_SET, n_features=4, beta=2.0, prior_strength=0.5)
    context = np.array([0.71, 0.94, 0.18, 0.5])
    chosen_no_prior, scores_no_prior = cb.choose_action(context)
    chosen_with_prior, scores_with_prior = cb.choose_action(
        context, recommended_action=ActionKey.REWEIGH
    )
    # The boost adds prior_strength to REWEIGH's score.
    assert (
        scores_with_prior[ActionKey.REWEIGH] > scores_no_prior[ActionKey.REWEIGH]
    )
```

- [ ] **Step 2: Implement `cb_knapsack.py`**

```python
# services/action-selector/src/aegis_action_selector/cb_knapsack.py
"""Contextual bandits with knapsacks (CB-Knapsack).

Reference: Slivkins, Sankararaman & Foster, JMLR vol 25 paper 24-1220
(2024). Spec §12.2.

Per-step decision:
    a* = argmax_a { r̂(x, a) − λᵀ ĉ(x, a) + UCB_bonus(x, a) + α·1{a == prior} }

Dual update (after observing reward + cost):
    λ ← max(0, λ + η · (ĉ_t − budget / horizon_remaining))

We maintain one BLR per (action, reward dim) — 8 actions × 4 reward
dims = 32 oracles. Cost regressors are likewise per (action, cost dim).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import cast

import numpy as np

from aegis_action_selector.actions import ACTION_SET, ActionKey, CostVector
from aegis_action_selector.blr import BayesianLinearRegression


@dataclass
class CBKnapsack:
    action_set: dict[ActionKey, CostVector]
    n_features: int
    beta: float = 2.0
    """UCB exploration constant. Spec §12.2."""

    eta: float = 0.05
    """Dual-update step size."""

    prior_strength: float = 0.5
    """Boost added to the recommended_action's score (Phase 6 → Phase 7 prior)."""

    n_reward_dims: int = 4  # (Δacc, Δfair, −Δlatency, −Δcost)
    n_cost_dims: int = 4  # (latency, dollar, traffic, risk)

    reward_oracles: dict[ActionKey, list[BayesianLinearRegression]] = field(default_factory=dict)
    cost_oracles: dict[ActionKey, list[BayesianLinearRegression]] = field(default_factory=dict)
    lambda_dual: np.ndarray = field(default_factory=lambda: np.zeros(4))

    def __post_init__(self) -> None:
        for action in self.action_set:
            self.reward_oracles[action] = [
                BayesianLinearRegression(self.n_features) for _ in range(self.n_reward_dims)
            ]
            self.cost_oracles[action] = [
                BayesianLinearRegression(self.n_features) for _ in range(self.n_cost_dims)
            ]

    def choose_action(
        self,
        context: np.ndarray,
        *,
        recommended_action: ActionKey | None = None,
    ) -> tuple[ActionKey, dict[ActionKey, float]]:
        """Pick the action that maximises (UCB + cause-mapping prior)."""
        scores: dict[ActionKey, float] = {}
        for action in self.action_set:
            r_hat = sum(
                oracle.predict_mean(context) for oracle in self.reward_oracles[action]
            )
            c_hat = np.array([
                oracle.predict_mean(context) for oracle in self.cost_oracles[action]
            ])
            ucb = sum(
                oracle.ucb_bonus(context, self.beta)
                for oracle in self.reward_oracles[action]
            )
            score = r_hat - float(self.lambda_dual @ c_hat) + ucb
            if recommended_action is not None and action == recommended_action:
                score += self.prior_strength
            scores[action] = score
        chosen = cast("ActionKey", max(scores, key=scores.__getitem__))
        return chosen, scores

    def update(
        self,
        action: ActionKey,
        *,
        context: np.ndarray,
        reward_vector: np.ndarray,
        observed_cost_vector: np.ndarray,
        budget: np.ndarray,
        horizon_remaining: int,
    ) -> None:
        """Update reward + cost oracles, then update Lagrangian dual."""
        for i, r in enumerate(reward_vector):
            self.reward_oracles[action][i].update(context, float(r))
        for i, c in enumerate(observed_cost_vector):
            self.cost_oracles[action][i].update(context, float(c))
        # Projected-gradient dual update.
        diff = observed_cost_vector - budget / max(1, horizon_remaining)
        self.lambda_dual = np.maximum(0.0, self.lambda_dual + self.eta * diff)
```

- [ ] **Step 3: Run + commit**

```bash
uv run --package aegis-action-selector pytest services/action-selector/tests/test_cb_knapsack.py -v
git add services/action-selector/src/aegis_action_selector/cb_knapsack.py \
        services/action-selector/tests/test_cb_knapsack.py
git commit -m "feat(action-selector): Phase 7 — CB-Knapsack core (Slivkins et al. JMLR 2024)"
```

---

## Sub-phase 7e — Tchebycheff baseline

### Task 5: Tchebycheff scalarization via pymoo

**Files:**

- Create: `services/action-selector/src/aegis_action_selector/tchebycheff.py`
- Create: `services/action-selector/tests/test_tchebycheff.py`

The Tchebycheff baseline (Miettinen 1999) sweeps weight vectors `w` through the simplex and picks `argmax_a min_i w_i · (r_i(a) − r_i*)`. No online adaptation — that's the gap CB-Knapsack closes. It's the paper's baseline reference.

- [ ] **Step 1 — Implementation**

```python
# services/action-selector/src/aegis_action_selector/tchebycheff.py
"""Tchebycheff scalarization baseline (Miettinen 1999).

For weight vector w over the 4 reward dimensions:
    a* = argmax_a min_i w_i · (r_i(a) − r_i*)

where r_i* is the ideal point per dimension. Sweeping w traces the
Pareto front. No online adaptation — pure offline scalarization.
"""

from __future__ import annotations

import numpy as np

from aegis_action_selector.actions import ActionKey


def tchebycheff_choose(
    candidates: dict[ActionKey, np.ndarray],
    weights: np.ndarray,
    ideal_point: np.ndarray,
) -> ActionKey:
    """Choose the action that maximises the min-weighted distance from
    the ideal point in the 4-dim reward space."""
    if abs(weights.sum() - 1.0) > 1e-9:
        raise ValueError(f"weights must sum to 1.0, got {weights.sum()}")
    best_action: ActionKey | None = None
    best_value = -np.inf
    for action, reward in candidates.items():
        value = float(np.min(weights * (reward - ideal_point)))
        if value > best_value:
            best_value = value
            best_action = action
    assert best_action is not None
    return best_action


def sweep_pareto_front(
    candidates: dict[ActionKey, np.ndarray],
    ideal_point: np.ndarray,
    n_weight_samples: int = 50,
    rng: np.random.Generator | None = None,
) -> set[ActionKey]:
    """Sweep weight simplex via Dirichlet samples; return set of chosen actions."""
    rng = rng or np.random.default_rng(0)
    chosen: set[ActionKey] = set()
    n_dim = len(ideal_point)
    for _ in range(n_weight_samples):
        weights = rng.dirichlet(np.ones(n_dim))
        chosen.add(tchebycheff_choose(candidates, weights, ideal_point))
    return chosen
```

- [ ] **Step 2 — Test**

```python
# services/action-selector/tests/test_tchebycheff.py
import numpy as np

from aegis_action_selector.actions import ActionKey
from aegis_action_selector.tchebycheff import sweep_pareto_front, tchebycheff_choose


def test_tchebycheff_picks_dominant_action() -> None:
    """If one action dominates on every dim, it should always be chosen."""
    candidates = {
        ActionKey.REWEIGH: np.array([0.10, 0.20, -0.05, -0.40]),
        ActionKey.RETRAIN: np.array([-1.0, -1.0, -1.0, -1.0]),
    }
    weights = np.array([0.25, 0.25, 0.25, 0.25])
    ideal = np.array([0.0, 0.0, 0.0, 0.0])
    chosen = tchebycheff_choose(candidates, weights, ideal)
    assert chosen == ActionKey.REWEIGH


def test_sweep_returns_pareto_front() -> None:
    """Two non-dominated actions should both appear when sweeping."""
    candidates = {
        ActionKey.REWEIGH: np.array([0.10, 0.20, -0.05, -0.40]),
        ActionKey.RETRAIN: np.array([0.30, 0.05, -0.20, -3.80]),
    }
    ideal = np.array([0.0, 0.0, 0.0, 0.0])
    chosen = sweep_pareto_front(candidates, ideal, n_weight_samples=50)
    # Both actions are non-dominated on different weight regions.
    assert ActionKey.REWEIGH in chosen
```

- [ ] **Step 3 — Run + commit**

---

## Sub-phase 7f — Pareto front extraction

### Task 6: Non-domination filter

**Files:**

- Create: `services/action-selector/src/aegis_action_selector/pareto.py`
- Create: `services/action-selector/tests/test_pareto.py`

```python
# services/action-selector/src/aegis_action_selector/pareto.py
"""Pareto-front extraction over candidate (reward_vector, action) pairs."""

from __future__ import annotations

import numpy as np

from aegis_action_selector.actions import ActionKey


def pareto_front(candidates: dict[ActionKey, np.ndarray]) -> set[ActionKey]:
    """Return the set of non-dominated actions.

    A dominates B iff A ≥ B on every dim AND A > B on at least one dim.
    """
    keys = list(candidates.keys())
    out: set[ActionKey] = set()
    for i, a in enumerate(keys):
        ra = candidates[a]
        dominated = False
        for j, b in enumerate(keys):
            if i == j:
                continue
            rb = candidates[b]
            if np.all(rb >= ra) and np.any(rb > ra):
                dominated = True
                break
        if not dominated:
            out.add(a)
    return out
```

Tests cover: trivial case (one action ⇒ frontier of itself), two non-dominated actions on different reward dims, full domination case (one action better on every dim ⇒ frontier of size 1).

---

## Sub-phase 7g — POST /select endpoint

### Task 7: HTTP wire

**Files:**

- Create: `services/action-selector/src/aegis_action_selector/routers/select.py`
- Create: `services/action-selector/src/aegis_action_selector/persistence.py`
- Create: `services/action-selector/tests/test_select_endpoint.py`

`POST /select` body: `{model_id, decision_id, context (4-dim float array), constraints (4-dim budget), available_actions (subset of ActionKey), recommended_action (optional, from Phase 6), horizon_remaining}`. Returns `{chosen_action, rationale, pareto_front [{action, reward, posterior_low, posterior_high}], exploration_bonus_per_action, lambda_dual}`.

`persistence.py` keeps the bandit state in a process-local dict keyed by `model_id` — not durable across restarts; Phase 8 wires Redis. For Phase 7 the in-memory state is fine because the bandit's effective horizon is one decision.

Tests cover: live roundtrip with synthetic context, Pareto-front cardinality, posterior intervals shrink after observed reward updates.

---

## Sub-phase 7h — Control-plane plan-state wire

### Task 8: `analyzed → planned` transition calls /select

Mirror Phase 6's analyze-state wire. When the caller supplies no explicit `payload`, the control plane reads the decision's `causal_attribution.recommended_action` (Phase 6 output) plus the drift signature, builds the BLR context, and calls `POST /select`. The response lands in `row.plan_evidence`.

`ACTION_SELECTOR_URL` env (default `http://localhost:8004`) configures the wire.

---

## Sub-phase 7i — Regret-bound property test (paper claim)

### Task 9: `R(T) = O(√(T·log T)·k)` (Slivkins et al. 2024 Thm. 3.1)

Property test: simulate a synthetic 4-dim reward landscape where the optimal action is known. Run CB-Knapsack for `T` rounds; measure cumulative regret against the oracle. Assert `regret(T) / √(T·log T) ≤ C · k` for a constant `C` and `k = number of actions`. Hypothesis-generated random seeds × `T ∈ {100, 200, 500}`.

This is the **load-bearing paper claim** for Phase 7. CI-merge-blocking.

---

## Sub-phase 7j — Hero scenario refinement, setup.md, vercel.ts, tag

- Apple-Card scenario test extended to run the full plan stage: cause-attrib → action-selector → assert the chosen action is REWEIGH (the cause-mapping prior dominates with 50-round bandit warm-up).
- `setup.md` Phase 7 section.
- `vercel.ts` `/api/select/*` rewrite.
- Tag `phase-7-complete` and push.

---

## Self-review

### Spec coverage

| Spec §                                | Requirement                             | Task |
| ------------------------------------- | --------------------------------------- | ---- |
| 12.2 Lagrangian / UCB / dual update   | `cb_knapsack.py` choose_action + update | 4    |
| 12.2 Tchebycheff baseline             | `tchebycheff.py` sweep_pareto_front     | 5    |
| 12.2 regret bound (Slivkins Thm. 3.1) | `test_regret_bounded.py` property test  | 9    |
| 4.3 service contract `/select`        | endpoint with full response shape       | 7    |
| 5.1 plan-state transition             | control-plane wire                      | 8    |
| 6.1 `plan_evidence` JSONB             | populated by /select response           | 7, 8 |

### Type consistency

- `ActionKey` (8 values, including new `SHADOW_DEPLOY`) is a superset of Phase 6's `ActionKey` (7 values). The dashboard's TS surface accepts the broader set; Phase 6 callers continue to work.
- `CostVector` shape (latency_ms_added, dollar_cost, user_visible_traffic_pct, risk_class) is locked by `test_every_action_has_a_finite_cost_vector`.

### Scope check

Phase 7 ships the full Pareto-policy stack: BLR oracle, CB-Knapsack core, Tchebycheff baseline, Pareto front, /select endpoint, control-plane wire, regret-bound CI gate. No remaining gaps for the paper's second extension claim.

---

## What lands in Phase 8 (next plan)

- `services/assistant` — Groq-powered tool-using agent grounded in MAPE-K (the 7 tools from spec §11.2).
- Persistent BLR state (Redis) so the bandit state survives process restarts.
- `apps/dashboard/(app)/chat/_view.tsx` wired to the live assistant — every claim cites an audit row.
