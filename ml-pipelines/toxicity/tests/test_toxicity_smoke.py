"""End-to-end smoke test: tiny synthetic frame -> preprocess -> tiny DistilBERT -> evaluate.

Uses hf-internal-testing/tiny-random-DistilBertForSequenceClassification (87K
params, randomly-initialized, purpose-built for testing) so the test runs on
CPU in seconds. Real training uses distilbert-base-uncased (66M params) on
Colab GPU (see 03_train.py).

Skipped if `transformers` / `torch` are not installed. CI installs them with
`uv sync --all-packages --extra nlp`.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from toxicity_preprocess import (  # noqa: E402
    binarize_toxicity,
    drop_empty_text,
    identity_masks_from_frame,
    identity_mentioned,
)

pytest.importorskip("transformers")
pytest.importorskip("torch")

TINY_MODEL = "hf-internal-testing/tiny-random-DistilBertForSequenceClassification"


def _synthetic_frame(n: int = 64, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    toxic_phrases = ["go away", "you are stupid", "I hate this", "shut up", "trash"]
    benign_phrases = ["hello there", "I love this", "great article", "thank you", "well done"]
    is_toxic = rng.integers(0, 2, size=n).astype(bool)
    text = [rng.choice(toxic_phrases) if t else rng.choice(benign_phrases) for t in is_toxic]
    score = np.where(is_toxic, rng.uniform(0.6, 1.0, size=n), rng.uniform(0.0, 0.4, size=n))
    return pd.DataFrame(
        {
            "text": text,
            "toxicity": score,
            "black": rng.uniform(0, 1, size=n),
            "muslim": rng.uniform(0, 1, size=n),
            "female": rng.uniform(0, 1, size=n),
        }
    )


def test_full_pipeline_e2e() -> None:
    import torch
    from transformers import (
        AutoModelForSequenceClassification,
        AutoTokenizer,
        DataCollatorWithPadding,
        Trainer,
        TrainingArguments,
        set_seed,
    )

    set_seed(1729)

    df = _synthetic_frame(n=64)
    df = drop_empty_text(df, text_col="text")
    df = binarize_toxicity(df, score_col="toxicity", threshold=0.5)
    df = identity_mentioned(df, identity_columns=["black", "muslim", "female"], threshold=0.5)
    masks = identity_masks_from_frame(df, identity_columns=["black", "muslim", "female"])
    assert set(masks.keys()) == {"black", "muslim", "female"}

    train_df = df.iloc[:48]
    val_df = df.iloc[48:]

    tokenizer = AutoTokenizer.from_pretrained(TINY_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(TINY_MODEL, num_labels=2)

    def _tokenize(batch: dict[str, list[str]]) -> dict[str, list[int]]:
        return tokenizer(batch["text"], truncation=True, max_length=64)

    from datasets import Dataset

    train_ds = Dataset.from_pandas(train_df[["text", "label"]]).map(_tokenize, batched=True)
    val_ds = Dataset.from_pandas(val_df[["text", "label"]]).map(_tokenize, batched=True)

    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        args = TrainingArguments(
            output_dir=tmpdir,
            num_train_epochs=1,
            per_device_train_batch_size=8,
            per_device_eval_batch_size=8,
            learning_rate=5e-5,
            logging_steps=50,
            save_strategy="no",
            seed=1729,
            report_to="none",
            use_cpu=True,  # MPS path is flaky in CI; CPU is fast enough for the smoke
        )
        trainer = Trainer(
            model=model,
            args=args,
            train_dataset=train_ds,
            eval_dataset=val_ds,
            processing_class=tokenizer,
            data_collator=DataCollatorWithPadding(tokenizer),
        )
        trainer.train()

    model.eval()
    enc = tokenizer(["go away", "thank you"], padding=True, return_tensors="pt")
    with torch.no_grad():
        logits = model(**enc).logits
    probs = torch.softmax(logits, dim=-1).numpy()
    assert probs.shape == (2, 2)
    assert (probs.sum(axis=1) - 1.0 < 1e-5).all()
