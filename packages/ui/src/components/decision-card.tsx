import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { ChevronRightIcon } from "./icons";
import { type Severity, SeverityPill } from "./severity-pill";
import { StatePill, type DecisionState } from "./state-pill";

export interface DecisionCardProps {
  readonly id: string;
  readonly title: string;
  readonly modelLabel: string;
  readonly state: DecisionState;
  readonly severity: Severity;
  /** "47m ago" or similar — host computes. */
  readonly openedRelative: string;
  /** Driving metric label, e.g. "DP_gender". */
  readonly metricKey: string;
  /** Observed value of the driving metric. */
  readonly observedValue: string;
  /** Baseline / threshold value of the driving metric. */
  readonly baselineValue: string;
  /** Optional supporting line — e.g. "rollback executed · DP_gender 0.92". */
  readonly subhead?: string | undefined;
  /** Renders the trailing call-to-action — typically a Next Link. */
  readonly renderAction: (props: {
    readonly className: string;
    readonly children: ReactNode;
  }) => ReactNode;
  readonly className?: string;
}

/**
 * DecisionCard — a single governance decision rendered as a list-row
 * card. Used on /incidents and any "recent decisions" panel that links
 * out to /incidents/[id]. Spec §10.4.
 */
export function DecisionCard({
  id,
  title,
  modelLabel,
  state,
  severity,
  openedRelative,
  metricKey,
  observedValue,
  baselineValue,
  subhead,
  renderAction,
  className,
}: DecisionCardProps): ReactNode {
  return (
    <article
      data-decision-id={id}
      data-state={state}
      className={cn(
        "aegis-card flex flex-col gap-3 p-5 transition-colors duration-aegis-base ease-aegis hover:border-aegis-stroke-strong",
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline gap-3">
        <span className="aegis-mono-label">DECISION · {id.toUpperCase()}</span>
        <span className="aegis-mono text-aegis-xs text-aegis-fg-3">{modelLabel}</span>
        <span className="ml-auto aegis-mono text-aegis-xs text-aegis-fg-3">
          opened {openedRelative}
        </span>
      </header>

      <p className="text-aegis-base font-semibold text-aegis-fg leading-aegis-snug">{title}</p>

      <div className="flex flex-wrap items-center gap-3">
        <SeverityPill severity={severity} />
        <StatePill state={state} />
        <span className="aegis-mono text-aegis-xs text-aegis-fg-3">·</span>
        <span className="aegis-mono text-aegis-xs text-aegis-fg-2 tabular-nums">
          {metricKey}={observedValue} (baseline {baselineValue})
        </span>
      </div>

      {subhead ? (
        <p className="aegis-mono text-aegis-xs text-aegis-fg-3 leading-aegis-snug">{subhead}</p>
      ) : null}

      <footer className="flex items-center justify-end border-t border-aegis-stroke pt-3">
        {renderAction({
          className:
            "group inline-flex items-center gap-1 text-aegis-sm text-aegis-accent transition-colors duration-aegis-fast hover:text-aegis-accent-strong",
          children: (
            <>
              <span>open decision</span>
              <ChevronRightIcon
                width={14}
                height={14}
                className="transition-transform duration-aegis-fast group-hover:translate-x-0.5"
              />
            </>
          ),
        })}
      </footer>
    </article>
  );
}
