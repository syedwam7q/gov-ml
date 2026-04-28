import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface FairnessHeatmapCell {
  readonly value: number;
  /**
   * Pass / watch / fail relative to the policy threshold. Drives the cell tint.
   */
  readonly status: "ok" | "warning" | "danger";
  /** Optional tooltip-grade hint. */
  readonly hint?: string;
}

export interface FairnessHeatmapProps {
  /** Y-axis subgroup labels — e.g. ["Female", "Male", "Non-binary"]. */
  readonly subgroups: readonly string[];
  /** X-axis metric labels — e.g. ["DP", "EO", "FPR", "FNR"]. */
  readonly metrics: readonly string[];
  /**
   * Cell matrix: cells[row][col]. Row order matches `subgroups`, col matches
   * `metrics`. `null` cells render as N/A tiles.
   */
  readonly cells: readonly (readonly (FairnessHeatmapCell | null)[])[];
  /** Callout below the matrix — typically the policy floor expression. */
  readonly footnote?: string;
  readonly className?: string;
}

const STATUS_TONE: Record<FairnessHeatmapCell["status"], string> = {
  ok: "bg-status-ok-soft text-status-ok border-status-ok/30",
  warning: "bg-sev-medium-soft text-sev-medium border-sev-medium/30",
  danger: "bg-sev-high-soft text-sev-high border-sev-high/40",
};

/**
 * FairnessHeatmap — a compact per-subgroup × per-metric grid. The cell
 * tint encodes pass/watch/fail relative to the policy threshold; the
 * cell value renders the underlying metric to two decimals. Spec §10.4.
 */
export function FairnessHeatmap({
  subgroups,
  metrics,
  cells,
  footnote,
  className,
}: FairnessHeatmapProps): ReactNode {
  return (
    <div className={cn("aegis-card overflow-hidden", className)}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `minmax(140px, 1fr) repeat(${metrics.length}, minmax(80px, 1fr))`,
        }}
      >
        <div className="aegis-mono-label flex items-end px-4 py-3">SUBGROUP</div>
        {metrics.map((m) => (
          <div
            key={m}
            className="aegis-mono-label flex items-end justify-center px-2 py-3 text-center"
          >
            {m.toUpperCase()}
          </div>
        ))}
        {subgroups.map((subgroup, rowIdx) => (
          <Row
            key={subgroup}
            subgroup={subgroup}
            cells={cells[rowIdx] ?? []}
            metrics={metrics}
            isLast={rowIdx === subgroups.length - 1}
          />
        ))}
      </div>
      {footnote ? (
        <p className="border-t border-aegis-stroke px-4 py-2 aegis-mono text-aegis-xs text-aegis-fg-3">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

interface RowProps {
  readonly subgroup: string;
  readonly cells: readonly (FairnessHeatmapCell | null)[];
  readonly metrics: readonly string[];
  readonly isLast: boolean;
}

function Row({ subgroup, cells, metrics, isLast }: RowProps): ReactNode {
  return (
    <>
      <div
        className={cn(
          "flex items-center px-4 py-3 text-aegis-sm text-aegis-fg",
          isLast ? "" : "border-b border-aegis-stroke",
        )}
      >
        {subgroup}
      </div>
      {metrics.map((metricLabel, colIdx) => {
        const cell = cells[colIdx] ?? null;
        return (
          <div
            key={`${subgroup}-${metricLabel}`}
            className={cn(
              "flex items-center justify-center px-2 py-3",
              isLast ? "" : "border-b border-aegis-stroke",
            )}
          >
            {cell ? (
              <span
                title={cell.hint ?? `${metricLabel} = ${cell.value}`}
                className={cn(
                  "min-w-[3.5rem] inline-flex items-center justify-center rounded-aegis-control border px-2 py-1 font-mono tabular-nums text-[12px]",
                  STATUS_TONE[cell.status],
                )}
              >
                {cell.value.toFixed(2)}
              </span>
            ) : (
              <span className="aegis-mono text-aegis-xs text-aegis-fg-disabled">n/a</span>
            )}
          </div>
        );
      })}
    </>
  );
}
