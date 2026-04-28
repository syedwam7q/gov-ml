# Aegis — Phase 0: Repo Scaffolding · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Aegis monorepo with all tooling, CI baseline, shared Python and TypeScript schemas (including the Merkle-chained audit-log writer), and a CI-validated `setup.md` — leaving a clean, professional foundation for Phase 1 (ML pipelines + 3 trained models).

**Architecture:** pnpm + Turborepo for the JS side; uv workspace for the Python side. `packages/shared-py` owns Pydantic schemas (single source of truth) and the Merkle audit-log primitives; `packages/shared-ts` is auto-generated from `shared-py`'s JSON Schema so the frontend and backend cannot disagree on contracts. CI runs lint + typecheck + test on every PR; a nightly job replays `setup.md` in a fresh container so the doc cannot rot.

**Tech Stack:** pnpm 9, Turborepo, Node.js 22, TypeScript 5.6, uv 0.5, Python 3.13, Pydantic v2, ruff, pyright, vitest, pytest, hypothesis, ESLint 9, Prettier 3, lefthook, GitHub Actions, vercel.ts (`@vercel/config`).

**Spec reference:** `docs/superpowers/specs/2026-04-28-aegis-design.md` (sections 4.1, 4.4, 6.2, 8.7, 13:Phase 0).

---

## File structure being created in Phase 0

```
gov-ml/
├── README.md                                  ← Task 1
├── package.json                               ← Task 2
├── pnpm-workspace.yaml                        ← Task 2
├── turbo.json                                 ← Task 3
├── pyproject.toml                             ← Task 4 + 5
├── tsconfig.base.json                         ← Task 6
├── tsconfig.json                              ← Task 6
├── eslint.config.mjs                          ← Task 7
├── .prettierrc                                ← Task 7
├── .prettierignore                            ← Task 7
├── lefthook.yml                               ← Task 8
├── .env.example                               ← Task 9
├── packages/
│   ├── shared-py/
│   │   ├── pyproject.toml                     ← Task 10
│   │   ├── src/aegis_shared/__init__.py       ← Task 10
│   │   ├── src/aegis_shared/types.py          ← Task 10
│   │   ├── src/aegis_shared/schemas.py        ← Task 10
│   │   ├── src/aegis_shared/audit.py          ← Task 11
│   │   ├── tests/__init__.py                  ← Task 10
│   │   ├── tests/test_schemas.py              ← Task 10
│   │   └── tests/test_audit.py                ← Task 11
│   ├── shared-ts/
│   │   ├── package.json                       ← Task 12
│   │   ├── tsconfig.json                      ← Task 12
│   │   ├── scripts/generate.ts                ← Task 12
│   │   ├── src/index.ts                       ← Task 12 (generated)
│   │   └── tests/index.test.ts                ← Task 12
│   └── ui/
│       ├── package.json                       ← Task 13
│       ├── tsconfig.json                      ← Task 13
│       ├── src/index.ts                       ← Task 13
│       ├── src/lib/cn.ts                      ← Task 13
│       └── src/lib/cn.test.ts                 ← Task 13
├── .github/workflows/
│   ├── pr.yml                                 ← Task 14
│   ├── chain-anchor.yml                       ← Task 14
│   └── setup-validator.yml                    ← Task 14
├── docs/
│   ├── superpowers/specs/                     ← already exists from spec commit
│   ├── superpowers/plans/                     ← contains this plan
│   ├── paper/.gitkeep                         ← Task 15
│   └── compliance/.gitkeep                    ← Task 15
├── tests/
│   ├── safety/.gitkeep                        ← Task 15
│   ├── scenarios/.gitkeep                     ← Task 15
│   ├── property/.gitkeep                      ← Task 15
│   └── e2e/.gitkeep                           ← Task 15
├── apps/
│   ├── dashboard/.gitkeep                     ← Task 15
│   └── landing/.gitkeep                       ← Task 15
├── services/
│   └── (one .gitkeep per planned service)     ← Task 15
├── workflows/.gitkeep                         ← Task 15
├── ml-pipelines/.gitkeep                      ← Task 15
├── data/.gitkeep                              ← Task 15
├── infra/.gitkeep                             ← Task 15
├── vercel.ts                                  ← Task 16
└── setup.md                                   ← Task 17
```

---

## Tasks

### Task 1: Project README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# Aegis · Autonomous Self-Healing Governance for ML Systems

Aegis is a multi-domain ML governance platform that closes the **MAPE-K** loop autonomously: it monitors a fleet of three production models (credit risk, toxicity, hospital readmission) for drift, bias/fairness, calibration, and operational issues; attributes detected drift to specific causal mechanisms via DoWhy GCM; selects a Pareto-optimal remediation action via a contextual bandit with knapsack constraints; executes the action under canary rollout with KPI guards and approval gates for high-risk changes; and evaluates the outcome to feed back into the bandit's posterior. Everything runs on free-tier services. Every state transition writes a Merkle-chained audit-log row.

## Design

The full design lives at [`docs/superpowers/specs/2026-04-28-aegis-design.md`](docs/superpowers/specs/2026-04-28-aegis-design.md).

## Setup

See [`setup.md`](setup.md) for installation, environment configuration, and run instructions. The setup is CI-validated nightly.

## Status

Phase 0 — repo scaffolding.

## License

MIT.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "docs: add project README"
```

---

### Task 2: pnpm workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: Verify pnpm is installed**

Run: `pnpm --version`
Expected: `9.x.x` or higher. If missing, install via `npm install -g pnpm@latest`.

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "aegis",
  "private": true,
  "version": "0.1.0",
  "description": "Autonomous self-healing governance for ML systems",
  "license": "MIT",
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\" --ignore-path .prettierignore",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\" --ignore-path .prettierignore"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
  - "workflows"
```

- [ ] **Step 4: Run install (will create `pnpm-lock.yaml`)**

