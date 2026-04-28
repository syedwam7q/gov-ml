# readmission-v2 — hospital-readmission classifier

XGBoost binary classifier on UCI Diabetes 130-US Hospitals (Strack et al. 2014). Predicts whether a diabetes inpatient will be readmitted within 30 days of discharge.

**Anchor incidents**

- Obermeyer, Powers, Vogeli, Mullainathan, Science 2019 — Optum risk-stratifier predicted cost rather than illness; at the same risk score Black patients were sicker. The Aegis fix raises Black patients getting extra care from 17.7% → 46.5%.
- Sjoding et al., NEJM 2020 — pulse oximetry racial bias propagating into downstream ML.
- Strack et al., 2014 — original Diabetes 130-US paper documenting HbA1c testing/readmission disparities.

**Pipeline**

    python 01_download.py            # downloads + extracts UCI ZIP to data/raw/readmission/
    python 02_preprocess.py          # writes data/processed/readmission/{train,val,test}.parquet
    python 03_train.py               # writes artifacts/model.json
    python 04_evaluate.py            # writes artifacts/evaluation.json
    python 05_generate_artifacts.py  # writes model card + datasheet + causal_dag.json

**Reproducibility**

- Random seed pinned at 1729 (see `aegis_pipelines.seed`).
- Dataset SHA-256 pinned in `config.py`.
- Train/val/test split is deterministic stratified, 80 / 10 / 10.

**Label binarization**

The raw `readmitted` column has three values (`NO`, `<30`, `>30`). We collapse to a binary outcome — **1 = readmitted within 30 days**, 0 otherwise — because that is the clinically actionable signal and the one studied in the bias literature.
