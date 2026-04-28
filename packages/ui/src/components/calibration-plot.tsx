import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface CalibrationBucket {
  /** Bucket midpoint — predicted probability (0..1). */
  readonly predicted: number;
  /** Observed positive rate inside the bucket (0..1). */
  readonly observed: number;
  /** Number of samples in the bucket. */
  readonly n: number;
}

export interface CalibrationPlotProps {
  readonly buckets: readonly CalibrationBucket[];
  /** Brier score (lower is better). */
  readonly brier?: number;
  /** Expected Calibration Error (lower is better). */
  readonly ece?: number;
  /** Width of the rendered SVG. Default 380. */
  readonly width?: number;
  /** Height of the rendered SVG. Default 320. */
  readonly height?: number;
  readonly className?: string;
}

/**
 * CalibrationPlot — a reliability diagram. Plots predicted-vs-observed
 * probability for binned predictions; the diagonal is perfect
 * calibration. Bar opacity encodes per-bucket sample count so sparse
 * buckets fade rather than mislead. Spec §10.4.
 */
export function CalibrationPlot({
  buckets,
  brier,
  ece,
  width = 380,
  height = 320,
  className,
}: CalibrationPlotProps): ReactNode {
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 32;
  const usableW = width - padL - padR;
  const usableH = height - padT - padB;

  const totalN = buckets.reduce((sum, b) => sum + b.n, 0) || 1;

  const x = (v: number): number => padL + v * usableW;
  const y = (v: number): number => padT + (1 - v) * usableH;

  const barWidth = Math.max(8, usableW / Math.max(buckets.length, 1) - 4);

  return (
    <figure
      aria-label="Calibration plot"
      className={cn("aegis-card flex flex-col gap-3 p-5", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="aegis-mono-label">CALIBRATION · RELIABILITY DIAGRAM</p>
        <div className="flex items-center gap-3 aegis-mono text-aegis-xs text-aegis-fg-3">
          {brier !== undefined ? <span>brier · {brier.toFixed(3)}</span> : null}
          {ece !== undefined ? <span>ece · {ece.toFixed(3)}</span> : null}
        </div>
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="reliability diagram"
        className="overflow-visible"
      >
        {/* Axes */}
        <line
          x1={padL}
          y1={y(0)}
          x2={x(1)}
          y2={y(0)}
          stroke="var(--aegis-stroke)"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={y(0)}
          x2={padL}
          y2={y(1)}
          stroke="var(--aegis-stroke)"
          strokeWidth={1}
        />

        {/* Diagonal — perfect calibration */}
        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(1)}
          y2={y(1)}
          stroke="var(--aegis-fg-tertiary)"
          strokeDasharray="4 4"
          strokeWidth={1}
          opacity={0.6}
        />

        {/* Per-bucket bar — height encodes |observed - predicted|, opacity encodes count share */}
        {buckets.map((b) => {
          const cx = x(b.predicted);
          const top = y(Math.max(b.observed, b.predicted));
          const bottom = y(Math.min(b.observed, b.predicted));
          const opacity = 0.25 + 0.75 * (b.n / totalN);
          return (
            <rect
              key={b.predicted}
              x={cx - barWidth / 2}
              y={top}
              width={barWidth}
              height={Math.max(0, bottom - top)}
              fill="var(--aegis-accent)"
              opacity={Math.min(1, opacity)}
              rx={2}
            />
          );
        })}

        {/* Observed-vs-predicted line */}
        <path
          d={buckets
            .map(
              (b, i) =>
                `${i === 0 ? "M" : "L"}${x(b.predicted).toFixed(2)},${y(b.observed).toFixed(2)}`,
            )
            .join(" ")}
          fill="none"
          stroke="var(--aegis-accent-strong)"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        {/* Bucket markers */}
        {buckets.map((b) => (
          <circle
            key={`marker-${b.predicted}`}
            cx={x(b.predicted)}
            cy={y(b.observed)}
            r={3}
            fill="var(--aegis-accent-strong)"
          />
        ))}

        {/* Axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={`x-${v}`}>
            <text
              x={x(v)}
              y={height - padB + 14}
              className="fill-aegis-fg-3"
              style={{ fontSize: "10px", fontFamily: "var(--aegis-font-mono)" }}
              textAnchor="middle"
            >
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text
            key={`y-${v}`}
            x={padL - 6}
            y={y(v) + 3}
            className="fill-aegis-fg-3"
            style={{ fontSize: "10px", fontFamily: "var(--aegis-font-mono)" }}
            textAnchor="end"
          >
            {v.toFixed(2)}
          </text>
        ))}

        <text
          x={(padL + x(1)) / 2}
          y={height - 4}
          className="fill-aegis-fg-2"
          style={{ fontSize: "10px", fontFamily: "var(--aegis-font-mono)" }}
          textAnchor="middle"
        >
          predicted probability
        </text>
        <text
          x={10}
          y={(y(0) + y(1)) / 2}
          className="fill-aegis-fg-2"
          style={{ fontSize: "10px", fontFamily: "var(--aegis-font-mono)" }}
          textAnchor="middle"
          transform={`rotate(-90, 10, ${(y(0) + y(1)) / 2})`}
        >
          observed
        </text>
      </svg>
    </figure>
  );
}
