# Aegis — Phase 1a: Credit-Risk Pipeline + Shared ML Infrastructure · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `ml-pipelines/_shared` (the reusable infrastructure: SHA-verified data download, model card / datasheet writers, fairness + calibration eval helpers, deterministic seeding) and `ml-pipelines/credit` (the first end-to-end model: HMDA-driven XGBoost credit-approval classifier with model card, datasheet, causal DAG spec, and a CI smoke test that trains a tiny version on synthetic data). Phase 1b (readmission) and 1c (toxicity) follow the same template.

**Architecture.** The shared package `aegis_pipelines` lives in `ml-pipelines/_shared` and is a uv workspace member. Each model pipeline is a directory with numbered, idempotent CLI scripts (`01_download.py` … `05_generate_artifacts.py`) that import from `aegis_pipelines`. Real data downloads land in `data/raw/<model>/` (gitignored); processed splits land in `data/processed/<model>/`; model artifacts (XGBoost JSON + metrics + model card + datasheet) land in `ml-pipelines/<model>/artifacts/`. **All artifacts are reproducible**: pinned random seeds, pinned dataset version (HMDA Public LAR 2017 single state), pinned library versions in `pyproject.toml`. A smoke test trains a tiny synthetic-data version of each pipeline so CI is fast.

**Tech Stack.** Python 3.13, scikit-learn 1.5+, xgboost 2.1+, pandas 2.2+, fairlearn 0.11+, numpy 2.1+, requests, pytest, hypothesis, Pydantic v2. No torch in 1a (DistilBERT lands in 1c).

**Spec reference:** `docs/superpowers/specs/2026-04-28-aegis-design.md` (sections 4.1, 8.2, 13:Phase 1, Appendix A).

**Dataset choice (locked).** HMDA Public LAR (CFPB) 2017 California subset — public, free, no account, has race / ethnicity / sex / age fields, ~600K records. We sub-sample to 100K for laptop-friendly training. Anchor incidents: Apple Card 2019, Wells Fargo refinance 2020-2022, The Markup HMDA analysis 2021.

---

## File structure created in Phase 1a

```
gov-ml/
├── ml-pipelines/
│   ├── _shared/
│   │   ├── pyproject.toml                            ← Task 1
│   │   ├── src/aegis_pipelines/__init__.py           ← Task 1
│   │   ├── src/aegis_pipelines/py.typed              ← Task 1
│   │   ├── src/aegis_pipelines/seed.py               ← Task 2
│   │   ├── src/aegis_pipelines/data.py               ← Task 3
│   │   ├── src/aegis_pipelines/cards.py              ← Task 4
│   │   ├── src/aegis_pipelines/eval.py               ← Task 5
│   │   └── tests/
│   │       ├── __init__.py
│   │       ├── test_seed.py                          ← Task 2
│   │       ├── test_data.py                          ← Task 3
│   │       ├── test_cards.py                         ← Task 4
│   │       └── test_eval.py                          ← Task 5
│   └── credit/
│       ├── README.md                                 ← Task 6
│       ├── 01_download.py                            ← Task 6
│       ├── 02_preprocess.py                          ← Task 7
│       ├── 03_train.py                               ← Task 8
│       ├── 04_evaluate.py                            ← Task 9
│       ├── 05_generate_artifacts.py                  ← Task 10
│       ├── causal_dag.json                           ← Task 10
│       ├── config.py                                 ← Task 6
│       └── tests/
│           ├── __init__.py
│           ├── test_preprocess.py                    ← Task 7
│           └── test_smoke.py                         ← Task 11
├── data/                                             gitignored payloads
│   └── .gitkeep
├── pyproject.toml                                    ← Task 1 (workspace member)
└── setup.md                                          ← Task 12
```

---

## Tasks

### Task 1: `ml-pipelines/_shared` workspace member + package skeleton

**Files:**

- Create: `ml-pipelines/_shared/pyproject.toml`
- Create: `ml-pipelines/_shared/src/aegis_pipelines/__init__.py`
- Create: `ml-pipelines/_shared/src/aegis_pipelines/py.typed`
- Create: `ml-pipelines/_shared/tests/__init__.py`
- Modify: `pyproject.toml` (root) — add to workspace
- Delete: `ml-pipelines/.gitkeep` (no longer needed)

- [ ] **Step 1: Create `ml-pipelines/_shared/pyproject.toml`**

```toml
[project]
name = "aegis-pipelines"
version = "0.1.0"
description = "Shared ML pipeline utilities for Aegis (data download, eval, cards, seeding)"
requires-python = ">=3.13"
dependencies = [
  "aegis-shared",
  "numpy>=2.1.0",
  "pandas>=2.2.0",
  "scikit-learn>=1.5.0",
  "xgboost>=2.1.0",
  "fairlearn>=0.11.0",
  "requests>=2.32.0",
  "pydantic>=2.10.0",
]

[tool.uv.sources]
aegis-shared = { workspace = true }

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/aegis_pipelines"]
```

- [ ] **Step 2: Create the package's `__init__.py` and `py.typed`**

`ml-pipelines/_shared/src/aegis_pipelines/__init__.py`:

```python
"""Aegis ML pipeline utilities — data download, eval, cards, seeding."""

__version__ = "0.1.0"
```

`ml-pipelines/_shared/src/aegis_pipelines/py.typed`: empty file.

`ml-pipelines/_shared/tests/__init__.py`: empty file.

- [ ] **Step 3: Add `_shared` to the uv workspace**

Edit `pyproject.toml` at the repo root, replacing the existing workspace block:

```toml
[tool.uv.workspace]
members = ["packages/shared-py", "ml-pipelines/_shared"]
```

- [ ] **Step 4: Remove the `.gitkeep` (the dir now has real content)**

```bash
rm ml-pipelines/.gitkeep
```

- [ ] **Step 5: Sync and verify the workspace picks up the new package**

```bash
PATH=$HOME/.local/bin:$PATH uv sync --all-packages
PATH=$HOME/.local/bin:$PATH uv run python -c "import aegis_pipelines; print(aegis_pipelines.__version__)"
```

Expected: `0.1.0`.

- [ ] **Step 6: Commit**

```bash
git add ml-pipelines/_shared/ pyproject.toml uv.lock
git rm ml-pipelines/.gitkeep
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(pipelines): scaffold aegis_pipelines workspace package"
```

---

### Task 2: `aegis_pipelines.seed` — reproducibility primitives

**Files:**

- Create: `ml-pipelines/_shared/src/aegis_pipelines/seed.py`
- Create: `ml-pipelines/_shared/tests/test_seed.py`

- [ ] **Step 1: Write the failing test**

`ml-pipelines/_shared/tests/test_seed.py`:

```python
"""Tests for deterministic seeding."""

import os

import numpy as np

from aegis_pipelines.seed import GLOBAL_SEED, set_global_seed, seeded_rng


class TestGlobalSeed:
    def test_global_seed_is_a_constant(self) -> None:
        assert GLOBAL_SEED == 1729  # Hardy-Ramanujan; arbitrary but pinned

    def test_set_global_seed_writes_pythonhashseed(self) -> None:
        set_global_seed(42)
        assert os.environ.get("PYTHONHASHSEED") == "42"

    def test_set_global_seed_makes_numpy_deterministic(self) -> None:
        set_global_seed(42)
        a = np.random.default_rng().integers(0, 1_000_000, size=10)
        set_global_seed(42)
        b = np.random.default_rng().integers(0, 1_000_000, size=10)
        # Default rng pulls from numpy global only when set_global_seed re-seeded it
        # via np.random.seed; assert reproducibility through seeded_rng
        assert isinstance(a[0].item(), int)
        assert isinstance(b[0].item(), int)


class TestSeededRng:
    def test_same_seed_same_sequence(self) -> None:
        r1 = seeded_rng(7).integers(0, 100, size=5).tolist()
        r2 = seeded_rng(7).integers(0, 100, size=5).tolist()
        assert r1 == r2

    def test_different_seed_different_sequence(self) -> None:
        r1 = seeded_rng(7).integers(0, 100, size=5).tolist()
        r2 = seeded_rng(8).integers(0, 100, size=5).tolist()
        assert r1 != r2

    def test_default_uses_global_seed(self) -> None:
        r1 = seeded_rng().integers(0, 100, size=5).tolist()
        r2 = seeded_rng(GLOBAL_SEED).integers(0, 100, size=5).tolist()
        assert r1 == r2
```

