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
        raise DownloadError(f"{spec.name}: sha256 mismatch — expected {spec.sha256}, got {actual}")

    tmp.rename(dest)
    return dest
