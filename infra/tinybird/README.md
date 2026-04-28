# Tinybird configuration for Aegis

Tinybird is the **hot metrics fast-path**. The control plane's audit log goes to Postgres (Neon); high-volume per-prediction metrics, drift signals, and subgroup counters go here. Tinybird turns each `.pipe` into an authenticated REST endpoint that the dashboard queries directly — no extra metrics-API layer.

## Files

| Kind          | File                                       | What it stores / serves                                              |
| ------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `.datasource` | `datasources/predictions.datasource`       | One row per inference. Append-only.                                  |
| `.datasource` | `datasources/signals.datasource`           | One row per detection signal (drift / fairness / calibration / ops). |
| `.datasource` | `datasources/subgroup_counters.datasource` | Per-subgroup, per-window counts for fairness charts.                 |
| `.pipe`       | `pipes/drift_window.pipe`                  | Rolling drift signals per model + metric.                            |
| `.pipe`       | `pipes/fairness_window.pipe`               | Rolling subgroup fairness deltas per model.                          |
| `.pipe`       | `pipes/prediction_volume.pipe`             | Predictions / hour per model — for the fleet KPI tile.               |
| `.endpoint`   | `endpoints/drift_window.endpoint`          | Public dashboard endpoint over `drift_window.pipe`.                  |
| `.endpoint`   | `endpoints/fairness_window.endpoint`       | Public dashboard endpoint over `fairness_window.pipe`.               |

## Free-tier scale

10 GB processed / month (Build plan). At ~1 M predictions / day with rolled-up materialized aggregates, this stays well inside the limit. Cold rows older than 7 days are archived to DuckDB on Vercel Blob (Phase 3 wiring).

## Push the configuration

Once you have `tb` installed (`brew install tinybirdco/tinybird/tinybird-cli`) and authenticated (`tb auth`):

    cd infra/tinybird
    tb push --force

That uploads every `.datasource` / `.pipe` / `.endpoint` to your Tinybird workspace. Run again any time the configuration changes — `tb push --force` reconciles diffs.

## How services talk to Tinybird

| Direction                                           | How                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Inference services → `predictions`                  | `POST https://api.tinybird.co/v0/events?name=predictions` with the row as JSON, using `TINYBIRD_TOKEN`. |
| Detection services → `signals`, `subgroup_counters` | Same pattern, different datasource.                                                                     |
| Dashboard → `drift_window`, `fairness_window`       | `GET <endpoint URL>?model_id=credit-v1&window=24h&token=<read-only token>`.                             |

Token scopes are managed in the Tinybird UI: one **append-only** token per inference / detection service, one **read-only** token used only by the dashboard.