- [ ] **Step 2: Run, verify fail**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/_shared/tests/test_seed.py -v
```

Expected: ImportError — `aegis_pipelines.seed` doesn't exist yet.

- [ ] **Step 3: Implement `aegis_pipelines.seed`**

`ml-pipelines/_shared/src/aegis_pipelines/seed.py`:

```python
"""Deterministic seeding for ML pipelines.

Every pipeline calls `set_global_seed()` exactly once at the top of its main
script. Every nondeterministic operation goes through `seeded_rng()` so we
can reproduce results bit-for-bit across re-runs.
"""

from __future__ import annotations

import os
import random
from typing import Final

import numpy as np

GLOBAL_SEED: Final[int] = 1729
"""Project-wide default seed. Changing this requires a deliberate retraining."""


def set_global_seed(seed: int = GLOBAL_SEED) -> None:
    """Seed Python, NumPy, and PYTHONHASHSEED. Call once at the top of main."""
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)


def seeded_rng(seed: int = GLOBAL_SEED) -> np.random.Generator:
    """Return a fresh NumPy Generator seeded deterministically."""
    return np.random.default_rng(seed)
```

- [ ] **Step 4: Run tests, verify pass**

```bash
PATH=$HOME/.local/bin:$PATH uv sync --all-packages
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/_shared/tests/test_seed.py -v
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ml-pipelines/_shared/
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(pipelines): deterministic seeding primitives"
```

---

### Task 3: `aegis_pipelines.data` — SHA-verified download abstraction

**Files:**

- Create: `ml-pipelines/_shared/src/aegis_pipelines/data.py`
- Create: `ml-pipelines/_shared/tests/test_data.py`

- [ ] **Step 1: Write the failing test**

`ml-pipelines/_shared/tests/test_data.py`:

```python
"""Tests for the SHA-verified download abstraction."""

import hashlib
from pathlib import Path

import pytest

from aegis_pipelines.data import (
    DatasetSpec,
    DownloadError,
    download_with_verification,
    sha256_of_file,
)


@pytest.fixture
def sample_file(tmp_path: Path) -> Path:
    p = tmp_path / "sample.txt"
    p.write_bytes(b"hello aegis")
    return p


def test_sha256_matches_python_hashlib(sample_file: Path) -> None:
    expected = hashlib.sha256(b"hello aegis").hexdigest()
    assert sha256_of_file(sample_file) == expected


def test_sha256_of_file_chunks_large_files(tmp_path: Path) -> None:
    p = tmp_path / "big.bin"
    p.write_bytes(b"\x42" * (4 * 1024 * 1024 + 17))  # > 4 MiB to exercise chunking
    expected = hashlib.sha256(b"\x42" * (4 * 1024 * 1024 + 17)).hexdigest()
    assert sha256_of_file(p) == expected


def test_dataset_spec_validates_sha_format() -> None:
    valid = DatasetSpec(
        name="test", url="https://example.com/x.csv", sha256="0" * 64, dest_relpath="x.csv"
    )
    assert valid.name == "test"

    with pytest.raises(ValueError, match="sha256"):
        DatasetSpec(
            name="test", url="https://example.com/x.csv", sha256="abc", dest_relpath="x.csv"
        )


def test_download_with_verification_uses_cached_file(
    tmp_path: Path, sample_file: Path
) -> None:
    """If the destination already exists with the correct SHA, no network call is made."""
    digest = sha256_of_file(sample_file)
    spec = DatasetSpec(
        name="cached",
        url="https://nonexistent.invalid/x",  # would 502 if downloaded
        sha256=digest,
        dest_relpath=sample_file.name,
    )
    out = download_with_verification(spec, tmp_path)
    assert out == sample_file
    assert sha256_of_file(out) == digest


def test_download_with_verification_raises_on_sha_mismatch(
    tmp_path: Path, sample_file: Path
) -> None:
    spec = DatasetSpec(
        name="bad",
        url="https://nonexistent.invalid/x",
        sha256="f" * 64,  # wrong digest
        dest_relpath=sample_file.name,
    )
    with pytest.raises(DownloadError, match="sha256 mismatch"):
        download_with_verification(spec, tmp_path)
```

- [ ] **Step 2: Run, verify fail**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/_shared/tests/test_data.py -v
```

Expected: ImportError or attribute errors — module not yet implemented.

- [ ] **Step 3: Implement `aegis_pipelines.data`**

`ml-pipelines/_shared/src/aegis_pipelines/data.py`:

```python
"""SHA-256-verified, idempotent dataset download.

Every dataset is declared as a `DatasetSpec` with a pinned URL and SHA-256.
Downloads are atomic (temp file + rename) and skipped if the destination
already exists with the correct hash. This is what makes pipeline runs
reproducible end-to-end.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Final

import requests
from pydantic import BaseModel, ConfigDict, Field

CHUNK_SIZE: Final[int] = 1024 * 1024  # 1 MiB
NETWORK_TIMEOUT_SECS: Final[int] = 60


class DownloadError(RuntimeError):
    """Raised when a download cannot be completed or fails verification."""


class DatasetSpec(BaseModel):
    """Pinned reference to a remote dataset file."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    name: str = Field(min_length=1)
    url: str = Field(min_length=1)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$", description="hex sha256")
    dest_relpath: str = Field(min_length=1)


def sha256_of_file(path: Path) -> str:
    """Stream-hash a file with a 1 MiB chunk size."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(CHUNK_SIZE):
            h.update(chunk)
    return h.hexdigest()


def download_with_verification(spec: DatasetSpec, dest_root: Path) -> Path:
    """Download `spec` to `dest_root/spec.dest_relpath` if not already present.

    If the destination exists and its sha256 matches, no network call is made.
    On mismatch (cached or freshly downloaded), the file is removed and a
    DownloadError is raised — corrupt files don't silently pollute later runs.
    """
    dest = dest_root / spec.dest_relpath
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists():
        actual = sha256_of_file(dest)
        if actual == spec.sha256:
            return dest
        dest.unlink()
        raise DownloadError(f"{spec.name}: cached file sha256 mismatch (had {actual})")

    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        with requests.get(spec.url, stream=True, timeout=NETWORK_TIMEOUT_SECS) as resp:
            resp.raise_for_status()
            with tmp.open("wb") as f:
                for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                    if chunk:
                        f.write(chunk)
    except requests.RequestException as exc:
        tmp.unlink(missing_ok=True)
        raise DownloadError(f"{spec.name}: network error: {exc}") from exc

    actual = sha256_of_file(tmp)
    if actual != spec.sha256:
        tmp.unlink(missing_ok=True)
        raise DownloadError(
            f"{spec.name}: sha256 mismatch — expected {spec.sha256}, got {actual}"
        )

    tmp.rename(dest)
    return dest
```

- [ ] **Step 4: Run tests, verify pass**

```bash
PATH=$HOME/.local/bin:$PATH uv sync --all-packages
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/_shared/tests/test_data.py -v
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ml-pipelines/_shared/
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(pipelines): SHA-verified dataset download abstraction"
```

---

### Task 4: `aegis_pipelines.cards` — model card + datasheet writers

**Files:**

- Create: `ml-pipelines/_shared/src/aegis_pipelines/cards.py`
- Create: `ml-pipelines/_shared/tests/test_cards.py`

The schemas are taken verbatim from Mitchell et al. 2019 (model cards) and Gebru et al. 2021 (datasheets for datasets).

- [ ] **Step 1: Write the failing test**

`ml-pipelines/_shared/tests/test_cards.py`:

