import type { ReactNode } from "react";

import { CalibrationPlot, type CalibrationBucket } from "@aegis/ui";

import type { AegisModel, ModelKPI } from "../../../../_lib/types";

interface CalibrationProps {
  readonly model: AegisModel;
  readonly kpi: ModelKPI;
}

interface CalibrationSeed {
  readonly buckets: readonly CalibrationBucket[];
  readonly brier: number;
  readonly ece: number;
  readonly summary: string;
}

export function ModelCalibrationTab({ model, kpi: _kpi }: CalibrationProps): ReactNode {
  const seed = calibrationSeed(model.id);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <CalibrationPlot buckets={seed.buckets} brier={seed.brier} ece={seed.ece} />
      <section className="aegis-card flex flex-col gap-4 p-6">
        <header>
          <p className="aegis-mono-label">CALIBRATION · NOTES</p>
        </header>
        <p className="text-aegis-sm text-aegis-fg-2 leading-aegis-snug">{seed.summary}</p>
        <dl className="grid grid-cols-2 gap-4">
          <Stat label="Brier" value={seed.brier.toFixed(3)} hint="lower is better" />
          <Stat label="ECE" value={seed.ece.toFixed(3)} hint="lower is better" />
          <Stat label="Buckets" value={String(seed.buckets.length)} hint="equal-width 0..1" />
          <Stat
            label="Samples"
            value={seed.buckets.reduce((s, b) => s + b.n, 0).toLocaleString("en-US")}
            hint="last 24h window"
          />
        </dl>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}): ReactNode {
  return (
    <div className="space-y-1">
      <dt className="aegis-mono-label">{label.toUpperCase()}</dt>
      <dd className="text-aegis-md font-semibold tabular-nums text-aegis-fg">{value}</dd>
      <dd className="aegis-mono text-aegis-xs text-aegis-fg-3">{hint}</dd>
    </div>
  );
}

function calibrationSeed(modelId: string): CalibrationSeed {
  if (modelId === "credit-v1") {
    return {
      buckets: [
        { predicted: 0.05, observed: 0.04, n: 6_400 },
        { predicted: 0.15, observed: 0.13, n: 5_900 },
        { predicted: 0.25, observed: 0.22, n: 5_200 },
        { predicted: 0.35, observed: 0.34, n: 4_800 },
        { predicted: 0.45, observed: 0.46, n: 3_900 },
        { predicted: 0.55, observed: 0.58, n: 3_400 },
        { predicted: 0.65, observed: 0.7, n: 2_700 },
        { predicted: 0.75, observed: 0.78, n: 2_100 },
        { predicted: 0.85, observed: 0.83, n: 1_500 },
        { predicted: 0.95, observed: 0.91, n: 800 },
      ],
      brier: 0.131,
      ece: 0.038,
      summary:
        "Model is well-calibrated overall (ECE 0.038). The slight upward bias in the 0.55–0.75 range correlates with the recent income-distribution drift; rerun with isotonic-regression recalibration scheduled post-rollback.",
    };
  }
  if (modelId === "toxicity-v1") {
    return {
      buckets: [
        { predicted: 0.05, observed: 0.06, n: 16_000 },
        { predicted: 0.15, observed: 0.16, n: 13_400 },
        { predicted: 0.25, observed: 0.25, n: 11_900 },
        { predicted: 0.35, observed: 0.34, n: 9_800 },
        { predicted: 0.45, observed: 0.46, n: 8_700 },
        { predicted: 0.55, observed: 0.55, n: 7_400 },
        { predicted: 0.65, observed: 0.66, n: 6_100 },
        { predicted: 0.75, observed: 0.76, n: 4_800 },
        { predicted: 0.85, observed: 0.84, n: 3_300 },
        { predicted: 0.95, observed: 0.93, n: 1_800 },
      ],
      brier: 0.092,
      ece: 0.018,
      summary:
        "Toxicity-v1 calibration is excellent — ECE 0.018, well below the policy floor of 0.05. No recalibration recommended.",
    };
  }
  return {
    buckets: [
      { predicted: 0.05, observed: 0.05, n: 1_400 },
      { predicted: 0.15, observed: 0.18, n: 1_300 },
      { predicted: 0.25, observed: 0.28, n: 1_200 },
      { predicted: 0.35, observed: 0.38, n: 1_000 },
      { predicted: 0.45, observed: 0.49, n: 800 },
      { predicted: 0.55, observed: 0.6, n: 700 },
      { predicted: 0.65, observed: 0.7, n: 500 },
      { predicted: 0.75, observed: 0.79, n: 380 },
      { predicted: 0.85, observed: 0.84, n: 220 },
      { predicted: 0.95, observed: 0.9, n: 120 },
    ],
    brier: 0.146,
    ece: 0.041,
    summary:
      "Readmission-v1 is mildly over-confident at the high end. Within policy floor, but flagged for next monthly clinical-AI review per the spec §5.1 invariants.",
  };
}
