# toxicity-v3 — toxicity classifier

DistilBERT fine-tuned binary classifier on Jigsaw Civil Comments (Borkan et al. 2019). Predicts whether a comment is toxic; evaluated with subgroup AUC, BPSN, and BNSP per identity.

**Anchor incidents**

- Borkan et al. 2019 — "Nuanced Metrics for Measuring Unintended Bias..." (WWW '19, arXiv:1903.04561). Defines the Civil Comments dataset and the subgroup-AUC / BPSN / BNSP metrics we use here.
- Dixon et al. 2018 — "Measuring and Mitigating Unintended Bias in Text Classification" (AIES). Documents that "gay", "Muslim", etc. inflate Perspective API toxicity.
- Sap, Card, Gabriel, Choi, Smith, ACL 2019 — "The Risk of Racial Bias in Hate Speech Detection." AAE-dialect tweets up to 2× more likely to be flagged offensive.

**Pipeline**

    python 01_download.py            # fetches Civil Comments via HuggingFace `datasets`
    python 02_preprocess.py          # tokenize + binarize + identity columns
    python 03_train.py               # DistilBERT fine-tune (Colab GPU recommended; CPU works on tiny subsets)
    python 04_evaluate.py            # subgroup AUC + BPSN + BNSP per identity
    python 05_generate_artifacts.py  # writes model card + datasheet + causal_dag.json

**Reproducibility**

- Random seed pinned at 1729.
- Model: `distilbert-base-uncased`, fine-tuned for 2 epochs (real); `prajjwal1/bert-tiny` used in CI smoke test.
- 1.8M-comment Jigsaw Civil Comments via HuggingFace Hub (`google/civil_comments`).
- Train/val/test split is the official Jigsaw split.

**Compute note**

Real fine-tuning on the full 1.8M-comment corpus needs a GPU. Recommended: Google Colab free tier (T4 GPU, ~12 hours/week sufficient). The training script is Colab-ready — it auto-detects GPU and adjusts batch size. CPU works on small subsets for development.

**Identity columns (Borkan 2019)**

`asian`, `atheist`, `bisexual`, `black`, `buddhist`, `christian`, `female`, `heterosexual`, `hindu`, `homosexual_gay_or_lesbian`, `intellectual_or_learning_disability`, `jewish`, `latino`, `male`, `muslim`, `other_disability`, `other_gender`, `other_race_or_ethnicity`, `other_religion`, `other_sexual_orientation`, `physical_disability`, `psychiatric_or_mental_illness`, `transgender`, `white`.

A comment "mentions" an identity when its column value ≥ 0.5 (Jigsaw convention).