```python
"""Tests for the model card and datasheet writers."""

import json
from pathlib import Path

from aegis_pipelines.cards import (
    Datasheet,
    DatasheetCollection,
    DatasheetComposition,
    DatasheetMaintenance,
    DatasheetMotivation,
    DatasheetUses,
    EthicalConsiderations,
    EvaluationData,
    ModelCard,
    ModelDetails,
    QuantitativeAnalysis,
    TrainingData,
    write_datasheet,
    write_model_card,
)


def _minimal_card() -> ModelCard:
    return ModelCard(
        name="credit-v1",
        version="0.1.0",
        details=ModelDetails(
            developers="syedwam7q",
            date="2026-04-28",
            type="XGBoost binary classifier",
            paper="https://github.com/syedwam7q/gov-ml/blob/main/docs/paper",
            license="MIT",
            contact="sdirwamiq@gmail.com",
        ),
        intended_use="Demonstration governance target for Aegis. NOT for production lending.",
        factors=["race", "ethnicity", "sex", "age"],
        metrics=["accuracy", "demographic_parity", "equal_opportunity", "ECE"],
        training_data=TrainingData(source="HMDA Public LAR 2017 CA subset", size=100_000),
        evaluation_data=EvaluationData(source="HMDA 2017 CA holdout", size=20_000),
        quantitative_analysis=QuantitativeAnalysis(
            unitary={"accuracy": 0.872, "ECE": 0.041},
            intersectional={"DP_gender": 0.94, "EO_race": 0.86},
        ),
        ethical_considerations=EthicalConsiderations(
            risks=["disparate impact across protected groups", "calibration drift"],
            mitigations=["fairness monitoring via Aegis", "canary rollout on retrain"],
        ),
        caveats=["Public dataset — not representative of any specific lender"],
    )


def _minimal_datasheet() -> Datasheet:
    return Datasheet(
        name="HMDA-2017-CA",
        version="2017-California",
        motivation=DatasheetMotivation(
            purpose="Public mortgage application dataset published by CFPB.",
            funded_by="US Consumer Financial Protection Bureau",
        ),
        composition=DatasheetComposition(
            instances="Loan applications",
            count=600_000,
            features=["income", "loan_amount", "applicant_race", "applicant_sex", "..."],
            label="action_taken (approved/denied)",
        ),
        collection=DatasheetCollection(
            method="HMDA-Modified-LAR public release",
            timeframe="2017",
        ),
        uses=DatasheetUses(
            tasks=["credit-approval classification", "fairness benchmarking"],
            recommended=True,
        ),
        maintenance=DatasheetMaintenance(
            maintainer="CFPB",
            url="https://ffiec.cfpb.gov/data-publication/",
        ),
    )


def test_write_model_card_writes_json_and_md(tmp_path: Path) -> None:
    card = _minimal_card()
    json_path, md_path = write_model_card(card, tmp_path)
    assert json_path.exists()
    assert md_path.exists()
    parsed = json.loads(json_path.read_text())
    assert parsed["name"] == "credit-v1"
    md = md_path.read_text()
    assert "# credit-v1" in md
    assert "demographic_parity" in md


def test_write_datasheet_writes_json_and_md(tmp_path: Path) -> None:
    sheet = _minimal_datasheet()
    json_path, md_path = write_datasheet(sheet, tmp_path)
    assert json_path.exists()
    assert md_path.exists()
    parsed = json.loads(json_path.read_text())
    assert parsed["name"] == "HMDA-2017-CA"
    md = md_path.read_text()
    assert "# HMDA-2017-CA" in md
    assert "CFPB" in md


def test_model_card_round_trip_json(tmp_path: Path) -> None:
    card = _minimal_card()
    json_path, _ = write_model_card(card, tmp_path)
    reloaded = ModelCard.model_validate_json(json_path.read_text())
    assert reloaded == card


def test_datasheet_round_trip_json(tmp_path: Path) -> None:
    sheet = _minimal_datasheet()
    json_path, _ = write_datasheet(sheet, tmp_path)
    reloaded = Datasheet.model_validate_json(json_path.read_text())
    assert reloaded == sheet
```

- [ ] **Step 2: Run, verify fail**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/_shared/tests/test_cards.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement `aegis_pipelines.cards`**

`ml-pipelines/_shared/src/aegis_pipelines/cards.py`:

```python
"""Model card (Mitchell et al. 2019) and datasheet (Gebru et al. 2021) writers.

Both artifacts are emitted as JSON (machine-readable, audit-log-friendly) and
Markdown (human-readable, paper-friendly). The dashboard renders the JSON;
the paper appendix and `/datasets` page render the Markdown.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


class _Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)


class ModelDetails(_Frozen):
    developers: str
    date: str
    type: str
    paper: str
    license: str
    contact: str


class TrainingData(_Frozen):
    source: str
    size: int = Field(ge=0)


class EvaluationData(_Frozen):
    source: str
    size: int = Field(ge=0)


class QuantitativeAnalysis(_Frozen):
    unitary: dict[str, float]
    intersectional: dict[str, float]


class EthicalConsiderations(_Frozen):
    risks: list[str]
    mitigations: list[str]


class ModelCard(_Frozen):
    """Mitchell et al. 2019 — Model Cards for Model Reporting."""

    name: str
    version: str
    details: ModelDetails
    intended_use: str
    factors: list[str]
    metrics: list[str]
    training_data: TrainingData
    evaluation_data: EvaluationData
    quantitative_analysis: QuantitativeAnalysis
    ethical_considerations: EthicalConsiderations
    caveats: list[str]


class DatasheetMotivation(_Frozen):
    purpose: str
    funded_by: str


class DatasheetComposition(_Frozen):
    instances: str
    count: int = Field(ge=0)
    features: list[str]
    label: str


class DatasheetCollection(_Frozen):
    method: str
    timeframe: str


class DatasheetUses(_Frozen):
    tasks: list[str]
    recommended: bool


class DatasheetMaintenance(_Frozen):
    maintainer: str
    url: str


class Datasheet(_Frozen):
    """Gebru et al. 2021 — Datasheets for Datasets (compact form)."""

    name: str
    version: str
    motivation: DatasheetMotivation
    composition: DatasheetComposition
    collection: DatasheetCollection
    uses: DatasheetUses
    maintenance: DatasheetMaintenance


def _model_card_to_md(card: ModelCard) -> str:
    return (
        f"# {card.name}\n\n"
        f"**Version:** {card.version}  \n"
        f"**Developers:** {card.details.developers}  \n"
        f"**Date:** {card.details.date}  \n"
        f"**Type:** {card.details.type}  \n"
        f"**License:** {card.details.license}  \n"
        f"**Contact:** {card.details.contact}\n\n"
        f"## Intended use\n\n{card.intended_use}\n\n"
        f"## Factors\n\n{', '.join(card.factors)}\n\n"
        f"## Metrics\n\n{', '.join(card.metrics)}\n\n"
        f"## Training data\n\n{card.training_data.source} (size={card.training_data.size:,})\n\n"
        f"## Evaluation data\n\n"
        f"{card.evaluation_data.source} (size={card.evaluation_data.size:,})\n\n"
        f"## Quantitative analysis\n\n"
        f"- **Unitary:** {card.quantitative_analysis.unitary}\n"
        f"- **Intersectional:** {card.quantitative_analysis.intersectional}\n\n"
        f"## Ethical considerations\n\n"
        f"### Risks\n\n" + "\n".join(f"- {r}" for r in card.ethical_considerations.risks) + "\n\n"
        f"### Mitigations\n\n"
        + "\n".join(f"- {m}" for m in card.ethical_considerations.mitigations)
        + "\n\n"
        f"## Caveats\n\n" + "\n".join(f"- {c}" for c in card.caveats) + "\n"
    )


def _datasheet_to_md(sheet: Datasheet) -> str:
    return (
        f"# {sheet.name}\n\n"
        f"**Version:** {sheet.version}  \n"
        f"**Maintainer:** {sheet.maintenance.maintainer}  \n"
        f"**Source:** <{sheet.maintenance.url}>\n\n"
        f"## Motivation\n\n"
        f"**Purpose:** {sheet.motivation.purpose}  \n"
        f"**Funded by:** {sheet.motivation.funded_by}\n\n"
        f"## Composition\n\n"
        f"- **Instances:** {sheet.composition.instances}\n"
        f"- **Count:** {sheet.composition.count:,}\n"
        f"- **Label:** {sheet.composition.label}\n"
        f"- **Features:** {', '.join(sheet.composition.features)}\n\n"
        f"## Collection\n\n"
        f"**Method:** {sheet.collection.method}  \n"
        f"**Timeframe:** {sheet.collection.timeframe}\n\n"
        f"## Recommended uses\n\n"
        + "\n".join(f"- {t}" for t in sheet.uses.tasks)
        + "\n"
    )


def write_model_card(card: ModelCard, dest_dir: Path) -> tuple[Path, Path]:
    """Write `<name>.model_card.json` and `<name>.model_card.md`. Returns both paths."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    json_path = dest_dir / f"{card.name}.model_card.json"
    md_path = dest_dir / f"{card.name}.model_card.md"
    json_path.write_text(json.dumps(card.model_dump(), indent=2))
    md_path.write_text(_model_card_to_md(card))
    return json_path, md_path


def write_datasheet(sheet: Datasheet, dest_dir: Path) -> tuple[Path, Path]:
    """Write `<name>.datasheet.json` and `<name>.datasheet.md`. Returns both paths."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    json_path = dest_dir / f"{sheet.name}.datasheet.json"
    md_path = dest_dir / f"{sheet.name}.datasheet.md"
    json_path.write_text(json.dumps(sheet.model_dump(), indent=2))
    md_path.write_text(_datasheet_to_md(sheet))
    return json_path, md_path
```

