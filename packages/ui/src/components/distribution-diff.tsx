import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface DistributionDiffProps {
  /** Bin edges + densities for the baseline (training) distribution. */
  readonly baseline: readonly number[];
  /** Bin edges + densities for the current distribution — must match baseline length. */
  readonly current: readonly number[];
  /** Optional bin labels for the x-axis (rendered every N bins). */
  readonly binLabels?: readonly string[];
  /** Severity tone — drives the current-distribution color. */
  readonly severity?: "ok" | "warning" | "danger";
  /** Width of the rendered SVG. Default 480. */
  readonly width?: number;
  /** Height of the rendered SVG. Default 160. */
  readonly height?: number;
  /** Optional aria-label override. */
  readonly ariaLabel?: string;
  readonly className?: string;
}

const PALETTE: Record<NonNullable<DistributionDiffProps["severity"]>, string> = {
  ok: "var(--aegis-status-ok)",
  warning: "var(--aegis-severity-medium)",
  danger: "var(--aegis-severity-high)",
};

/**
 * DistributionDiff — overlays two density distributions to make a drift
 * intuitively legible. The baseline is rendered as a faint dashed
 * outline; the current distribution as a filled gradient in the
 * severity tone. Spec §10.4.
 *
 * Pure SVG, no charting library. Computes a max from both inputs so
 * the curves always stay inside the viewport.
 */
export function DistributionDiff({
  baseline,
  current,
  binLabels,
  severity = "ok",
  width = 480,
  height = 160,
  ariaLabel,
  className,
}: DistributionDiffProps): ReactNode {
  if (baseline.length !== current.length || baseline.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("text-aegis-fg-3", className)}
        aria-label={ariaLabel ?? "no data"}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeDasharray="4 6"
          opacity={0.4}
        />
      </svg>
    );
  }

  const max = Math.max(...baseline, ...current) || 1;
  const padX = 8;
  const padY = 12;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const stepX = usableW / (baseline.length - 1);

  const toPath = (vals: readonly number[]): string => {
    return vals
      .map((v, i) => {
        const x = padX + i * stepX;
        const y = padY + usableH - (v / max) * usableH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  };

  const baselinePath = toPath(baseline);
  const currentPath = toPath(current);
  const fillPath = `${currentPath} L ${(padX + (baseline.length - 1) * stepX).toFixed(2)},${(padY + usableH).toFixed(2)} L ${padX.toFixed(2)},${(padY + usableH).toFixed(2)} Z`;
  const tone = PALETTE[severity];
  const gradientId = `aegis-dist-${severity}`;

  // Pick up to 3 evenly-spaced labels to avoid axis crowding.
  const labelStride = Math.max(1, Math.floor(baseline.length / 3));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-label={ariaLabel ?? "distribution comparison"}
      role="img"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity={0.45} />
          <stop offset="100%" stopColor={tone} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Baseline outline — dashed, faint */}
      <path
        d={baselinePath}
        fill="none"
        stroke="var(--aegis-fg-tertiary)"
        strokeDasharray="3 3"
        strokeWidth={1}
        opacity={0.7}
      />

      {/* Current distribution — gradient fill + tonal stroke */}
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <path d={currentPath} fill="none" stroke={tone} strokeWidth={1.6} strokeLinejoin="round" />

      {/* Sparse x-axis labels */}
      {binLabels
        ? binLabels.map((label, i) =>
            i % labelStride === 0 || i === binLabels.length - 1 ? (
              <text
                key={`${label}-${i}`}
                x={padX + i * stepX}
                y={height - 1}
                className="fill-aegis-fg-3"
                style={{ fontSize: "9px", fontFamily: "var(--aegis-font-mono)" }}
                textAnchor="middle"
              >
                {label}
              </text>
            ) : null,
          )
        : null}
    </svg>
  );
}
