import type { ReactNode } from "react";

import { KPITile, Sparkline } from "@aegis/ui";

import type { AegisModel, ModelKPI } from "../../../../_lib/types";

interface PerformanceProps {
  readonly model: AegisModel;
  readonly kpi: ModelKPI;
}

interface PerfRow {
  readonly metric: string;
  readonly value: number;
  readonly floor: number;
  readonly status: "ok" | "warning" | "danger";
}

export function ModelPerformanceTab({ model, kpi }: PerformanceProps): ReactNode {
  const rows = perfRows(model.id);
  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KPITile
          label="Latency · p50"
          value={`${kpi.p50_latency_ms}ms`}
          trend="last 24h median"
          tone="ok"
        >
          <Sparkline
            values={kpi.latency_trend.map((p) => p.v)}
            tone="accent"
            width={220}
            height={42}
          />
        </KPITile>
        <KPITile
          label="Latency · p95"
          value={`${kpi.p95_latency_ms}ms`}
          trend="2 standard deviations"
          tone="ok"
        >
          <Sparkline
            values={kpi.latency_trend.map((p) => p.v * 1.4)}
            tone="accent"
            width={220}
            height={42}
          />
        </KPITile>
        <KPITile
          label="Throughput · 24h"
          value={kpi.predictions_total.toLocaleString("en-US")}
          trend="predictions served"
        >
          <Sparkline
            values={kpi.predictions_trend.map((p) => p.v)}
            tone="accent"
            width={220}
            height={42}
          />
        </KPITile>
      </section>

      <section className="aegis-card overflow-hidden">
        <table className="w-full divide-y divide-aegis-stroke">
          <thead>
            <tr className="text-aegis-fg-3">
              <Th>METRIC</Th>
              <Th align="right">VALUE</Th>
              <Th align="right">FLOOR</Th>
              <Th align="right">STATUS</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-aegis-stroke">
            {rows.map((row) => (
              <tr key={row.metric}>
                <Td>{row.metric}</Td>
                <Td align="right" mono>
                  {row.value.toFixed(3)}
                </Td>
                <Td align="right" mono className="text-aegis-fg-3">
                  {row.floor.toFixed(3)}
                </Td>
                <Td align="right">
                  <span
                    className={`inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none ${
                      row.status === "ok"
                        ? "border-status-ok/30 bg-status-ok-soft text-status-ok"
                        : row.status === "warning"
                          ? "border-sev-medium/30 bg-sev-medium-soft text-sev-medium"
                          : "border-sev-high/30 bg-sev-high-soft text-sev-high"
                    }`}
                  >
                    {row.status === "ok"
                      ? "passing"
                      : row.status === "warning"
                        ? "watch"
                        : "breach"}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  readonly children: ReactNode;
  readonly align?: "left" | "right";
}): ReactNode {
  return (
    <th
      scope="col"
      className={`aegis-mono-label py-3 px-4 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono = false,
  className = "",
}: {
  readonly children: ReactNode;
  readonly align?: "left" | "right";
  readonly mono?: boolean;
  readonly className?: string;
}): ReactNode {
  return (
    <td
      className={`px-4 py-3 text-aegis-sm ${align === "right" ? "text-right" : "text-left"} ${mono ? "font-mono tabular-nums text-aegis-fg" : "text-aegis-fg-2"} ${className}`}
    >
      {children}
    </td>
  );
}

function perfRows(modelId: string): readonly PerfRow[] {
  if (modelId === "credit-v1") {
    return [
      { metric: "AUC", value: 0.872, floor: 0.84, status: "ok" },
      { metric: "KS", value: 0.41, floor: 0.35, status: "ok" },
      { metric: "Brier", value: 0.131, floor: 0.15, status: "ok" },
      { metric: "Precision @ 0.5", value: 0.79, floor: 0.75, status: "ok" },
      { metric: "Recall @ 0.5", value: 0.71, floor: 0.7, status: "ok" },
      { metric: "F1", value: 0.75, floor: 0.72, status: "ok" },
    ];
  }
  if (modelId === "toxicity-v1") {
    return [
      { metric: "F1", value: 0.81, floor: 0.78, status: "ok" },
      { metric: "Precision", value: 0.79, floor: 0.75, status: "ok" },
      { metric: "Recall", value: 0.83, floor: 0.78, status: "ok" },
      { metric: "AUC", value: 0.91, floor: 0.86, status: "ok" },
      { metric: "ECE", value: 0.018, floor: 0.05, status: "ok" },
    ];
  }
  return [
    { metric: "AUC", value: 0.78, floor: 0.75, status: "ok" },
    { metric: "Brier", value: 0.146, floor: 0.18, status: "ok" },
    { metric: "ECE", value: 0.041, floor: 0.05, status: "ok" },
    { metric: "Sensitivity @ 0.5", value: 0.6, floor: 0.55, status: "ok" },
    { metric: "Specificity @ 0.5", value: 0.79, floor: 0.75, status: "ok" },
  ];
}