Run: `pnpm install`
Expected: success with no warnings about missing engines.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: initialize pnpm workspace"
```

---

### Task 3: Turborepo

**Files:**
- Create: `turbo.json`
- Modify: `package.json` (add turbo dev dep)

- [ ] **Step 1: Add turbo to dev deps**

Run: `pnpm add -Dw turbo@^2.3.0`
Expected: `package.json` updated with `"turbo": "^2.3.0"` in `devDependencies`.

- [ ] **Step 2: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": ["NODE_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

- [ ] **Step 3: Verify**

Run: `pnpm turbo --help`
Expected: turbo CLI help output (confirms turbo is installed).

- [ ] **Step 4: Commit**

```bash
git add turbo.json package.json pnpm-lock.yaml
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: configure Turborepo"
```

---

### Task 4: uv Python workspace

**Files:**
- Create: `pyproject.toml`

- [ ] **Step 1: Verify uv is installed**

Run: `uv --version`
Expected: `uv 0.5.x` or higher. If missing, install via `curl -LsSf https://astral.sh/uv/install.sh | sh`.

- [ ] **Step 2: Create root `pyproject.toml`**

```toml
[project]
name = "aegis"
version = "0.1.0"
description = "Autonomous self-healing governance for ML systems"
readme = "README.md"
license = { text = "MIT" }
requires-python = ">=3.13"
authors = [{ name = "syedwam7q", email = "engg@airtribe.live" }]

[tool.uv.workspace]
members = [
  "packages/shared-py",
  "services/*",
]

[tool.uv]
dev-dependencies = [
  "ruff>=0.8.0",
  "pyright>=1.1.380",
  "pytest>=8.3.0",
  "pytest-asyncio>=0.24.0",
  "pytest-cov>=6.0.0",
  "hypothesis>=6.115.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

- [ ] **Step 3: Sync (creates `.venv` + `uv.lock`)**

Run: `uv sync`
Expected: success; `.venv/` and `uv.lock` created.

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml uv.lock
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: initialize uv Python workspace"
```

---

### Task 5: Python tooling config (ruff + pyright + pytest)

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Append ruff / pyright / pytest config sections**

Append to `pyproject.toml`:

```toml
[tool.ruff]
target-version = "py313"
line-length = 100
src = ["packages/shared-py/src", "services"]
extend-exclude = [".venv", ".uv", "node_modules", "**/__pycache__"]

[tool.ruff.lint]
select = [
  "E",    # pycodestyle errors
  "W",    # pycodestyle warnings
  "F",    # pyflakes
  "I",    # isort
  "B",    # bugbear
  "UP",   # pyupgrade
  "N",    # pep8-naming
  "ANN",  # annotations
  "S",    # flake8-bandit (security)
  "RET",  # return-value rules
  "SIM",  # simplify
  "PT",   # pytest style
]
ignore = [
  "ANN101",  # missing self type
  "ANN102",  # missing cls type
  "S101",    # assert usage (pytest needs it)
]

[tool.ruff.lint.per-file-ignores]
"**/tests/**" = ["S101", "ANN"]  # tests can use assert + skip type hints

[tool.ruff.format]
quote-style = "double"
indent-style = "space"

[tool.pyright]
pythonVersion = "3.13"
typeCheckingMode = "strict"
include = ["packages/shared-py/src", "services"]
exclude = ["**/.venv", "**/__pycache__", "**/node_modules"]

[tool.pytest.ini_options]
minversion = "8.0"
testpaths = ["packages/shared-py/tests", "services", "tests"]
addopts = "-ra --strict-markers --strict-config"
asyncio_mode = "auto"
```

- [ ] **Step 2: Verify ruff runs cleanly on empty repo**

Run: `uv run ruff check .`
Expected: `All checks passed!`

- [ ] **Step 3: Verify pyright runs**

Run: `uv run pyright --version`
Expected: a version string.

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: configure Python tooling (ruff, pyright, pytest)"
```

---

### Task 6: Root TypeScript configs

**Files:**
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "incremental": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 2: Create root `tsconfig.json`**

```json
{
  "extends": "./tsconfig.base.json",
  "include": [],
  "references": [
    { "path": "./packages/shared-ts" },
    { "path": "./packages/ui" }
  ]
}
```

- [ ] **Step 3: Add typescript dev dep**

Run: `pnpm add -Dw typescript@^5.6.0 @types/node@^22.0.0`

- [ ] **Step 4: Commit**

```bash
git add tsconfig.base.json tsconfig.json package.json pnpm-lock.yaml
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: add root TypeScript configuration"
```

---

### Task 7: ESLint + Prettier

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Modify: `package.json`

- [ ] **Step 1: Add eslint + prettier dev deps**

Run: `pnpm add -Dw eslint@^9.15.0 @eslint/js@^9.15.0 typescript-eslint@^8.15.0 eslint-config-prettier@^9.1.0 prettier@^3.4.0`

- [ ] **Step 2: Create `eslint.config.mjs`**

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/.venv/**",
      "**/__pycache__/**",
      "packages/shared-ts/src/index.ts",
    ],
  },
  prettier,
);
```

- [ ] **Step 3: Create `.prettierrc`**

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 4: Create `.prettierignore`**

```
node_modules/
.pnpm-store/
.turbo/
dist/
build/
.next/
out/
coverage/
.venv/
__pycache__/
*.tsbuildinfo
pnpm-lock.yaml
uv.lock
packages/shared-ts/src/index.ts
```

- [ ] **Step 5: Verify formatting check passes (no files yet to format)**

