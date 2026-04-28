"""Sentence-transformer embedding wrapper.

Loads `all-MiniLM-L6-v2` (384-d, CPU-friendly) once per process. Tests
do not import this module — they pass synthetic embeddings directly to
the MMD detector. Production / Colab / HF Spaces use this to encode
text comments before drift detection.

Requires the `[nlp]` extras to be installed:

    uv sync --extra nlp
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final

import numpy as np

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer  # type: ignore[import-not-found]

DEFAULT_MODEL: Final[str] = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_DIM: Final[int] = 384

_model_cache: SentenceTransformer | None = None


def get_model(name: str = DEFAULT_MODEL) -> SentenceTransformer:
    """Load (and memoize) the sentence-transformer model."""
    global _model_cache
    if _model_cache is None:
        # Imported here so the [nlp] extras stay opt-in.
        from sentence_transformers import (  # type: ignore[import-not-found]  # noqa: PLC0415
            SentenceTransformer,
        )

        _model_cache = SentenceTransformer(name)
    return _model_cache


def encode(texts: list[str], *, batch_size: int = 32) -> np.ndarray:
    """Encode a list of texts to a (n, dim) float32 ndarray."""
    if not texts:
        return np.zeros((0, DEFAULT_DIM), dtype=np.float32)
    model = get_model()
    arrays = model.encode(texts, batch_size=batch_size, convert_to_numpy=True)
    return np.asarray(arrays, dtype=np.float32)
