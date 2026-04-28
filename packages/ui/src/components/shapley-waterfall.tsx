import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface ShapleyContribution {
  /** Feature label. */
  readonly feature: string;
  /** Signed contribution to the metric — positive moves toward observed, negative away. */
  readonly value: number;
  /** Optional one-line context shown below the bar. */
  readonly hint?: string;
}

export interface ShapleyWaterfallProps {
  /** Baseline metric value (where the waterfall starts). */
  readonly baseline: number;
  /** Observed metric value (where the waterfall ends). */
  readonly observed: number;
  /** Per-feature contributions. Sum should approximately equal observed − baseline. */
  readonly contributions: readonly ShapleyContribution[];
  /** Metric label, e.g. "DP_gender". */
  readonly metric: string;
  /** Number formatter for axis values. Default 2 decimals. */
  readonly formatValue?: (n: number) => string;
  readonly className?: string;
}

/**
 * ShapleyWaterfall — vertical waterfall chart of feature contributions.
 *
 * The first row is the baseline; the last row is the observed value;
 * intermediate rows show each feature's signed contribution as a bar
 * positioned along a normalized axis. Negative contributions render in
 * the high-severity tone, positive in accent.
 *
 * Pure CSS — no SVG layout math beyond a horizontal scale. Spec §10.4.
 */
export function ShapleyWaterfall({
  baseline,
  observed,
  contributions,
  metric,
  formatValue = (n) => n.toFixed(2),
  className,
}: ShapleyWaterfallProps): ReactNode {
  // Normalize to the [min, max] range observed in the cumulative path.
  const path = [baseline];
  let running = baseline;
  for (const c of contributions) {
    running += c.value;
    path.push(running);
  }
  const min = Math.min(...path, observed);
  const max = Math.max(...path, observed);
  const span = max - min || 1;
  const pos = (v: number): number => ((v - min) / span) * 100;

  let cumulative = baseline;

  return (
    <figure
      aria-label={`Shapley waterfall for ${metric}`}
      className={cn("aegis-card flex flex-col gap-4 p-6", className)}
    >
      <header className="flex items-baseline justify-between gap-3">
        <p className="aegis-mono-label">SHAPLEY WATERFALL · {metric.toUpperCase()}</p>
        <p className="aegis-mono text-aegis-xs text-aegis-fg-3 tabular-nums">
          baseline {formatValue(baseline)} → observed {formatValue(observed)}
        </p>
      </header>

      <ol className="space-y-2">
        <Row
          label="baseline"
          hint="prior to drift"
          left={pos(min)}
          right={pos(baseline)}
          fill="bg-aegis-surface-3"
          value={formatValue(baseline)}
          mono
        />
        {contributions.map((c) => {
          const start = cumulative;
          cumulative += c.value;
          const end = cumulative;
          const left = Math.min(pos(start), pos(end));
          const right = Math.max(pos(start), pos(end));
          const positive = c.value >= 0;
          return (
            <Row
              key={c.feature}
              label={c.feature}
              hint={c.hint}
              left={left}
              right={right}
              fill={positive ? "bg-aegis-accent" : "bg-sev-high"}
              value={`${positive ? "+" : "−"}${formatValue(Math.abs(c.value))}`}
            />
          );
        })}
        <Row
          label="observed"
          hint={`final ${metric}`}
          left={pos(min)}
          right={pos(observed)}
          fill="bg-aegis-fg-disabled"
          value={formatValue(observed)}
          mono
        />
      </ol>

      <footer className="flex items-center justify-between gap-4 text-aegis-xs text-aegis-fg-3 border-t border-aegis-stroke pt-3 aegis-mono">
        <span>min {formatValue(min)}</span>
        <span>max {formatValue(max)}</span>
      </footer>
    </figure>
  );
}

interface RowProps {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly left: number;
  readonly right: number;
  readonly fill: string;
  readonly value: string;
  readonly mono?: boolean | undefined;
}

function Row({ label, hint, left, right, fill, value, mono }: RowProps): ReactNode {
  return (
    <li className="grid grid-cols-[160px_minmax(0,1fr)_72px] items-center gap-3">
      <div className="space-y-0.5">
        <p
          className={cn(
            "text-aegis-sm leading-tight",
            mono ? "aegis-mono text-aegis-fg-2" : "text-aegis-fg",
          )}
        >
          {label}
        </p>
        {hint ? (
          <p className="aegis-mono text-[10px] text-aegis-fg-3 leading-tight truncate">{hint}</p>
        ) : null}
      </div>
      <div className="relative h-3 rounded-aegis-pill bg-aegis-surface-2">
        <span
          aria-hidden
          className={cn("absolute top-0 h-3 rounded-aegis-pill", fill)}
          style={{
            left: `${left.toFixed(2)}%`,
            width: `${Math.max(0.5, right - left).toFixed(2)}%`,
          }}
        />
      </div>
      <span className="aegis-mono text-aegis-xs tabular-nums text-aegis-fg-2 text-right">
        {value}
      </span>
    </li>
  );
}
