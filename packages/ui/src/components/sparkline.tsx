import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export type SparklineTone = "accent" | "severity-high" | "severity-medium" | "status-ok";

const STROKE: Record<SparklineTone, string> = {
  accent: "var(--aegis-accent)",
  "severity-high": "var(--aegis-severity-high)",
  "severity-medium": "var(--aegis-severity-medium)",
  "status-ok": "var(--aegis-status-ok)",
};

const FILL_FROM: Record<SparklineTone, string> = {
  accent: "var(--aegis-accent)",
  "severity-high": "var(--aegis-severity-high)",
  "severity-medium": "var(--aegis-severity-medium)",
  "status-ok": "var(--aegis-status-ok)",
};

export interface SparklineProps {
  /** Series of y-values. The component handles min/max scaling automatically. */
  readonly values: readonly number[];
  /** Stroke + gradient tone. Defaults to the cyan-blue accent. */
  readonly tone?: SparklineTone;
  /** SVG width (default 240). */
  readonly width?: number;
  /** SVG height (default 48). */
  readonly height?: number;
  /** Optional aria-label for screen readers. */
  readonly ariaLabel?: string;
  readonly className?: string;
}

/**
 * Sparkline — single-stroke time-series with a linear gradient fill below.
 * Pure SVG; no charting library, no client JS. Used in fleet KPI tiles
 * and model cards. Spec §10.4.
 */
export function Sparkline({
  values,
  tone = "accent",
  width = 240,
  height = 48,
  ariaLabel,
  className,
}: SparklineProps): ReactNode {
  if (values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("text-aegis-fg-3", className)}
        aria-label={ariaLabel ?? "no data"}
        role="img"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="4 6"
          opacity={0.4}
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return [x, y] as const;
  });

  const pathD = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const fillD = `${pathD} L ${width.toFixed(2)},${height} L 0,${height} Z`;

  const gradientId = `aegis-spark-${tone}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-label={ariaLabel ?? "time series"}
      role="img"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={FILL_FROM[tone]} stopOpacity={0.45} />
          <stop offset="100%" stopColor={FILL_FROM[tone]} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={STROKE[tone]}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
