"""Fine-tune DistilBERT on the preprocessed Civil Comments data.

GPU recommended (Colab T4 free tier is sufficient for 2 epochs in ~6 hours).
On CPU, use a heavily subsampled dataset for development.

Requires the `nlp` extras: `uv sync --all-packages --extra nlp`.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import ARTIFACTS_DIR, MAX_SEQUENCE_LENGTH, PROCESSED_DIR, TRAIN_PARAMS  # noqa: E402


def main() -> int:
    try:
        import numpy as np  # noqa: PLC0415
        import pandas as pd  # noqa: PLC0415
        import torch  # noqa: PLC0415
        from transformers import (  # noqa: PLC0415
            AutoModelForSequenceClassification,
            AutoTokenizer,
            DataCollatorWithPadding,
            Trainer,
            TrainingArguments,
            set_seed,
        )
    except ImportError as exc:
        print(
            "❌ NLP deps missing; run `uv sync --all-packages --extra nlp` first.",
            file=sys.stderr,
        )
        print(f"   ({exc})", file=sys.stderr)
        return 1

    seed = int(TRAIN_PARAMS["seed"])  # type: ignore[arg-type]
    set_seed(seed)

    model_name = str(TRAIN_PARAMS["model_name"])
    print(f"→ loading tokenizer + model ({model_name})")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)

    def _tokenize(batch: dict[str, list[str]]) -> dict[str, list[int]]:
        return tokenizer(batch["text"], truncation=True, max_length=MAX_SEQUENCE_LENGTH)

    print("→ loading splits")
    from datasets import Dataset  # noqa: PLC0415

    train_df = pd.read_parquet(PROCESSED_DIR / "train.parquet")[["text", "label"]]
    val_df = pd.read_parquet(PROCESSED_DIR / "validation.parquet")[["text", "label"]]
    train_ds = Dataset.from_pandas(train_df).map(_tokenize, batched=True)
    val_ds = Dataset.from_pandas(val_df).map(_tokenize, batched=True)

    args = TrainingArguments(
        output_dir=str(ARTIFACTS_DIR / "training"),
        num_train_epochs=int(TRAIN_PARAMS["num_train_epochs"]),
        per_device_train_batch_size=int(TRAIN_PARAMS["per_device_train_batch_size"]),
        per_device_eval_batch_size=int(TRAIN_PARAMS["per_device_eval_batch_size"]),
        learning_rate=float(TRAIN_PARAMS["learning_rate"]),
        warmup_steps=int(TRAIN_PARAMS["warmup_steps"]),
        weight_decay=float(TRAIN_PARAMS["weight_decay"]),
        logging_steps=int(TRAIN_PARAMS["logging_steps"]),
        eval_strategy=str(TRAIN_PARAMS["eval_strategy"]),
        save_strategy=str(TRAIN_PARAMS["save_strategy"]),
        load_best_model_at_end=True,
        seed=seed,
        report_to="none",
    )

    def _metrics(eval_pred: tuple[np.ndarray, np.ndarray]) -> dict[str, float]:
        from sklearn.metrics import roc_auc_score  # noqa: PLC0415

        logits, labels = eval_pred
        probs = torch.softmax(torch.tensor(logits), dim=-1).numpy()[:, 1]
        return {"auroc": float(roc_auc_score(labels, probs))}

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=_metrics,
    )
    print(f"→ fine-tuning on {len(train_ds):,} train examples")
    trainer.train()

    final = ARTIFACTS_DIR / "model"
    print(f"→ saving best model to {final}")
    trainer.save_model(str(final))
    tokenizer.save_pretrained(str(final))
    print(f"✓ {final}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
