# Aegis · Autonomous Self-Healing Governance for ML Systems

Aegis is a multi-domain ML governance platform that closes the **MAPE-K** loop autonomously: it monitors a fleet of three production models (credit risk, toxicity, hospital readmission) for drift, bias/fairness, calibration, and operational issues; attributes detected drift to specific causal mechanisms via DoWhy GCM; selects a Pareto-optimal remediation action via a contextual bandit with knapsack constraints; executes the action under canary rollout with KPI guards and approval gates for high-risk changes; and evaluates the outcome to feed back into the bandit's posterior. Everything runs on free-tier services. Every state transition writes a Merkle-chained audit-log row.

## Design

The full design lives at [`docs/superpowers/specs/2026-04-28-aegis-design.md`](docs/superpowers/specs/2026-04-28-aegis-design.md).

## Setup

See [`setup.md`](setup.md) for installation, environment configuration, and run instructions. The setup is CI-validated nightly.

## Status

Phase 0 — repo scaffolding.

## License

MIT.
