"""Download + extract the UCI Diabetes 130-US dataset to `data/raw/readmission/`.

Idempotent: cached ZIP is verified by SHA-256; extraction skipped if the CSV
already exists. Run once; re-run is a no-op.
"""

from __future__ import annotations

import sys
import zipfile

from aegis_pipelines.data import DownloadError, download_with_verification
from config import DIABETES_130_SPEC, DIABETES_CSV_INSIDE_ZIP, RAW_DIR


def main() -> int:
    print(f"→ ensuring {DIABETES_130_SPEC.name} ZIP is present at {RAW_DIR}")
    try:
        zip_path = download_with_verification(DIABETES_130_SPEC, RAW_DIR)
    except DownloadError as exc:
        print(f"❌ download failed: {exc}", file=sys.stderr)
        return 1

    csv_dest = RAW_DIR / DIABETES_CSV_INSIDE_ZIP
    if csv_dest.exists():
        print(f"✓ {csv_dest} already extracted")
        return 0

    print(f"→ extracting {DIABETES_CSV_INSIDE_ZIP} from {zip_path.name}")
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        if DIABETES_CSV_INSIDE_ZIP not in names:
            print(
                f"❌ {DIABETES_CSV_INSIDE_ZIP} not found inside ZIP; saw {names!r}",
                file=sys.stderr,
            )
            return 1
        zf.extract(DIABETES_CSV_INSIDE_ZIP, RAW_DIR)
    print(f"✓ {csv_dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
