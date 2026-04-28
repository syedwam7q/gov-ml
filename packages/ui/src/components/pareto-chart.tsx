import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface ParetoCandidate {
  /** Stable id used as React key. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** Action kind — drives the small mono prefix tag. */
  readonly kind: string;
  /** Three reward axes. All in [0, 1]. */
  readonly utility: number;
  readonly safety: number;
  readonly cost: number;
  /** True when this candidate is on the Pareto frontier (non-dominated). */
  readonly pareto: boolean;
  /** True when this candidate was the operator-approved choice. */
  readonly selected: boolean;
  /** Optional one-line explanation. */
  readonly explanation?: string;
}

export interface ParetoChartProps {
  readonly candidates: readonly ParetoCandidate[];
  /** Optional caption shown beneath the chart. */
  readonly caption?: string;
  readonly className?: string;
}

/**
 * ParetoChart — three-axis (utility · safety · cost) reward bars per
 * candidate action with frontier highlight and the selected action
 * marked. Designed for the /incidents/[id] action-plan section. Spec
 * §10.4 + §12.2 (Pareto-optimal action selection research extension).
 *
 * Pure CSS / SVG-free. Each candidate row renders three calibrated
 * bars; the cost bar inverts (lower cost = higher fill) so the eye
 * reads "more bar = better" across all axes.
 */
export function ParetoChart({ candidates, caption, className }: ParetoChartProps): ReactNode {
  return (
    <figure className={cn("aegis-card flex flex-col gap-3 p-6", className)}>
      <header className="flex items-baseline justify-between gap-4">
        <p className="aegis-mono-label">CANDIDATE ACTIONS · PARETO FRONTIER</p>
        <p className="aegis-mono text-aegis-xs text-aegis-fg-3">utility · safety · 1 − cost</p>
      </header>
      <ol className="divide-y divide-aegis-stroke -mx-2">
        {candidates.map((c) => (
          <li key={c.id} className="px-2 py-4">
            <div className="flex flex-wrap items-baseline gap-2">
              {c.selected ? (
                <span
                  aria-label="selected"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-status-ok text-aegis-bg"
                >
                  <CheckIcon />
                </span>
              ) : c.pareto ? (
                <span
                  aria-label="pareto frontier"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-aegis-accent text-aegis-accent"
                >
                  ◆
                </span>
              ) : (
                <span
                  aria-label="dominated"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-aegis-stroke text-aegis-fg-3"
                >
                  ·
                </span>
              )}
              <span className="text-aegis-sm font-medium text-aegis-fg">{c.label}</span>
              <span className="aegis-mono text-aegis-xs text-aegis-fg-3">{c.kind}</span>
              {c.selected ? (
                <span className="ml-auto aegis-mono text-aegis-xs text-status-ok">SELECTED</span>
              ) : c.pareto ? (
                <span className="ml-auto aegis-mono text-aegis-xs text-aegis-accent">PARETO</span>
              ) : (
                <span className="ml-auto aegis-mono text-aegis-xs text-aegis-fg-3">DOMINATED</span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Bar label="utility" value={c.utility} highlight={c.selected} />
              <Bar label="safety" value={c.safety} highlight={c.selected} />
              <Bar label="1 − cost" value={1 - c.cost} highlight={c.selected} />
            </div>
            {c.explanation ? (
              <p className="mt-2 text-aegis-xs text-aegis-fg-3 leading-aegis-snug">
                {c.explanation}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {caption ? <p className="aegis-mono text-aegis-xs text-aegis-fg-3 mt-1">{caption}</p> : null}
    </figure>
  );
}

function Bar({
  label,
  value,
  highlight,
}: {
  readonly label: string;
  readonly value: number;
  readonly highlight: boolean;
}): ReactNode {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="aegis-mono text-aegis-xs text-aegis-fg-3">{label}</span>
        <span className="aegis-mono text-aegis-xs text-aegis-fg-2 tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-aegis-pill bg-aegis-surface-2 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-aegis-pill",
            highlight ? "bg-status-ok" : "bg-aegis-accent",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
