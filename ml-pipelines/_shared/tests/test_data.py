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
    p.write_bytes(b"\x42" * (4 * 1024 * 1024 + 17))
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


def test_download_with_verification_uses_cached_file(tmp_path: Path, sample_file: Path) -> None:
    """If the destination already exists with the correct SHA, no network call is made."""
    digest = sha256_of_file(sample_file)
    spec = DatasetSpec(
        name="cached",
        url="https://nonexistent.invalid/x",
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
        sha256="f" * 64,
        dest_relpath=sample_file.name,
    )
    with pytest.raises(DownloadError, match="sha256 mismatch"):
        download_with_verification(spec, tmp_path)
