import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export type KPITileTone = "default" | "ok" | "warning" | "danger";

export interface KPITileProps {
  /** Small uppercased label above the value. */
  readonly label: string;
  /** Hero value — number or pre-formatted string (e.g. "128,402"). */
  readonly value: number | string;
  /** Optional unit suffix shown smaller after the value (e.g. "/ 3"). */
  readonly unit?: string;
  /** One-liner trend / status under the value (mono, tertiary color). */
  readonly trend?: string;
  /** Visual tone for the trend line + accent strip. */
  readonly tone?: KPITileTone;
  /** Extra elements (sparkline, mini-chart) docked at the bottom. */
  readonly children?: ReactNode;
  readonly className?: string;
}

const TREND_COLOR: Record<KPITileTone, string> = {
  default: "text-aegis-fg-3",
  ok: "text-status-ok",
  warning: "text-sev-medium",
  danger: "text-sev-high",
};

/**
 * KPI Tile — the single canonical headline-stat surface. The fleet
 * overview and every model card uses these. Spec §10.4 + the §8.1 mockup.
 *
 * - Label in uppercase mono (the tracking-mono / fg-tertiary discipline).
 * - Value as Inter Semibold with tight tracking.
 * - Trend in JetBrains Mono, tone-colored.
 */
export function KPITile({
  label,
  value,
  unit,
  trend,
  tone = "default",
  children,
  className,
}: KPITileProps): ReactNode {
  return (
    <article
      className={cn(
        "aegis-card flex flex-col gap-3 p-5",
        "transition-colors duration-aegis-base ease-aegis hover:border-aegis-stroke-strong",
        className,
      )}
      data-tone={tone}
    >
      <p className="aegis-mono-label">{label}</p>
      <p className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg leading-aegis-tight">
        {value}
        {unit ? (
          <span className="ml-1 text-aegis-base font-normal text-aegis-fg-3">{unit}</span>
        ) : null}
      </p>
      {trend ? <p className={cn("aegis-mono text-aegis-xs", TREND_COLOR[tone])}>{trend}</p> : null}
      {children}
    </article>
  );
}