Run: `pnpm format:check`
Expected: `All matched files use Prettier code style!`

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs .prettierrc .prettierignore package.json pnpm-lock.yaml
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: configure ESLint and Prettier"
```

---

### Task 8: lefthook pre-commit hooks

**Files:**
- Create: `lefthook.yml`
- Modify: `package.json`

- [ ] **Step 1: Add lefthook dev dep**

Run: `pnpm add -Dw lefthook@^1.10.0`

- [ ] **Step 2: Create `lefthook.yml`**

```yaml
pre-commit:
  parallel: true
  commands:
    prettier:
      glob: "*.{ts,tsx,js,jsx,json,md,yml,yaml}"
      run: pnpm prettier --write {staged_files}
      stage_fixed: true
    eslint:
      glob: "*.{ts,tsx,js,jsx,mjs}"
      exclude: ["packages/shared-ts/src/index.ts"]
      run: pnpm eslint --fix {staged_files}
      stage_fixed: true
    ruff:
      glob: "*.py"
      run: uv run ruff check --fix {staged_files} && uv run ruff format {staged_files}
      stage_fixed: true

pre-push:
  commands:
    typecheck:
      run: pnpm turbo typecheck
    test:
      run: pnpm turbo test
    pytest:
      run: uv run pytest
```

- [ ] **Step 3: Install hooks**

Run: `pnpm lefthook install`
Expected: `sync hooks: ✔️ (pre-commit, pre-push)`

- [ ] **Step 4: Commit**

```bash
git add lefthook.yml package.json pnpm-lock.yaml
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: install lefthook pre-commit and pre-push hooks"
```

---

### Task 9: `.env.example` (full env-var inventory)

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Create `.env.example`**

```bash
# ============================================================================
# Aegis · environment variables · documented in setup.md
# Copy to `.env` and fill in your local values. Never commit `.env`.
# ============================================================================

# --- Auth (Clerk) -----------------------------------------------------------
# Get from https://dashboard.clerk.com (free tier · 10K MAU)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# --- Database (Neon Postgres) ------------------------------------------------
# Get from https://console.neon.tech (free tier · 0.5 GB · 191.9 compute-hr/mo)
DATABASE_URL=postgres://user:pass@ep-cool-thing.region.aws.neon.tech/aegis?sslmode=require
DATABASE_URL_DIRECT=postgres://user:pass@ep-cool-thing.region.aws.neon.tech/aegis?sslmode=require

# --- Hot metrics (Tinybird) -------------------------------------------------
# Get from https://app.tinybird.co (Build plan · free)
TINYBIRD_TOKEN=p.eyJ...
TINYBIRD_HOST=https://api.tinybird.co

# --- Object storage (Vercel Blob) -------------------------------------------
# Get from https://vercel.com/dashboard/stores (Hobby · 1 GB)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# --- Heavy ML inference (Hugging Face Spaces) -------------------------------
# Get from https://huggingface.co/settings/tokens (free)
HF_TOKEN=hf_...
HF_TOXICITY_SPACE_URL=https://syedwam7q-aegis-toxicity.hf.space
HF_DETECT_TEXT_SPACE_URL=https://syedwam7q-aegis-detect-text.hf.space

# --- LLM (Groq, free dev tier) ----------------------------------------------
# Get from https://console.groq.com/keys
GROQ_API_KEY=gsk_...
GROQ_MODEL_QUALITY=llama-3.3-70b-versatile
GROQ_MODEL_FAST=llama-3.1-8b-instant

# --- Inter-service auth (HMAC, generate locally) ----------------------------
# `openssl rand -hex 32`
INTER_SERVICE_HMAC_SECRET=

# --- Audit-log signing (HMAC, generate locally; rotates yearly) -------------
# `openssl rand -hex 64`
AUDIT_LOG_HMAC_SECRET=

# --- Operational toggles ----------------------------------------------------
EMERGENCY_STOP=false
NODE_ENV=development
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: document all environment variables in .env.example"
```

---

### Task 10: `packages/shared-py` with first Pydantic schemas

**Files:**
- Create: `packages/shared-py/pyproject.toml`
- Create: `packages/shared-py/src/aegis_shared/__init__.py`
- Create: `packages/shared-py/src/aegis_shared/types.py`
- Create: `packages/shared-py/src/aegis_shared/schemas.py`
- Create: `packages/shared-py/tests/__init__.py`
- Create: `packages/shared-py/tests/test_schemas.py`

- [ ] **Step 1: Create `packages/shared-py/pyproject.toml`**

```toml
[project]
name = "aegis-shared"
version = "0.1.0"
description = "Shared Pydantic schemas + audit-log primitives for Aegis"
requires-python = ">=3.13"
dependencies = [
  "pydantic>=2.10.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/aegis_shared"]
```

- [ ] **Step 2: Create `packages/shared-py/src/aegis_shared/__init__.py`** (initial — Task 11 expands this)

```python
"""Aegis shared schemas + audit-log primitives."""

from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity

__all__ = ["DecisionState", "ModelFamily", "RiskClass", "Role", "Severity"]
```

- [ ] **Step 3: Write the failing tests**

Create `packages/shared-py/tests/__init__.py` (empty file).

Create `packages/shared-py/tests/test_schemas.py`:

```python
"""Tests for the shared Pydantic schemas and type enums."""

import pytest

from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity


class TestSeverity:
    def test_severity_values(self) -> None:
        assert Severity.LOW.value == "LOW"
        assert Severity.MEDIUM.value == "MEDIUM"
        assert Severity.HIGH.value == "HIGH"
        assert Severity.CRITICAL.value == "CRITICAL"

    def test_severity_ordering(self) -> None:
        assert Severity.LOW < Severity.MEDIUM < Severity.HIGH < Severity.CRITICAL

    def test_severity_from_str_invalid(self) -> None:
        with pytest.raises(ValueError):
            Severity("UNKNOWN")


class TestDecisionState:
    def test_states(self) -> None:
        assert {s.value for s in DecisionState} == {
            "detected",
            "analyzed",
            "planned",
            "awaiting_approval",
            "executing",
            "evaluated",
        }


class TestRiskClass:
    def test_classes(self) -> None:
        assert {c.value for c in RiskClass} == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