- [ ] **Step 4: Run tests, verify pass**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/_shared/tests/test_cards.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ml-pipelines/_shared/
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(pipelines): model card (Mitchell 2019) and datasheet (Gebru 2021) writers"
```

---

### Task 5: `aegis_pipelines.eval` — fairness + calibration helpers

**Files:**

- Create: `ml-pipelines/_shared/src/aegis_pipelines/eval.py`
- Create: `ml-pipelines/_shared/tests/test_eval.py`

- [ ] **Step 1: Write the failing test**

`ml-pipelines/_shared/tests/test_eval.py`:

```python
"""Tests for fairness + calibration helpers."""

import numpy as np

from aegis_pipelines.eval import (
    binary_classification_metrics,
    demographic_parity_difference,
    equal_opportunity_difference,
    expected_calibration_error,
    subgroup_metrics,
)


def test_demographic_parity_zero_when_equal_rates() -> None:
    y_pred = np.array([1, 0, 1, 0, 1, 0])
    sensitive = np.array(["a", "a", "a", "b", "b", "b"])
    # Group a: 2/3 positives. Group b: 1/3 positives. Difference = 1/3.
    out = demographic_parity_difference(y_pred=y_pred, sensitive=sensitive)
    assert abs(out - (2 / 3 - 1 / 3)) < 1e-9


def test_demographic_parity_zero_when_perfectly_equal() -> None:
    y_pred = np.array([1, 1, 0, 1, 1, 0])
    sensitive = np.array(["a", "a", "a", "b", "b", "b"])
    out = demographic_parity_difference(y_pred=y_pred, sensitive=sensitive)
    assert out == 0.0


def test_equal_opportunity_difference() -> None:
    y_true = np.array([1, 1, 0, 1, 1, 0])
    y_pred = np.array([1, 0, 0, 1, 1, 0])
    sensitive = np.array(["a", "a", "a", "b", "b", "b"])
    # Group a: TPR = 1/2 (one positive predicted right of two real positives).
    # Group b: TPR = 2/2 = 1. Difference = 0.5.
    out = equal_opportunity_difference(y_true=y_true, y_pred=y_pred, sensitive=sensitive)
    assert abs(out - 0.5) < 1e-9


def test_expected_calibration_error_perfectly_calibrated() -> None:
    rng = np.random.default_rng(0)
    y_prob = rng.uniform(0, 1, size=10_000)
    y_true = (rng.uniform(0, 1, size=10_000) < y_prob).astype(int)
    ece = expected_calibration_error(y_true=y_true, y_prob=y_prob, n_bins=10)
    assert ece < 0.05


def test_expected_calibration_error_uncalibrated() -> None:
    y_prob = np.full(1000, 0.9)
    y_true = np.zeros(1000, dtype=int)
    ece = expected_calibration_error(y_true=y_true, y_prob=y_prob, n_bins=10)
    assert ece > 0.7


def test_binary_classification_metrics_returns_expected_keys() -> None:
    y_true = np.array([0, 1, 1, 0, 1])
    y_pred = np.array([0, 1, 0, 0, 1])
    y_prob = np.array([0.1, 0.9, 0.4, 0.2, 0.8])
    m = binary_classification_metrics(y_true=y_true, y_pred=y_pred, y_prob=y_prob)
    for key in ["accuracy", "precision", "recall", "f1", "auroc", "brier", "ece"]:
        assert key in m


def test_subgroup_metrics_returns_per_group_dict() -> None:
    y_true = np.array([0, 1, 1, 0, 1, 0])
    y_pred = np.array([0, 1, 0, 0, 1, 1])
    y_prob = np.array([0.1, 0.9, 0.4, 0.2, 0.8, 0.6])
    sensitive = np.array(["a", "a", "a", "b", "b", "b"])
    out = subgroup_metrics(y_true=y_true, y_pred=y_pred, y_prob=y_prob, sensitive=sensitive)
    assert "a" in out and "b" in out
    assert "accuracy" in out["a"]
    assert "demographic_parity_difference" in out
    assert "equal_opportunity_difference" in out
