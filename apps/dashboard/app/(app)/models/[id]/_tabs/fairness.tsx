import type { ReactNode } from "react";

import { FairnessHeatmap, type FairnessHeatmapCell } from "@aegis/ui";

import type { AegisModel } from "../../../../_lib/types";

interface FairnessProps {
  readonly model: AegisModel;
}

interface FairnessSeed {
  readonly subgroups: readonly string[];
  readonly metrics: readonly string[];
  readonly cells: readonly (readonly (FairnessHeatmapCell | null)[])[];
  readonly footnote: string;
}

const cell = (
  value: number,
  status: FairnessHeatmapCell["status"],
  hint?: string,
): FairnessHeatmapCell => ({ value, status, ...(hint !== undefined ? { hint } : {}) });

export function ModelFairnessTab({ model }: FairnessProps): ReactNode {
  const seed = fairnessSeed(model.id);

  return (
    <div className="flex flex-col gap-6">
      <FairnessHeatmap
        subgroups={seed.subgroups}
        metrics={seed.metrics}
        cells={seed.cells}
        footnote={seed.footnote}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="aegis-card p-5">
          <p className="aegis-mono-label">DEMOGRAPHIC PARITY</p>
          <p className="mt-2 text-aegis-base text-aegis-fg leading-aegis-snug">
            Pr(Ŷ = 1 | A = a) ÷ Pr(Ŷ = 1 | A = a*) — passes when the smallest group's positive rate
            ≥ 0.80 of the reference. Aegis raises HIGH below 0.80.
          </p>
        </article>
        <article className="aegis-card p-5">
          <p className="aegis-mono-label">EQUAL OPPORTUNITY</p>
          <p className="mt-2 text-aegis-base text-aegis-fg leading-aegis-snug">
            TPR(A = a) − TPR(A = a*) — passes when within ±0.05 of the reference. Aegis raises
            MEDIUM beyond ±0.07 and HIGH beyond ±0.10.
          </p>
        </article>
        <article className="aegis-card p-5">
          <p className="aegis-mono-label">CALIBRATION BY GROUP</p>
          <p className="mt-2 text-aegis-base text-aegis-fg leading-aegis-snug">
            Per-group ECE — should match within 0.02 of the reference group. Drift here is the
            earliest signal of mis-fit on protected populations.
          </p>
        </article>
      </section>
    </div>
  );
}

function fairnessSeed(modelId: string): FairnessSeed {
  if (modelId === "credit-v1") {
    return {
      subgroups: ["Female", "Male", "Non-binary", "Black", "Hispanic", "White"],
      metrics: ["DP", "EO", "FPR", "FNR", "ECE"],
      footnote: "Floors · DP ≥ 0.80, |EO| ≤ 0.05, |FPR Δ| ≤ 0.05, |FNR Δ| ≤ 0.05, ECE ≤ 0.05",
      cells: [
        [
          cell(0.71, "danger", "DP_gender = 0.71 — driving the active incident"),
          cell(0.09, "warning"),
          cell(0.07, "warning"),
          cell(0.04, "ok"),
          cell(0.06, "warning"),
        ],
        [
          cell(1.0, "ok"),
          cell(0.0, "ok"),
          cell(0.0, "ok", "reference"),
          cell(0.0, "ok"),
          cell(0.04, "ok"),
        ],
        [cell(0.86, "ok"), cell(0.04, "ok"), cell(0.03, "ok"), cell(0.05, "ok"), cell(0.05, "ok")],
        [
          cell(0.84, "ok"),
          cell(0.06, "warning"),
          cell(0.05, "ok"),
          cell(0.03, "ok"),
          cell(0.05, "ok"),
        ],
        [cell(0.88, "ok"), cell(0.04, "ok"), cell(0.03, "ok"), cell(0.05, "ok"), cell(0.05, "ok")],
        [
          cell(1.0, "ok"),
          cell(0.0, "ok"),
          cell(0.0, "ok", "reference"),
          cell(0.0, "ok"),
          cell(0.04, "ok"),
        ],
      ],
    };
  }
  if (modelId === "toxicity-v1") {
    return {
      subgroups: ["AAVE", "Standard English", "Mention-based identity", "Code-mixed"],
      metrics: ["FPR", "FNR", "F1", "ECE"],
      footnote: "Floors · |FPR Δ| ≤ 0.05, F1 ≥ 0.78, ECE ≤ 0.05",
      cells: [
        [cell(0.08, "ok"), cell(0.11, "ok"), cell(0.78, "ok"), cell(0.05, "ok")],
        [cell(0.06, "ok", "reference"), cell(0.1, "ok"), cell(0.81, "ok"), cell(0.04, "ok")],
        [cell(0.09, "warning"), cell(0.12, "ok"), cell(0.77, "warning"), cell(0.05, "ok")],
        [cell(0.07, "ok"), cell(0.13, "ok"), cell(0.79, "ok"), cell(0.05, "ok")],
      ],
    };
  }
  return {
    subgroups: ["Black", "Hispanic", "White", "Asian", "Other"],
    metrics: ["DP", "EO", "ECE"],
    footnote: "Floors · DP ≥ 0.80, |EO| ≤ 0.05, ECE ≤ 0.05 — research only; not used for triage",
    cells: [
      [cell(0.92, "ok"), cell(0.03, "ok"), cell(0.04, "ok")],
      [cell(0.94, "ok"), cell(0.02, "ok"), cell(0.03, "ok")],
      [cell(1.0, "ok", "reference"), cell(0.0, "ok"), cell(0.04, "ok")],
      [cell(0.96, "ok"), cell(0.02, "ok"), cell(0.03, "ok")],
      [cell(0.91, "ok"), cell(0.04, "ok"), cell(0.05, "ok")],
    ],
  };
}