class TestRole:
    def test_roles(self) -> None:
        assert {r.value for r in Role} == {"viewer", "operator", "admin"}


class TestModelFamily:
    def test_families(self) -> None:
        assert {f.value for f in ModelFamily} == {"tabular", "text"}
```

- [ ] **Step 4: Run the test, verify it fails**

Run: `uv run pytest packages/shared-py/tests/test_schemas.py -v`
Expected: `ModuleNotFoundError: No module named 'aegis_shared.types'` — confirms test correctly catches the absence.

- [ ] **Step 5: Implement `packages/shared-py/src/aegis_shared/types.py`**

```python
"""Type enums shared across Aegis services."""

from enum import StrEnum
from functools import total_ordering


@total_ordering
class Severity(StrEnum):
    """Severity of a detected signal or decision. Ordered LOW < MEDIUM < HIGH < CRITICAL."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

    @property
    def _ordinal(self) -> int:
        return {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}[self.value]

    def __lt__(self, other: object) -> bool:
        if not isinstance(other, Severity):
            return NotImplemented
        return self._ordinal < other._ordinal


class DecisionState(StrEnum):
    """The five durable states of a GovernanceDecision (plus awaiting_approval)."""

    DETECTED = "detected"
    ANALYZED = "analyzed"
    PLANNED = "planned"
    AWAITING_APPROVAL = "awaiting_approval"
    EXECUTING = "executing"
    EVALUATED = "evaluated"


class RiskClass(StrEnum):
    """Per-model and per-action risk classification."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Role(StrEnum):
    """RBAC roles enforced by control-plane and Clerk."""

    VIEWER = "viewer"
    OPERATOR = "operator"
    ADMIN = "admin"


class ModelFamily(StrEnum):
    """ML model family — drives which detection service handles the model."""

    TABULAR = "tabular"
    TEXT = "text"
```

- [ ] **Step 6: Create the placeholder schemas module** (concrete schemas land in later phases)

Create `packages/shared-py/src/aegis_shared/schemas.py`:

```python
"""Pydantic schemas for Aegis events, decisions, signals, and audit records.

This module is the single source of truth. `packages/shared-ts` is generated
from the JSON Schema produced here. Concrete schemas land in subsequent phases.
"""

from pydantic import BaseModel, ConfigDict


class AegisModel(BaseModel):
    """Base for all Aegis Pydantic models. Forbids extra fields and freezes instances."""

    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)
```

- [ ] **Step 7: Re-run the tests, verify they pass**

Run: `uv sync && uv run pytest packages/shared-py/tests/test_schemas.py -v`
Expected: 5 tests, all PASS.

- [ ] **Step 8: Verify ruff + pyright are clean**

Run: `uv run ruff check packages/shared-py && uv run pyright packages/shared-py`
Expected: both clean.

- [ ] **Step 9: Commit**

```bash
git add packages/shared-py/ uv.lock
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "feat(shared-py): add type enums and base Pydantic model"
```

---

### Task 11: Merkle-chained audit-log primitives in `shared-py`

**Files:**
- Create: `packages/shared-py/src/aegis_shared/audit.py`
- Create: `packages/shared-py/tests/test_audit.py`
- Modify: `packages/shared-py/src/aegis_shared/__init__.py`

- [ ] **Step 1: Write the failing test**

Create `packages/shared-py/tests/test_audit.py`:

```python
"""Tests for the Merkle-chained audit-log primitives."""

from datetime import datetime, timezone

import pytest

from aegis_shared.audit import (
    GENESIS_PREV_HASH,
    AuditRow,
    canonicalize_payload,
    compute_row_hash,
    sign_row,
    verify_chain,
    verify_signature,
)


def _ts(seconds: int) -> datetime:
    return datetime(2026, 4, 28, 12, 0, seconds, tzinfo=timezone.utc)


def _row(
    seq: int,
    *,
    prev_hash: str,
    secret: str = "test-secret",
    payload: dict[str, object] | None = None,
) -> AuditRow:
    p = payload or {"action": "test", "value": seq}
    canon = canonicalize_payload(p)
    ts = _ts(seq)
    h = compute_row_hash(
        prev_hash=prev_hash,
        canonical_payload=canon,
        ts=ts,
        actor="system:test",
        action="test",
        sequence_n=seq,
    )
    sig = sign_row(h, secret)
    return AuditRow(
        sequence_n=seq,
        ts=ts,
        actor="system:test",
        action="test",
        payload=p,
        prev_hash=prev_hash,
        row_hash=h,
        signature=sig,
    )


class TestCanonicalization:
    def test_canonical_form_is_deterministic(self) -> None:
        a = canonicalize_payload({"b": 1, "a": 2})
        b = canonicalize_payload({"a": 2, "b": 1})
        assert a == b

    def test_canonical_form_is_compact(self) -> None:
        c = canonicalize_payload({"a": 1, "b": [1, 2]})
        assert " " not in c


class TestRowHash:
    def test_genesis_prev_hash_is_64_zeros(self) -> None:
        assert GENESIS_PREV_HASH == "0" * 64

    def test_row_hash_is_64_hex_chars(self) -> None:
        h = compute_row_hash(
            prev_hash=GENESIS_PREV_HASH,
            canonical_payload='{"x":1}',
            ts=_ts(0),
            actor="system:test",
            action="genesis",
            sequence_n=1,
        )
        assert len(h) == 64
        assert all(ch in "0123456789abcdef" for ch in h)

    def test_row_hash_changes_with_any_field(self) -> None:
        base = dict(
            prev_hash=GENESIS_PREV_HASH,
            canonical_payload='{"x":1}',
            ts=_ts(0),
            actor="system:test",
            action="t",
            sequence_n=1,
        )
        h0 = compute_row_hash(**base)
        h1 = compute_row_hash(**{**base, "actor": "system:other"})
        h2 = compute_row_hash(**{**base, "action": "u"})
        h3 = compute_row_hash(**{**base, "sequence_n": 2})
        h4 = compute_row_hash(**{**base, "canonical_payload": '{"x":2}'})
        h5 = compute_row_hash(**{**base, "ts": _ts(1)})
        assert len({h0, h1, h2, h3, h4, h5}) == 6