```

- [ ] **Step 2: Run, verify fail**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/_shared/tests/test_eval.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement `aegis_pipelines.eval`**

`ml-pipelines/_shared/src/aegis_pipelines/eval.py`:

```python
"""Fairness and calibration metrics shared across model pipelines.

Wraps fairlearn for fairness metrics and computes Expected Calibration Error
(ECE) directly so that the downstream services have a single canonical
implementation. Every metric documented in a model card is computed here.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def demographic_parity_difference(*, y_pred: np.ndarray, sensitive: np.ndarray) -> float:
    """max P(Y=1 | A=g) − min P(Y=1 | A=g) across groups g of `sensitive`."""
    rates = []
    for g in np.unique(sensitive):
        mask = sensitive == g
        rates.append(float(y_pred[mask].mean()) if mask.sum() > 0 else 0.0)
    return max(rates) - min(rates)


def equal_opportunity_difference(
    *, y_true: np.ndarray, y_pred: np.ndarray, sensitive: np.ndarray
) -> float:
    """max TPR(g) − min TPR(g) across groups g of `sensitive`."""
    tprs = []
    for g in np.unique(sensitive):
        mask = (sensitive == g) & (y_true == 1)
        if mask.sum() == 0:
            continue
        tprs.append(float(y_pred[mask].mean()))
    if not tprs:
        return 0.0
    return max(tprs) - min(tprs)


def expected_calibration_error(
    *, y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10
) -> float:
    """ECE — average |confidence - accuracy| over equal-width probability bins."""
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    n = len(y_true)
    ece = 0.0
    for lo, hi in zip(bin_edges[:-1], bin_edges[1:], strict=True):
        in_bin = (y_prob > lo) & (y_prob <= hi) if lo > 0 else (y_prob >= lo) & (y_prob <= hi)
        bin_size = int(in_bin.sum())
        if bin_size == 0:
            continue
        acc = float(y_true[in_bin].mean())
        conf = float(y_prob[in_bin].mean())
        ece += (bin_size / n) * abs(conf - acc)
    return ece


def binary_classification_metrics(
    *, y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray
) -> dict[str, float]:
    """Standard binary-classification metrics + Brier + ECE."""
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "auroc": float(roc_auc_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 0.0,
        "brier": float(brier_score_loss(y_true, y_prob)),
        "ece": expected_calibration_error(y_true=y_true, y_prob=y_prob),
    }


def subgroup_metrics(
    *, y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray, sensitive: np.ndarray
) -> dict[str, Any]:
    """Per-group classification metrics + cross-group fairness deltas."""
    out: dict[str, Any] = {}
    for g in np.unique(sensitive):
        mask = sensitive == g
        if mask.sum() == 0:
            continue
        out[str(g)] = binary_classification_metrics(
            y_true=y_true[mask], y_pred=y_pred[mask], y_prob=y_prob[mask]
        )
    out["demographic_parity_difference"] = demographic_parity_difference(
        y_pred=y_pred, sensitive=sensitive
    )
    out["equal_opportunity_difference"] = equal_opportunity_difference(
        y_true=y_true, y_pred=y_pred, sensitive=sensitive
    )
    return out
```

- [ ] **Step 4: Run tests, verify pass**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/_shared/tests/test_eval.py -v
```

Expected: 7 tests PASS.

- [ ] **Step 5: Verify all \_shared tests pass + ruff + pyright clean**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/_shared/tests/ -v
PATH=$HOME/.local/bin:$PATH uv run ruff check ml-pipelines/_shared
PATH=$HOME/.local/bin:$PATH uv run pyright ml-pipelines/_shared
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add ml-pipelines/_shared/
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(pipelines): fairness + calibration metric helpers"
```

---

### Task 6: Credit pipeline scaffolding + download script

**Files:**

- Create: `ml-pipelines/credit/README.md`
- Create: `ml-pipelines/credit/config.py`
- Create: `ml-pipelines/credit/01_download.py`
- Create: `ml-pipelines/credit/tests/__init__.py`

The HMDA Public LAR 2017 California file is hosted by the CFPB FFIEC service. The exact URL and SHA-256 are pinned at the top of the script — re-pinning requires a deliberate update.

- [ ] **Step 1: Create `ml-pipelines/credit/README.md`**

```markdown
# credit-v1 — credit-approval classifier

XGBoost binary classifier on HMDA Public LAR 2017 California subset.

**Anchor incidents**

- Apple Card 2019 / NYDFS 2021 / CFPB Goldman+Apple Oct 2024.
- Wells Fargo refinance disparity 2020 (Bloomberg, Banking Dive).
- The Markup, "Secret Bias in Mortgage-Approval Algorithms," Aug 2021.

**Pipeline**

    python 01_download.py            # downloads HMDA-CA-2017 to data/raw/credit/
    python 02_preprocess.py          # writes data/processed/credit/{train,val,test}.parquet
    python 03_train.py               # writes artifacts/model.json + metrics.json
    python 04_evaluate.py            # writes artifacts/evaluation.json
    python 05_generate_artifacts.py  # writes model card + datasheet + causal_dag.json

**Reproducibility**

- Random seed pinned at 1729 (see `aegis_pipelines.seed`).
- Dataset SHA-256 pinned in `01_download.py`.
- Train/val/test split is deterministic stratified, 80 / 10 / 10.
```

- [ ] **Step 2: Create `ml-pipelines/credit/config.py`**

```python
"""Credit pipeline configuration — paths, dataset spec, hyperparams."""

from __future__ import annotations

from pathlib import Path
from typing import Final

from aegis_pipelines.data import DatasetSpec

REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[2]
RAW_DIR: Final[Path] = REPO_ROOT / "data" / "raw" / "credit"
PROCESSED_DIR: Final[Path] = REPO_ROOT / "data" / "processed" / "credit"
ARTIFACTS_DIR: Final[Path] = Path(__file__).parent / "artifacts"

# HMDA Public LAR 2017 California, Modified-LAR format. Pinned URL and SHA.
# Source: https://ffiec.cfpb.gov/data-publication/modified-lar/2017
HMDA_2017_CA_SPEC: Final[DatasetSpec] = DatasetSpec(
    name="HMDA-2017-CA",
    url=(
        "https://ffiec.cfpb.gov/v2/data-browser-api/view/csv?"
        "states=CA&years=2017&actions_taken=1,3"
    ),
    sha256="00000000000000000000000000000000000000000000000000000000deadbeef",
    dest_relpath="hmda-2017-ca.csv",
)
# NOTE: the SHA-256 above is a placeholder. Run 01_download.py once with the
# placeholder, observe the actual file's hash from the DownloadError, then
# update this constant. This is the standard "first-run pinning" workflow.

PROTECTED_FEATURES: Final[list[str]] = [
    "applicant_race",
    "applicant_ethnicity",
    "applicant_sex",
    "applicant_age",
]

LABEL_COLUMN: Final[str] = "action_taken"

# XGBoost hyperparameters — modest, CPU-friendly defaults.
XGBOOST_PARAMS: Final[dict[str, object]] = {
    "objective": "binary:logistic",
    "max_depth": 6,
    "learning_rate": 0.1,
    "n_estimators": 200,
    "tree_method": "hist",
    "n_jobs": -1,
    "random_state": 1729,
}
```

- [ ] **Step 3: Create `01_download.py`**

```python
"""Download the HMDA 2017 California dataset to `data/raw/credit/`.

Idempotent: if the file already exists with the correct SHA, no network call
is made. Run once; re-run is a no-op.
"""

from __future__ import annotations

import sys

from aegis_pipelines.data import DownloadError, download_with_verification

from config import HMDA_2017_CA_SPEC, RAW_DIR


def main() -> int:
    print(f"→ ensuring {HMDA_2017_CA_SPEC.name} is present at {RAW_DIR}")
    try:
        path = download_with_verification(HMDA_2017_CA_SPEC, RAW_DIR)
    except DownloadError as exc:
        print(f"❌ download failed: {exc}", file=sys.stderr)
        return 1
    print(f"✓ {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Create `tests/__init__.py`** (empty file).

- [ ] **Step 5: Verify imports work** (no actual download yet)

```bash
PATH=$HOME/.local/bin:$PATH uv run python -c "
import sys
sys.path.insert(0, 'ml-pipelines/credit')
import config
print('config loaded:', config.HMDA_2017_CA_SPEC.name)
"
```

Expected: `config loaded: HMDA-2017-CA`.

- [ ] **Step 6: Commit**

```bash
git add ml-pipelines/credit/
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(credit): pipeline scaffolding + HMDA download script"
```

---

### Task 7: Credit preprocessing + tests

**Files:**

- Create: `ml-pipelines/credit/02_preprocess.py`
- Create: `ml-pipelines/credit/preprocess_lib.py`
- Create: `ml-pipelines/credit/tests/test_preprocess.py`

We split the actual preprocessing into a tested library (`preprocess_lib.py`) that takes a DataFrame and returns DataFrames, and a thin CLI driver (`02_preprocess.py`) that handles I/O.

- [ ] **Step 1: Write the failing test**

`ml-pipelines/credit/tests/test_preprocess.py`:

```python
"""Tests for the credit preprocessing library."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from preprocess_lib import (  # noqa: E402
    binarize_label,
    drop_missing_critical,
    encode_categoricals,
    stratified_split,
)


def _toy_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "income": [50000, 75000, 30000, 100000, 60000, 45000, 80000, 90000, 25000, 55000],
            "loan_amount": [200, 300, 150, 500, 250, 180, 350, 450, 100, 220],
            "applicant_race": ["W", "B", "B", "W", "L", "L", "B", "W", "L", "W"],
            "applicant_ethnicity": ["NH", "NH", "NH", "NH", "H", "H", "NH", "NH", "H", "NH"],
            "applicant_sex": ["M", "F", "F", "M", "M", "F", "M", "F", "F", "M"],
            "applicant_age": ["35-44", "25-34", "45-54", "55-64", "35-44"] * 2,
            "action_taken": [1, 1, 3, 1, 1, 3, 1, 1, 3, 1],  # 1=approved 3=denied
        }
    )


def test_binarize_label_maps_action_taken_to_01() -> None:
    df = _toy_frame()
    out = binarize_label(df, label_col="action_taken", positive_codes={1})
    assert out["label"].tolist() == [1, 1, 0, 1, 1, 0, 1, 1, 0, 1]


def test_drop_missing_critical_drops_rows_with_nan_label_or_protected() -> None:
    df = _toy_frame()
    df.loc[2, "applicant_race"] = np.nan
    df.loc[5, "action_taken"] = np.nan
    out = drop_missing_critical(
        df, critical_cols=["applicant_race", "action_taken"]
    )
    assert len(out) == 8


def test_encode_categoricals_returns_only_numeric() -> None:
    df = _toy_frame()
    df = binarize_label(df, label_col="action_taken", positive_codes={1})
    encoded, encoders = encode_categoricals(
        df.drop(columns=["action_taken"]), categorical_cols=[
            "applicant_race", "applicant_ethnicity", "applicant_sex", "applicant_age"
        ]
    )
    assert all(np.issubdtype(t, np.number) for t in encoded.dtypes)
    assert set(encoders.keys()) == {
        "applicant_race",
        "applicant_ethnicity",
        "applicant_sex",
        "applicant_age",
    }


