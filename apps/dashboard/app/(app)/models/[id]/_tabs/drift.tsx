import type { ReactNode } from "react";

import { DistributionDiff } from "@aegis/ui";

import type { AegisModel, ModelKPI } from "../../../../_lib/types";
import { DriftSimulator } from "./_drift-simulator";

interface DriftProps {
  readonly model: AegisModel;
  readonly kpi: ModelKPI;
}

interface FeatureDriftRow {
  readonly name: string;
  readonly type: string;
  readonly psi: number;
  readonly ks: number;
  readonly status: "ok" | "warning" | "danger";
  readonly baseline: readonly number[];
  readonly current: readonly number[];
  readonly bins: readonly string[];
}

const STATUS_LABEL: Record<FeatureDriftRow["status"], string> = {
  ok: "stable",
  warning: "watch",
  danger: "drift",
};

const STATUS_TONE: Record<FeatureDriftRow["status"], string> = {
  ok: "text-status-ok border-status-ok/30 bg-status-ok-soft",
  warning: "text-sev-medium border-sev-medium/30 bg-sev-medium-soft",
  danger: "text-sev-high border-sev-high/30 bg-sev-high-soft",
};

export function ModelDriftTab({ model, kpi: _kpi }: DriftProps): ReactNode {
  const features = featuresForModel(model.id);
  const headlineMetric = featureForSimulator(model.id);

  return (
    <div className="flex flex-col gap-6">
      <DriftSimulator modelId={model.id} metric={headlineMetric} />
      <section className="aegis-card p-6">
        <header className="mb-4 flex items-baseline justify-between gap-3">
          <p className="aegis-mono-label">FEATURE DRIFT · 24H</p>
          <p className="aegis-mono text-aegis-xs text-aegis-fg-3">psi alarm 0.20 · ks alarm 0.15</p>
        </header>
        <ul className="divide-y divide-aegis-stroke">
          {features.map((f) => (
            <li
              key={f.name}
              className="grid grid-cols-1 gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-aegis-sm font-medium text-aegis-fg">{f.name}</p>
                  <span
                    className={`inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none ${STATUS_TONE[f.status]}`}
                  >
                    {STATUS_LABEL[f.status]}
                  </span>
                </div>
                <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
                  type · {f.type} · psi {f.psi.toFixed(2)} · ks {f.ks.toFixed(2)}
                </p>
              </div>
              <DistributionDiff
                baseline={f.baseline}
                current={f.current}
                binLabels={f.bins}
                severity={f.status}
                width={520}
                height={140}
                ariaLabel={`${f.name} distribution drift`}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="aegis-card p-6">
        <header className="mb-4 flex items-baseline justify-between gap-3">
          <p className="aegis-mono-label">DRIFT METHODS · NOTES</p>
        </header>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Note title="Population Stability Index (PSI)">
            Sum over bins of `(p_curr − p_base) · ln(p_curr / p_base)`. Stable below 0.10; watch
            0.10–0.20; drift above 0.20. Computed from the same Tinybird snapshot used by
            detect-tabular.
          </Note>
          <Note title="Two-sample Kolmogorov–Smirnov">
            Tests whether baseline and current samples come from the same distribution. KS &gt; 0.15
            with p &lt; 0.01 raises a watch; KS &gt; 0.20 raises a drift signal.
          </Note>
        </div>
      </section>
    </div>
  );
}

function Note({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="space-y-2 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 p-4">
      <p className="aegis-mono-label">{title.toUpperCase()}</p>
      <p className="text-aegis-xs text-aegis-fg-2 leading-aegis-snug">{children}</p>
    </div>
  );
}

// ──────────── Per-model seed features ────────────

function featureForSimulator(modelId: string): string {
  if (modelId === "credit-v1") return "demographic_parity_gender";
  if (modelId === "toxicity-v1") return "toxicity_f1";
  return "calibration_ece";
}

function featuresForModel(modelId: string): readonly FeatureDriftRow[] {
  const symmetric = (mu: number, n = 12, sigma = 1): readonly number[] => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) / 2;
      out.push(Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)));
    }
    const max = Math.max(...out);
    return out.map((v) => v / max);
  };

  if (modelId === "credit-v1") {
    return [
      {
        name: "applicant_income_thousands",
        type: "numerical",
        psi: 0.31,
        ks: 0.22,
        status: "danger",
        baseline: symmetric(0, 12, 1.5),
        current: symmetric(-0.9, 12, 1.4),
        bins: ["10", "30", "60", "90", "120", "150", "180", "210", "240", "270", "300", "330"],
      },
      {
        name: "credit_history_length_years",
        type: "numerical",
        psi: 0.08,
        ks: 0.07,
        status: "ok",
        baseline: symmetric(0.2, 10, 1.4),
        current: symmetric(0.1, 10, 1.4),
        bins: ["0", "3", "6", "9", "12", "15", "18", "21", "24", "27"],
      },
      {
        name: "applicant_age",
        type: "numerical",
        psi: 0.18,
        ks: 0.13,
        status: "warning",
        baseline: symmetric(0.4, 12, 1.6),
        current: symmetric(-0.2, 12, 1.4),
        bins: ["20", "26", "32", "38", "44", "50", "56", "62", "68", "74", "80", "86"],
      },
      {
        name: "loan_to_income_ratio",
        type: "numerical",
        psi: 0.04,
        ks: 0.05,
        status: "ok",
        baseline: symmetric(0, 10, 1.2),
        current: symmetric(0, 10, 1.2),
        bins: ["0.1", "0.3", "0.5", "0.7", "0.9", "1.1", "1.3", "1.5", "1.7", "1.9"],
      },
    ];
  }

  if (modelId === "toxicity-v1") {
    return [
      {
        name: "comment_length_tokens",
        type: "numerical",
        psi: 0.06,
        ks: 0.04,
        status: "ok",
        baseline: symmetric(-0.3, 12, 1.4),
        current: symmetric(-0.2, 12, 1.4),
        bins: ["10", "20", "40", "60", "80", "100", "150", "200", "300", "400", "500", "1000"],
      },
      {
        name: "embedding_mmd",
        type: "embedding",
        psi: 0.03,
        ks: 0.02,
        status: "ok",
        baseline: symmetric(0, 10, 1.0),
        current: symmetric(0.05, 10, 1.0),
        bins: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      },
    ];
  }

  // readmission-v1
  return [
    {
      name: "num_lab_procedures",
      type: "numerical",
      psi: 0.05,
      ks: 0.04,
      status: "ok",
      baseline: symmetric(0, 12, 1.3),
      current: symmetric(0, 12, 1.3),
      bins: ["0", "8", "16", "24", "32", "40", "48", "56", "64", "72", "80", "100"],
    },
    {
      name: "n_outpatient_visits",
      type: "numerical",
      psi: 0.07,
      ks: 0.04,
      status: "ok",
      baseline: symmetric(-0.4, 10, 1.0),
      current: symmetric(-0.4, 10, 1.0),
      bins: ["0", "1", "2", "3", "4", "6", "8", "10", "15", "20"],
    },
  ];
}