class TestSignature:
    def test_sign_and_verify(self) -> None:
        sig = sign_row("a" * 64, "secret")
        assert verify_signature("a" * 64, sig, "secret") is True

    def test_verify_rejects_wrong_secret(self) -> None:
        sig = sign_row("a" * 64, "secret")
        assert verify_signature("a" * 64, sig, "other-secret") is False

    def test_verify_rejects_tampered_hash(self) -> None:
        sig = sign_row("a" * 64, "secret")
        assert verify_signature("b" * 64, sig, "secret") is False


class TestVerifyChain:
    def test_empty_chain_verifies(self) -> None:
        assert verify_chain([], secret="s") is True

    def test_single_row_chain_verifies(self) -> None:
        rows = [_row(1, prev_hash=GENESIS_PREV_HASH)]
        assert verify_chain(rows, secret="test-secret") is True

    def test_three_row_chain_verifies(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        r2 = _row(2, prev_hash=r1.row_hash)
        r3 = _row(3, prev_hash=r2.row_hash)
        assert verify_chain([r1, r2, r3], secret="test-secret") is True

    def test_broken_chain_rejected(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        r2 = _row(2, prev_hash=GENESIS_PREV_HASH)  # wrong: should point to r1
        assert verify_chain([r1, r2], secret="test-secret") is False

    def test_payload_tampering_rejected(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        r2 = _row(2, prev_hash=r1.row_hash)
        tampered = r2.model_copy(update={"payload": {"action": "EVIL"}})
        assert verify_chain([r1, tampered], secret="test-secret") is False

    def test_signature_tampering_rejected(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        bad = r1.model_copy(update={"signature": "deadbeef" * 8})
        assert verify_chain([bad], secret="test-secret") is False

    def test_wrong_starting_prev_hash_rejected(self) -> None:
        r1 = _row(1, prev_hash="f" * 64)
        assert verify_chain([r1], secret="test-secret") is False

    def test_non_sequential_sequence_n_rejected(self) -> None:
        r1 = _row(1, prev_hash=GENESIS_PREV_HASH)
        r2 = _row(3, prev_hash=r1.row_hash)
        assert verify_chain([r1, r2], secret="test-secret") is False


@pytest.mark.parametrize("n", [10, 100])
def test_long_chains_verify(n: int) -> None:
    rows: list[AuditRow] = []
    prev = GENESIS_PREV_HASH
    for i in range(1, n + 1):
        r = _row(i, prev_hash=prev)
        rows.append(r)
        prev = r.row_hash
    assert verify_chain(rows, secret="test-secret") is True
```

- [ ] **Step 2: Run, verify tests fail (module missing)**

Run: `uv run pytest packages/shared-py/tests/test_audit.py -v`
Expected: collection / import error confirming `audit` module is absent.

- [ ] **Step 3: Implement `packages/shared-py/src/aegis_shared/audit.py`**

```python
"""Merkle-chained audit-log primitives.

The audit log is the immutable, ordered ledger of every governance event.
Each row's hash is computed from its content + the previous row's hash,
making the chain tamper-evident. Each row is also HMAC-signed with the
server's secret for non-repudiation within the platform's trust boundary.

Invariants enforced here (and tested):
  1. Chain starts from GENESIS_PREV_HASH (64 hex zeros).
  2. row_hash = SHA256(prev_hash || canonical_payload || ts_iso || actor || action || sequence_n).
  3. signature = HMAC-SHA256(row_hash, secret).
  4. Sequence numbers are strictly increasing by 1.
  5. Each row's prev_hash equals the previous row's row_hash.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime
from typing import Any, Final

from pydantic import BaseModel, ConfigDict, Field

GENESIS_PREV_HASH: Final[str] = "0" * 64
"""The prev_hash for the very first audit row in a freshly-initialized chain."""


class AuditRow(BaseModel):
    """One row in the immutable, Merkle-chained audit log."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    sequence_n: int = Field(ge=1)
    ts: datetime
    actor: str = Field(min_length=1)
    action: str = Field(min_length=1)
    payload: dict[str, Any]
    prev_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    row_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    signature: str = Field(pattern=r"^[0-9a-f]{64}$")


def canonicalize_payload(payload: dict[str, Any]) -> str:
    """Deterministic JSON encoding: sorted keys, no whitespace, no NaN/Inf."""

    return json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)


def compute_row_hash(
    *,
    prev_hash: str,
    canonical_payload: str,
    ts: datetime,
    actor: str,
    action: str,
    sequence_n: int,
) -> str:
    """SHA-256 hash of the row's content concatenated with the previous row's hash."""

    h = hashlib.sha256()
    h.update(prev_hash.encode("ascii"))
    h.update(b"\x00")
    h.update(canonical_payload.encode("utf-8"))
    h.update(b"\x00")
    h.update(ts.isoformat().encode("ascii"))
    h.update(b"\x00")
    h.update(actor.encode("utf-8"))
    h.update(b"\x00")
    h.update(action.encode("utf-8"))
    h.update(b"\x00")
    h.update(str(sequence_n).encode("ascii"))
    return h.hexdigest()


def sign_row(row_hash: str, secret: str) -> str:
    """HMAC-SHA256 signature of the row hash, hex-encoded."""

    return hmac.new(secret.encode("utf-8"), row_hash.encode("ascii"), hashlib.sha256).hexdigest()


def verify_signature(row_hash: str, signature: str, secret: str) -> bool:
    """Constant-time check that the signature matches HMAC(row_hash, secret)."""

    expected = sign_row(row_hash, secret)
    return hmac.compare_digest(expected, signature)


def verify_chain(rows: list[AuditRow], *, secret: str) -> bool:
    """Verify a chain end-to-end: order, prev_hash links, recomputed row_hashes, signatures."""

    if not rows:
        return True

    expected_seq = rows[0].sequence_n
    if expected_seq < 1:
        return False
    if expected_seq == 1 and rows[0].prev_hash != GENESIS_PREV_HASH:
        return False

    prev_hash = rows[0].prev_hash if expected_seq > 1 else GENESIS_PREV_HASH

    for row in rows:
        if row.sequence_n != expected_seq:
            return False
        if row.prev_hash != prev_hash:
            return False

        recomputed = compute_row_hash(
            prev_hash=row.prev_hash,
            canonical_payload=canonicalize_payload(row.payload),
            ts=row.ts,
            actor=row.actor,
            action=row.action,
            sequence_n=row.sequence_n,
        )
        if recomputed != row.row_hash:
            return False
        if not verify_signature(row.row_hash, row.signature, secret):
            return False

        prev_hash = row.row_hash
        expected_seq += 1

    return True
```

- [ ] **Step 4: Update `__init__.py` to re-export the audit primitives**

Replace `packages/shared-py/src/aegis_shared/__init__.py` with:

```python
"""Aegis shared schemas + audit-log primitives."""

from aegis_shared.audit import (
    GENESIS_PREV_HASH,
    AuditRow,
    canonicalize_payload,
    compute_row_hash,
    sign_row,
    verify_chain,
    verify_signature,
)
from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity

__all__ = [
    "AuditRow",
    "DecisionState",
    "GENESIS_PREV_HASH",
    "ModelFamily",
    "RiskClass",
    "Role",
    "Severity",
    "canonicalize_payload",
    "compute_row_hash",
    "sign_row",
    "verify_chain",
    "verify_signature",
]
```

- [ ] **Step 5: Run tests, verify all PASS**

Run: `uv run pytest packages/shared-py/tests/ -v`
Expected: every test PASSes (audit + schemas).

- [ ] **Step 6: Verify ruff + pyright stay clean**

Run: `uv run ruff check packages/shared-py && uv run pyright packages/shared-py`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-py/
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "feat(shared-py): Merkle-chained audit-log primitives with full verification"
```

---

### Task 12: `packages/shared-ts` — TypeScript types generated from `shared-py`

**Files:**
- Create: `packages/shared-ts/package.json`
- Create: `packages/shared-ts/tsconfig.json`
- Create: `packages/shared-ts/scripts/generate.ts`
- Create: `packages/shared-ts/src/index.ts` (generated)
- Create: `packages/shared-ts/tests/index.test.ts`

- [ ] **Step 1: Create `packages/shared-ts/package.json`**

```json
{
  "name": "@aegis/shared-ts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "tsx scripts/generate.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "eslint scripts src tests"
  },
  "dependencies": {
    "json-schema-to-typescript": "^15.0.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared-ts/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "composite": true,
    "noEmit": false
  },
  "include": ["src/**/*", "scripts/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Install workspace deps**

Run: `pnpm install`
Expected: success.

- [ ] **Step 4: Create the generator script**

Create `packages/shared-ts/scripts/generate.ts`:

```typescript
/**
 * Generates `src/index.ts` from JSON Schemas exported by aegis-shared (Python).
 *
 * Approach: invoke `uv run python -c "..."` (via `execFileSync`, no shell)
 * to import each Pydantic model and call `Model.model_json_schema()`,
 * write the schemas to a temp file, then run `compileFromFile` from
 * json-schema-to-typescript over the file.
 *
 * For Phase 0 the only exported schema is `AuditRow`; subsequent phases will
 * add more (drift signal, decision, etc.). The script emits a banner so the
 * generated file is never hand-edited.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "json-schema-to-typescript";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(PKG_DIR, "..", "..");
const OUT = resolve(PKG_DIR, "src", "index.ts");

const PY_EXPORT = `
import json
from aegis_shared.audit import AuditRow

schemas = {"AuditRow": AuditRow.model_json_schema()}
print(json.dumps(schemas, indent=2))
`;

function exportSchemas(): Record<string, unknown> {
  // execFileSync — no shell, no injection surface, fixed argv.
  const out = execFileSync("uv", ["run", "python", "-c", PY_EXPORT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return JSON.parse(out) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const schemas = exportSchemas();
  const banner =
    "/* eslint-disable */\n" +
    "// AUTO-GENERATED FILE — do not edit.\n" +
    "// Source of truth: packages/shared-py/src/aegis_shared/\n" +
    "// Regenerate with: pnpm --filter @aegis/shared-ts generate\n";

  let out = banner + "\n";
  for (const [name, schema] of Object.entries(schemas)) {
    const ts = await compile(schema as Parameters<typeof compile>[0], name, {
      bannerComment: "",
      style: { semi: true, singleQuote: false, printWidth: 100 },
    });
    out += ts + "\n";
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out, "utf8");
  console.log("✓ wrote", OUT);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Generate the initial TS bindings**

Run: `pnpm --filter @aegis/shared-ts generate`
Expected: `✓ wrote .../packages/shared-ts/src/index.ts`. The file now contains a TypeScript `AuditRow` interface.

- [ ] **Step 6: Write a contract test**

Create `packages/shared-ts/tests/index.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import * as shared from "../src/index.js";

describe("shared-ts generated contract", () => {
  it("exports AuditRow type (compile-time check)", () => {
    type Row = shared.AuditRow;
    const fake: Row = {
      sequence_n: 1,
      ts: "2026-04-28T12:00:00Z",
      actor: "system:test",
      action: "test",
      payload: {},
      prev_hash: "0".repeat(64),
      row_hash: "f".repeat(64),
      signature: "a".repeat(64),
    };
    expect(fake.sequence_n).toBe(1);
  });
});
```

- [ ] **Step 7: Run tests, verify pass**

Run: `pnpm --filter @aegis/shared-ts test`
Expected: 1 test PASS.

- [ ] **Step 8: Verify typecheck**

Run: `pnpm --filter @aegis/shared-ts typecheck`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add packages/shared-ts/ pnpm-lock.yaml
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "feat(shared-ts): generate TypeScript types from shared-py JSON Schema"
```

---

### Task 13: `packages/ui` scaffolding

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/lib/cn.ts`
- Create: `packages/ui/src/lib/cn.test.ts`

- [ ] **Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@aegis/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./lib/cn": "./src/lib/cn.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "composite": true,
    "noEmit": false,
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Install deps**

Run: `pnpm install`
Expected: success.

- [ ] **Step 4: Write the failing test for `cn`**

Create `packages/ui/src/lib/cn.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("merges conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-base")).toBe("text-base");
  });

  it("dedupes equivalent classes", () => {
    expect(cn("p-2", "p-2")).toBe("p-2");
  });
});
```

- [ ] **Step 5: Run, verify fail**

Run: `pnpm --filter @aegis/ui test`
Expected: FAIL — cannot find module `./cn`.

- [ ] **Step 6: Implement `packages/ui/src/lib/cn.ts`**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Composes class names with Tailwind-aware conflict resolution.
 * Used by every component in @aegis/ui.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Create the package barrel**

Create `packages/ui/src/index.ts`:

```typescript
export { cn } from "./lib/cn.js";
```

- [ ] **Step 8: Run tests, verify pass**

Run: `pnpm --filter @aegis/ui test`
Expected: 4 tests PASS.

- [ ] **Step 9: Verify typecheck**

Run: `pnpm --filter @aegis/ui typecheck`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/ pnpm-lock.yaml
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "feat(ui): scaffold shared component package with cn() utility"
```

---

### Task 14: GitHub Actions workflows (CI baseline)

**Files:**
- Create: `.github/workflows/pr.yml`
- Create: `.github/workflows/setup-validator.yml`
- Create: `.github/workflows/chain-anchor.yml`

- [ ] **Step 1: Create `.github/workflows/pr.yml`**

```yaml
name: PR

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: pr-${{ github.ref }}
  cancel-in-progress: true

jobs:
  js:
    name: JS · lint + typecheck + test
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
      - uses: astral-sh/setup-uv@v4
        with:
          enable-cache: true
      - run: pnpm install --frozen-lockfile
      - run: uv sync --frozen
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm --filter @aegis/shared-ts generate
      - run: pnpm typecheck
      - run: pnpm test

  python:
    name: Python · lint + typecheck + test
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
      - uses: astral-sh/setup-uv@v4
        with:
          enable-cache: true
      - run: uv sync --frozen
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run pyright
      - run: uv run pytest -v
```

- [ ] **Step 2: Create `.github/workflows/setup-validator.yml`**

```yaml
name: Setup validator (nightly)

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

jobs:
  replay-setup-md:
    name: Replay setup.md in a fresh container
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - name: Run the prerequisite-install commands from setup.md
        run: |
          awk '/^<!-- setup-md-validator:start -->/,/^<!-- setup-md-validator:end -->/' setup.md \
            | grep -v "setup-md-validator" \
            > /tmp/validator-block.sh
          bash -euxo pipefail /tmp/validator-block.sh
```

- [ ] **Step 3: Create `.github/workflows/chain-anchor.yml`**

```yaml
name: Audit-log chain anchor (daily)

on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:

jobs:
  anchor:
    name: Post latest audit-log row_hash to public artifact
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - name: Note — wired up in Phase 2 (control-plane + Postgres)
        run: |
          echo "Aegis audit-log chain anchor placeholder."
          echo "Will fetch the latest row_hash from Postgres and write it to"
          echo "an Actions artifact once the control-plane lands in Phase 2."
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "ci: add PR, setup-validator, and chain-anchor workflows"
```

---

### Task 15: Directory placeholders for future phases

**Files:**
- Create: `.gitkeep` files inside the planned-but-empty directories

- [ ] **Step 1: Create directories and `.gitkeep` files**

Run:

```bash
mkdir -p apps/dashboard apps/landing \
         services/control-plane services/detect-tabular services/detect-text \
         services/causal-attrib services/action-selector services/assistant \
         services/inference-credit services/inference-readmission services/inference-toxicity \
         workflows ml-pipelines/credit ml-pipelines/readmission ml-pipelines/toxicity \
         data infra/tinybird infra/vercel \
         tests/safety tests/scenarios tests/property tests/e2e \
         docs/paper docs/compliance

touch apps/dashboard/.gitkeep apps/landing/.gitkeep \
      services/control-plane/.gitkeep services/detect-tabular/.gitkeep services/detect-text/.gitkeep \
      services/causal-attrib/.gitkeep services/action-selector/.gitkeep services/assistant/.gitkeep \
      services/inference-credit/.gitkeep services/inference-readmission/.gitkeep services/inference-toxicity/.gitkeep \
      workflows/.gitkeep ml-pipelines/.gitkeep data/.gitkeep infra/.gitkeep \
      tests/safety/.gitkeep tests/scenarios/.gitkeep tests/property/.gitkeep tests/e2e/.gitkeep \
      docs/paper/.gitkeep docs/compliance/.gitkeep
```

- [ ] **Step 2: Verify nothing gitignored snuck in**

Run: `git status --short`
Expected: only the new `.gitkeep` files; no `__pycache__`, no `.venv`, no `node_modules`.

- [ ] **Step 3: Commit**

```bash
git add apps/ services/ workflows/ ml-pipelines/ data/ infra/ tests/ docs/paper docs/compliance
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: scaffold directory layout for upcoming phases"
```

---

### Task 16: `vercel.ts` typed project config

**Files:**
- Create: `vercel.ts`
- Modify: `package.json` (adds `@vercel/config` dev dep)

- [ ] **Step 1: Add `@vercel/config` dev dep**

Run: `pnpm add -Dw @vercel/config@latest`

- [ ] **Step 2: Create `vercel.ts`**

```typescript
import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm turbo build",
  framework: "nextjs",
  outputDirectory: "apps/dashboard/.next",
  ignoreCommand: "git diff HEAD^ HEAD --quiet -- apps/dashboard packages/",
  crons: [],
  rewrites: [],
  redirects: [],
  headers: [],
};

export default config;
```

- [ ] **Step 3: Commit**

```bash
git add vercel.ts package.json pnpm-lock.yaml
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "chore: add typed vercel.ts project config"
```

---

### Task 17: Initial `setup.md`

**Files:**
- Create: `setup.md`

- [ ] **Step 1: Write `setup.md`**

```markdown
# Aegis · setup

Step-by-step installation, environment configuration, and run instructions. The "Prerequisites" block is verbatim-replayed nightly by `.github/workflows/setup-validator.yml` in a clean Ubuntu container — if it breaks, CI fails. Keep it accurate.

## Prerequisites

Tested on Ubuntu 24.04 LTS and macOS 14+.

<!-- setup-md-validator:start -->
# Node.js 22 + pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm@9.15.0

# Python 3.13 + uv
sudo apt-get install -y python3.13 python3.13-venv
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# Project dependencies
pnpm install --frozen-lockfile
uv sync --frozen

# Verify everything is wired up
pnpm format:check
pnpm lint
uv run ruff check .
uv run pyright
uv run pytest -v
pnpm --filter @aegis/shared-ts generate
pnpm typecheck
pnpm test
<!-- setup-md-validator:end -->

## Local environment

1. Copy `.env.example` to `.env`:

       cp .env.example .env

2. Fill in the values for each section. The relevant signup pages and free-tier confirmations are documented next to each variable in `.env.example`. None of the services require a paid plan.

3. Generate the two HMAC secrets:

       openssl rand -hex 32   # → INTER_SERVICE_HMAC_SECRET
       openssl rand -hex 64   # → AUDIT_LOG_HMAC_SECRET

## Run

Phase 0 has no runnable services yet — only the shared packages, tests, and CI scaffolding. Subsequent phases each add their own run instructions to this section.

## Test

    pnpm test          # vitest across @aegis/shared-ts and @aegis/ui
    uv run pytest -v   # pytest across packages/shared-py and tests/

## Deploy

Deployment to Vercel + Hugging Face Spaces lands in Phase 2 (control plane) and Phase 4 (dashboard).
```

- [ ] **Step 2: Commit**

```bash
git add setup.md
git -c user.name="syedwam7q" -c user.email="engg@airtribe.live" -c commit.gpgsign=false commit -m "docs: add initial setup.md (CI-validated nightly)"
```

---

### Task 18: Phase 0 verification + push

- [ ] **Step 1: Run the full local CI replay**

Run, in order:

```bash
pnpm install --frozen-lockfile
uv sync --frozen
pnpm format:check
pnpm lint
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest -v
pnpm --filter @aegis/shared-ts generate
pnpm typecheck
pnpm test
```

Expected: every command exits 0. If anything fails, fix it before pushing.

- [ ] **Step 2: Push to GitHub**

Run: `git push origin main`
Expected: success.

- [ ] **Step 3: Verify the PR workflow runs green on GitHub**

Open `https://github.com/syedwam7q/gov-ml/actions` and confirm the latest run is green.

- [ ] **Step 4: Tag the phase boundary**

```bash
git tag -a phase-0-complete -m "Phase 0 — repo scaffolding complete"
git push origin phase-0-complete
```

---

## Self-review

**Spec coverage** (each cited spec section gets a Phase 0 task):

| Spec § | Requirement | Task |
| --- | --- | --- |
| 4.1 | Repo monorepo layout | 2, 3, 4, 15 |
| 4.4 | Shared schemas, schema-is-law discipline, single-writer audit-log writer | 10, 11, 12 |
| 6.2 | Merkle audit-log invariants (chain, HMAC, daily anchor) | 11, 14 (chain-anchor placeholder) |
| 8.7 | CI organization (pr.yml, setup-validator.yml, chain-anchor.yml) | 14 |
| 13 (Phase 0) | "Repo scaffolding, Turborepo + uv workspace, CI baseline, setup.md v0.1, vercel.ts" | 1–18 |
| 13 (deliverable: setup.md CI-validated) | nightly replay of setup.md | 14, 17 |

**Placeholder scan:** No `TBD`/`TODO`/`fill in details` strings; no `Add appropriate error handling` style instructions; no "similar to Task N" references — every task contains complete code.

**Type consistency:** `AuditRow`, `Severity`, `DecisionState`, `RiskClass`, `Role`, `ModelFamily` defined in Task 10/11 are referenced in Task 12 (TypeScript generation); the generated TS file is tested in Task 12 Step 6.

**Scope check:** Phase 0 produces a self-contained, working, testable artifact: a green-CI monorepo with shared packages, no runnable services. Subsequent phases each get their own plan.

---

## What lands in Phase 1 (next plan)

ML pipelines + 3 trained models with cards/datasheets:
- `ml-pipelines/credit/` — XGBoost on HMDA / Lending Club; Mitchell 2019 model card; Gebru 2021 datasheet.
- `ml-pipelines/readmission/` — XGBoost on Diabetes 130-US (UCI); model card + datasheet.
- `ml-pipelines/toxicity/` — DistilBERT fine-tune on Jigsaw Civil Comments; model card + datasheet.
- `data/` — download scripts (.gitignored payloads); SHA-pinned dataset versions.
- Per-model causal DAG specs (loaded by causal-attrib in Phase 5).