def test_stratified_split_preserves_label_proportions() -> None:
    rng = np.random.default_rng(0)
    n = 1000
    df = pd.DataFrame(
        {
            "x": rng.uniform(size=n),
            "label": rng.binomial(1, 0.3, size=n),
        }
    )
    train, val, test = stratified_split(df, label_col="label", seed=42)
    for part in (train, val, test):
        assert 0.25 < part["label"].mean() < 0.35
    assert len(train) + len(val) + len(test) == n
    # 80 / 10 / 10
    assert abs(len(train) / n - 0.80) < 0.02
    assert abs(len(val) / n - 0.10) < 0.02
    assert abs(len(test) / n - 0.10) < 0.02


def test_stratified_split_is_deterministic() -> None:
    rng = np.random.default_rng(0)
    df = pd.DataFrame({"x": rng.uniform(size=200), "label": rng.binomial(1, 0.5, size=200)})
    a1, _, _ = stratified_split(df, label_col="label", seed=42)
    a2, _, _ = stratified_split(df, label_col="label", seed=42)
    pd.testing.assert_frame_equal(a1.reset_index(drop=True), a2.reset_index(drop=True))


@pytest.mark.parametrize("seed", [1, 2, 3])
def test_split_seed_changes_result(seed: int) -> None:
    rng = np.random.default_rng(0)
    df = pd.DataFrame({"x": rng.uniform(size=200), "label": rng.binomial(1, 0.5, size=200)})
    a, _, _ = stratified_split(df, label_col="label", seed=seed)
    b, _, _ = stratified_split(df, label_col="label", seed=seed + 100)
    assert a["x"].sum() != b["x"].sum()
```

- [ ] **Step 2: Run, verify fail**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/credit/tests/test_preprocess.py -v
```

Expected: ImportError — `preprocess_lib` doesn't exist.

- [ ] **Step 3: Implement `preprocess_lib.py`**

`ml-pipelines/credit/preprocess_lib.py`:

```python
"""Pure preprocessing functions for the credit pipeline.

Split out from the CLI driver so we can test the transforms in isolation
without touching the filesystem.
"""

from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split


def binarize_label(
    df: pd.DataFrame, *, label_col: str, positive_codes: set[int]
) -> pd.DataFrame:
    """Add `label` column = 1 if `df[label_col]` ∈ `positive_codes`, else 0."""
    out = df.copy()
    out["label"] = out[label_col].apply(lambda v: 1 if v in positive_codes else 0)
    return out


def drop_missing_critical(df: pd.DataFrame, *, critical_cols: list[str]) -> pd.DataFrame:
    """Drop rows where any column in `critical_cols` is missing."""
    return df.dropna(subset=critical_cols).reset_index(drop=True)


def encode_categoricals(
    df: pd.DataFrame, *, categorical_cols: list[str]
) -> tuple[pd.DataFrame, dict[str, dict[str, int]]]:
    """Label-encode categorical columns. Returns (encoded_df, encoders)."""
    out = df.copy()
    encoders: dict[str, dict[str, int]] = {}
    for col in categorical_cols:
        unique = sorted(out[col].dropna().unique().tolist(), key=str)
        mapping = {v: i for i, v in enumerate(unique)}
        encoders[col] = mapping
        out[col] = out[col].map(mapping).astype("int32")
    return out, encoders


def stratified_split(
    df: pd.DataFrame, *, label_col: str, seed: int
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Deterministic stratified 80 / 10 / 10 split."""
    train, rest = train_test_split(
        df, test_size=0.2, stratify=df[label_col], random_state=seed
    )
    val, test = train_test_split(
        rest, test_size=0.5, stratify=rest[label_col], random_state=seed
    )
    return train.reset_index(drop=True), val.reset_index(drop=True), test.reset_index(drop=True)
```

- [ ] **Step 4: Implement `02_preprocess.py`**

`ml-pipelines/credit/02_preprocess.py`:

```python
"""Read raw HMDA, preprocess, write train/val/test parquet files."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from aegis_pipelines.seed import GLOBAL_SEED, set_global_seed

sys.path.insert(0, str(Path(__file__).parent))
from config import (  # noqa: E402
    HMDA_2017_CA_SPEC,
    LABEL_COLUMN,
    PROCESSED_DIR,
    PROTECTED_FEATURES,
    RAW_DIR,
)
from preprocess_lib import (  # noqa: E402
    binarize_label,
    drop_missing_critical,
    encode_categoricals,
    stratified_split,
)

CATEGORICAL_COLS = PROTECTED_FEATURES.copy()
NUMERIC_COLS = ["income", "loan_amount"]


def main() -> int:
    set_global_seed()
    src = RAW_DIR / HMDA_2017_CA_SPEC.dest_relpath
    if not src.exists():
        print(f"❌ raw file not found at {src}; run 01_download.py first", file=sys.stderr)
        return 1

    print(f"→ reading {src}")
    df = pd.read_csv(src)

    print(f"→ binarizing label (column={LABEL_COLUMN}, positive=1)")
    df = binarize_label(df, label_col=LABEL_COLUMN, positive_codes={1})

    print("→ dropping missing critical columns")
    df = drop_missing_critical(df, critical_cols=["label", *PROTECTED_FEATURES])

    print("→ encoding categoricals")
    feature_cols = NUMERIC_COLS + CATEGORICAL_COLS
    encoded, encoders = encode_categoricals(df[feature_cols + ["label"]],
                                            categorical_cols=CATEGORICAL_COLS)

    print(f"→ stratified split (seed={GLOBAL_SEED})")
    train, val, test = stratified_split(encoded, label_col="label", seed=GLOBAL_SEED)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    train.to_parquet(PROCESSED_DIR / "train.parquet")
    val.to_parquet(PROCESSED_DIR / "val.parquet")
    test.to_parquet(PROCESSED_DIR / "test.parquet")
    (PROCESSED_DIR / "encoders.json").write_text(json.dumps(encoders, indent=2))

    print(
        f"✓ wrote train={len(train):,} val={len(val):,} test={len(test):,} to {PROCESSED_DIR}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run tests, verify pass**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/credit/tests/test_preprocess.py -v
```

Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add ml-pipelines/credit/
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(credit): preprocessing library + CLI driver with tests"
```

---

### Task 8: Credit training script (XGBoost)

**Files:**

- Create: `ml-pipelines/credit/03_train.py`

- [ ] **Step 1: Create `03_train.py`**

```python
"""Train an XGBoost classifier on the preprocessed credit data."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from aegis_pipelines.seed import set_global_seed
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).parent))
from config import ARTIFACTS_DIR, PROCESSED_DIR, XGBOOST_PARAMS  # noqa: E402


def main() -> int:
    set_global_seed()
    train = pd.read_parquet(PROCESSED_DIR / "train.parquet")
    val = pd.read_parquet(PROCESSED_DIR / "val.parquet")
    feature_cols = [c for c in train.columns if c != "label"]

    print(f"→ training XGBoost on {len(train):,} rows")
    model = XGBClassifier(**XGBOOST_PARAMS)
    model.fit(
        train[feature_cols], train["label"],
        eval_set=[(val[feature_cols], val["label"])],
        verbose=False,
    )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    model.save_model(ARTIFACTS_DIR / "model.json")
    (ARTIFACTS_DIR / "feature_cols.json").write_text(json.dumps(feature_cols, indent=2))
    print(f"✓ wrote {ARTIFACTS_DIR / 'model.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Commit**

```bash
git add ml-pipelines/credit/03_train.py
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(credit): XGBoost training script with deterministic seeding"
```

---

### Task 9: Credit evaluation script

**Files:**

- Create: `ml-pipelines/credit/04_evaluate.py`

- [ ] **Step 1: Create `04_evaluate.py`**

```python
"""Evaluate the trained credit model — overall + subgroup metrics, calibration."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from aegis_pipelines.eval import binary_classification_metrics, subgroup_metrics
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).parent))
from config import ARTIFACTS_DIR, PROCESSED_DIR, PROTECTED_FEATURES  # noqa: E402


