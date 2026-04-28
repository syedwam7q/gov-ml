"""Download Civil Comments via HuggingFace `datasets` and cache locally as parquet.

Idempotent: if the parquet files already exist, no network call is made.
Requires the `nlp` extras: `uv sync --all-packages --extra nlp`.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import HF_DATASET, RAW_DIR  # noqa: E402

EXPECTED_SPLITS = ("train", "validation", "test")


def main() -> int:
    try:
        from datasets import load_dataset  # noqa: PLC0415
    except ImportError as exc:
        print(
            "❌ `datasets` is not installed; run `uv sync --all-packages --extra nlp` first.",
            file=sys.stderr,
        )
        print(f"   ({exc})", file=sys.stderr)
        return 1

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    targets = {split: RAW_DIR / f"{split}.parquet" for split in EXPECTED_SPLITS}
    if all(p.exists() for p in targets.values()):
        for split, p in targets.items():
            print(f"✓ {split}: {p}")
        return 0

    print(f"→ loading {HF_DATASET} from HuggingFace Hub")
    ds = load_dataset(HF_DATASET)
    for split in EXPECTED_SPLITS:
        if split not in ds:
            print(f"❌ split {split!r} missing from dataset", file=sys.stderr)
            return 1
        out = targets[split]
        print(f"→ writing {out}")
        ds[split].to_parquet(out)
        print(f"✓ {out} ({out.stat().st_size / 1024 / 1024:.1f} MiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
