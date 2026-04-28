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
- Dataset SHA-256 pinned in `01_download.py` / `config.py`.
- Train/val/test split is deterministic stratified, 80 / 10 / 10.