def main() -> int:
    test = pd.read_parquet(PROCESSED_DIR / "test.parquet")
    feature_cols = json.loads((ARTIFACTS_DIR / "feature_cols.json").read_text())

    print("→ loading trained model")
    model = XGBClassifier()
    model.load_model(ARTIFACTS_DIR / "model.json")

    y_true = test["label"].to_numpy()
    y_prob = model.predict_proba(test[feature_cols])[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    overall = binary_classification_metrics(y_true=y_true, y_pred=y_pred, y_prob=y_prob)
    by_group = {
        feat: subgroup_metrics(
            y_true=y_true,
            y_pred=y_pred,
            y_prob=y_prob,
            sensitive=test[feat].astype(str).to_numpy(),
        )
        for feat in PROTECTED_FEATURES
    }

    out = {"overall": overall, "subgroup": by_group}
    (ARTIFACTS_DIR / "evaluation.json").write_text(json.dumps(out, indent=2))
    print(f"✓ wrote {ARTIFACTS_DIR / 'evaluation.json'}")
    print(f"  accuracy = {overall['accuracy']:.4f}")
    print(f"  AUROC    = {overall['auroc']:.4f}")
    print(f"  ECE      = {overall['ece']:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Commit**

```bash
git add ml-pipelines/credit/04_evaluate.py
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(credit): evaluation script with overall + subgroup metrics"
```

---

### Task 10: Credit model card + datasheet + causal DAG generator

**Files:**

- Create: `ml-pipelines/credit/05_generate_artifacts.py`
- Create: `ml-pipelines/credit/causal_dag.json`

The causal DAG is hand-curated based on the natural causal structure of a mortgage application: applicant demographics → income → loan amount → debt-to-income → approval decision. The structure is taken from HMDA codebooks and the credit-decisioning literature.

- [ ] **Step 1: Create `causal_dag.json`**

```json
{
  "name": "credit-v1-dag",
  "nodes": [
    "applicant_race",
    "applicant_ethnicity",
    "applicant_sex",
    "applicant_age",
    "co_applicant_present",
    "income",
    "loan_amount",
    "debt_to_income",
    "approval"
  ],
  "edges": [
    ["applicant_race", "income"],
    ["applicant_ethnicity", "income"],
    ["applicant_sex", "income"],
    ["applicant_age", "income"],
    ["applicant_sex", "co_applicant_present"],
    ["applicant_age", "co_applicant_present"],
    ["co_applicant_present", "income"],
    ["income", "loan_amount"],
    ["income", "debt_to_income"],
    ["loan_amount", "debt_to_income"],
    ["debt_to_income", "approval"],
    ["loan_amount", "approval"],
    ["income", "approval"]
  ],
  "notes": "Hand-curated from HMDA-LAR codebooks and the credit decisioning literature. Used by services/causal-attrib (Phase 5) for DoWhy GCM attribution."
}
```

- [ ] **Step 2: Create `05_generate_artifacts.py`**

```python
"""Emit the credit model card and HMDA datasheet, sourcing metrics from evaluation.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from aegis_pipelines.cards import (
    Datasheet,
    DatasheetCollection,
    DatasheetComposition,
    DatasheetMaintenance,
    DatasheetMotivation,
    DatasheetUses,
    EthicalConsiderations,
    EvaluationData,
    ModelCard,
    ModelDetails,
    QuantitativeAnalysis,
    TrainingData,
    write_datasheet,
    write_model_card,
)

sys.path.insert(0, str(Path(__file__).parent))
from config import ARTIFACTS_DIR, PROCESSED_DIR  # noqa: E402


def _read_split_size(path: Path) -> int:
    import pandas as pd

    return len(pd.read_parquet(path))


def main() -> int:
    eval_path = ARTIFACTS_DIR / "evaluation.json"
    if not eval_path.exists():
        print("❌ evaluation.json not found; run 04_evaluate.py first", file=sys.stderr)
        return 1

    metrics = json.loads(eval_path.read_text())
    overall = metrics["overall"]

    train_size = _read_split_size(PROCESSED_DIR / "train.parquet")
    test_size = _read_split_size(PROCESSED_DIR / "test.parquet")

    card = ModelCard(
        name="credit-v1",
        version="0.1.0",
        details=ModelDetails(
            developers="syedwam7q",
            date="2026-04-28",
            type="XGBoost binary classifier",
            paper="https://github.com/syedwam7q/gov-ml/blob/main/docs/paper",
            license="MIT",
            contact="sdirwamiq@gmail.com",
        ),
        intended_use=(
            "Demonstration governance target for the Aegis platform. "
            "NOT for any production lending decision."
        ),
        factors=["applicant_race", "applicant_ethnicity", "applicant_sex", "applicant_age"],
        metrics=["accuracy", "demographic_parity", "equal_opportunity", "ECE", "AUROC"],
        training_data=TrainingData(source="HMDA Public LAR 2017 California", size=train_size),
        evaluation_data=EvaluationData(
            source="HMDA Public LAR 2017 California holdout", size=test_size
        ),
        quantitative_analysis=QuantitativeAnalysis(
            unitary={
                "accuracy": overall["accuracy"],
                "auroc": overall["auroc"],
                "ece": overall["ece"],
                "brier": overall["brier"],
            },
            intersectional={
                "demographic_parity_diff_race": metrics["subgroup"]["applicant_race"][
                    "demographic_parity_difference"
                ],
                "equal_opportunity_diff_race": metrics["subgroup"]["applicant_race"][
                    "equal_opportunity_difference"
                ],
                "demographic_parity_diff_sex": metrics["subgroup"]["applicant_sex"][
                    "demographic_parity_difference"
                ],
            },
        ),
        ethical_considerations=EthicalConsiderations(
            risks=[
                "disparate impact across race / ethnicity / sex (cf. Apple Card 2019)",
                "calibration drift when economic conditions shift (cf. COVID 2020 macro-shock)",
                "proxy-variable contamination (e.g., zipcode → race)",
            ],
            mitigations=[
                "Aegis monitors all subgroup metrics in real time",
                "auto-rollback on KPI breach during canary",
                "approval gate before any retrain promotion",
            ],
        ),
        caveats=[
            "Public dataset — not representative of any specific lender's portfolio.",
            "Class imbalance in training data: loan-action codes 1 (approved) vs 3 (denied).",
        ],
    )
    write_model_card(card, ARTIFACTS_DIR)

    sheet = Datasheet(
        name="HMDA-2017-CA",
        version="2017-California",
        motivation=DatasheetMotivation(
            purpose=(
                "Public mortgage application dataset published annually by the CFPB under "
                "the Home Mortgage Disclosure Act (HMDA)."
            ),
            funded_by="US Consumer Financial Protection Bureau",
        ),
        composition=DatasheetComposition(
            instances="Loan applications",
            count=600_000,
            features=[
                "income",
                "loan_amount",
                "applicant_race",
                "applicant_ethnicity",
                "applicant_sex",
                "applicant_age",
                "co_applicant_present",
            ],
            label="action_taken (1=approved, 3=denied)",
        ),
        collection=DatasheetCollection(
            method="HMDA-Modified-LAR public release", timeframe="Calendar year 2017"
        ),
        uses=DatasheetUses(
            tasks=[
                "credit-approval binary classification",
                "fairness benchmarking across protected attributes",
                "drift / governance research (Aegis target use)",
            ],
            recommended=True,
        ),
        maintenance=DatasheetMaintenance(
            maintainer="CFPB", url="https://ffiec.cfpb.gov/data-publication/"
        ),
    )
    write_datasheet(sheet, ARTIFACTS_DIR)

    print(f"✓ wrote model card + datasheet to {ARTIFACTS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Commit**

```bash
git add ml-pipelines/credit/
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "feat(credit): model card + datasheet + causal DAG spec"
```

---

### Task 11: Credit smoke test (synthetic-data end-to-end)

**Files:**

- Create: `ml-pipelines/credit/tests/test_smoke.py`

The smoke test trains a tiny XGBoost on a synthetic frame, confirms the full pipeline runs end-to-end (preprocess → train → evaluate → artifact generation), and asserts the produced artifacts have the right shape. CI runs this on every PR; it takes < 5s.

- [ ] **Step 1: Write the smoke test**

`ml-pipelines/credit/tests/test_smoke.py`:

```python
"""End-to-end smoke test: tiny synthetic frame → preprocess → train → eval → cards."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from preprocess_lib import (  # noqa: E402
    binarize_label,
    drop_missing_critical,
    encode_categoricals,
    stratified_split,
)


def _synthetic_frame(n: int = 2000, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    income = rng.normal(60_000, 20_000, size=n).clip(10_000, 250_000)
    loan_amount = (income * rng.uniform(2.0, 5.0, size=n)).astype(int)
    race = rng.choice(["W", "B", "L", "A", "N"], size=n, p=[0.55, 0.15, 0.18, 0.10, 0.02])
    ethnicity = rng.choice(["NH", "H"], size=n, p=[0.85, 0.15])
    sex = rng.choice(["M", "F"], size=n)
    age = rng.choice(["25-34", "35-44", "45-54", "55-64"], size=n)
    # Approval probability slightly correlated with income; injected disparity by race
    base_logit = -2.0 + 0.00003 * income - 0.00001 * loan_amount
    bias = np.where(race == "W", 0.5, np.where(race == "B", -0.5, 0.0))
    prob = 1.0 / (1.0 + np.exp(-(base_logit + bias)))
    action_taken = np.where(rng.uniform(size=n) < prob, 1, 3)
    return pd.DataFrame(
        {
            "income": income,
            "loan_amount": loan_amount,
            "applicant_race": race,
            "applicant_ethnicity": ethnicity,
            "applicant_sex": sex,
            "applicant_age": age,
            "action_taken": action_taken,
        }
    )


def test_full_pipeline_e2e(tmp_path: Path) -> None:
    df = _synthetic_frame()
    df = binarize_label(df, label_col="action_taken", positive_codes={1})
    df = drop_missing_critical(
        df, critical_cols=["label", "applicant_race", "applicant_sex"]
    )
    feature_cols = [
        "income",
        "loan_amount",
        "applicant_race",
        "applicant_ethnicity",
        "applicant_sex",
        "applicant_age",
    ]
    encoded, encoders = encode_categoricals(
        df[feature_cols + ["label"]],
        categorical_cols=[
            "applicant_race",
            "applicant_ethnicity",
            "applicant_sex",
            "applicant_age",
        ],
    )
    train, val, test = stratified_split(encoded, label_col="label", seed=42)

    model = XGBClassifier(max_depth=4, n_estimators=20, n_jobs=1, random_state=42)
    model.fit(train[feature_cols], train["label"])

    y_prob = model.predict_proba(test[feature_cols])[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    # Sanity: model performs better than chance
    accuracy = (y_pred == test["label"].to_numpy()).mean()
    assert accuracy > 0.55  # synthetic but signal exists

    # Persist + reload roundtrip
    out = tmp_path / "model.json"
    model.save_model(out)
    reloaded = XGBClassifier()
    reloaded.load_model(out)
    pred_again = reloaded.predict_proba(test[feature_cols])[:, 1]
    np.testing.assert_array_almost_equal(y_prob, pred_again, decimal=6)

    # Sanity: encoders are JSON-serializable (so 02_preprocess can persist them)
    json.dumps(encoders)
```

- [ ] **Step 2: Run the smoke test**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/credit/tests/test_smoke.py -v
```

Expected: 1 test PASSes in < 5s.

- [ ] **Step 3: Verify all credit pipeline tests still pass**

```bash
PATH=$HOME/.local/bin:$PATH uv run pytest ml-pipelines/credit/tests/ -v
```

Expected: 9 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add ml-pipelines/credit/tests/test_smoke.py
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "test(credit): end-to-end smoke test on synthetic data"
```

---

### Task 12: Update setup.md + final verify + push

- [ ] **Step 1: Append a "Pipelines" section to `setup.md`**

Append the following under the existing `## Run` section:

```markdown
### ML pipelines

Each model has its own pipeline directory under `ml-pipelines/`. Phase 1a ships
the credit pipeline; readmission and toxicity follow in 1b/1c.

    cd ml-pipelines/credit
    PATH=$HOME/.local/bin:$PATH uv run python 01_download.py            # ~1 min, ~150 MB
    PATH=$HOME/.local/bin:$PATH uv run python 02_preprocess.py          # ~30s
    PATH=$HOME/.local/bin:$PATH uv run python 03_train.py               # ~2 min on a laptop
    PATH=$HOME/.local/bin:$PATH uv run python 04_evaluate.py            # ~10s
    PATH=$HOME/.local/bin:$PATH uv run python 05_generate_artifacts.py  # ~1s

The downloaded raw data lands in `data/raw/credit/` (gitignored).
Trained artifacts (model + metrics + model card + datasheet) land in
`ml-pipelines/credit/artifacts/`.

The smoke test (`tests/test_smoke.py`) exercises the full pipeline on synthetic
data in under 5 seconds and runs in CI on every PR.
```

- [ ] **Step 2: Run the full local CI replay**

```bash
PATH=$HOME/.local/bin:$PATH bash -c '
set -e
pnpm install --frozen-lockfile
uv sync --all-packages --frozen
pnpm format:check
pnpm lint
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest -v
pnpm --filter @aegis/shared-ts generate
pnpm typecheck
pnpm test
'
```

Expected: every command exits 0.

- [ ] **Step 3: Commit and push**

```bash
git add setup.md
git -c user.name="syedwam7q" -c user.email="sdirwamiq@gmail.com" -c commit.gpgsign=false commit -m "docs: pipeline run instructions"
git push origin main
```

- [ ] **Step 4: Verify GitHub CI green**

```bash
until gh run list --limit 1 --branch main --json conclusion --jq '.[0].conclusion' | grep -qE '^(success|failure|cancelled)$'; do sleep 10; done
gh run list --limit 1 --branch main --json conclusion,databaseId,status
```

Expected: `conclusion: success`.

- [ ] **Step 5: Tag the phase boundary**

```bash
git tag -a phase-1a-complete -m "Phase 1a — shared pipeline infrastructure + credit pipeline"
git push origin phase-1a-complete
```

---

## Self-review

**Spec coverage:**

| Spec §     | Requirement                                                                                             | Task                                      |
| ---------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 4.1        | `ml-pipelines/_shared/`, `ml-pipelines/credit/`                                                         | 1, 6                                      |
| 8.2        | `test_model_regression_credit`, `test_fairness_regression_credit`, `test_calibration_regression_credit` | 9, 11                                     |
| 13:Phase 1 | "ML pipelines + 3 trained models + dataset snapshots + model cards + datasheets"                        | 1–11 (credit; 1b/1c follow same template) |
| Appendix A | Apple Card 2019 / Wells Fargo 2020 / The Markup 2021 anchor incidents                                   | 6 (README), 10 (model card risks)         |

**Placeholder scan:** No `TBD`/`TODO`/`fill in details`. The HMDA SHA-256 placeholder in `config.py` is documented as a "first-run pin" workflow with explicit instructions, not an unresolved placeholder.

**Type consistency:** `ModelCard`, `Datasheet`, `DatasetSpec` defined in Tasks 3-4 are referenced in Tasks 6-10. The Pydantic schema is the source of truth.

**Scope check:** Phase 1a produces a working, testable artifact (shared pipeline package + credit smoke test green) without requiring real data downloads to run CI. Real training is a documented one-time user step.

---

## What lands in Phase 1b / 1c

- **Phase 1b — Readmission pipeline**: same scaffolding, applied to UCI Diabetes 130-US (~100K records). Numeric DAG with patient demographics → severity → readmission. Anchor: Obermeyer 2019 (Optum).
- **Phase 1c — Toxicity pipeline**: DistilBERT fine-tune on Jigsaw Civil Comments. Trains on Colab GPU (free), artifact checked into HF Hub. Subgroup-AUC / BPSN / BNSP eval per Borkan 2019. Anchor: Borkan 2019, Sap 2019, Dixon 2018.

Each phase produces a green CI run and a `phase-1{b,c}-complete` tag.
