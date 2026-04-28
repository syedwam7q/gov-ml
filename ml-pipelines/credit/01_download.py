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
