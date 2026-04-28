import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import type { DecisionState } from "./state-pill";

export interface TimelineEvent {
  /** State this event represents. */
  readonly state: DecisionState;
  /** ISO timestamp. */
  readonly ts: string;
  /** Human-friendly label, e.g. "Decision opened". */
  readonly label: string;
  /** Pre-formatted relative time (host computes — keeps the component pure). */
  readonly relativeTime: string;
  /** Actor who triggered the transition. */
  readonly actor: string;
}

export interface TimelineScrubberProps {
  /** Ordered events. The last event is treated as "current". */
  readonly events: readonly TimelineEvent[];
  /** Total duration label, e.g. "120 min open". */
  readonly totalDuration?: string;
  readonly className?: string;
}

const STATE_LABEL: Record<DecisionState, string> = {
  detected: "DETECTED",
  analyzed: "ANALYZED",
  planned: "PLANNED",
  awaiting_approval: "APPROVAL",
  executing: "EXECUTING",
  evaluated: "EVALUATED",
};

const FULL_LIFECYCLE: readonly DecisionState[] = [
  "detected",
  "analyzed",
  "planned",
  "awaiting_approval",
  "executing",
  "evaluated",
];

/**
 * TimelineScrubber — horizontal MAPE-K lifecycle visualization. Renders
 * the canonical six-state path with checked nodes for completed states,
 * an accent ring on the current state, and gray placeholders for
 * future states. Spec §10.4.
 *
 * Designed for the /incidents/[id] page, where the user scrubs through
 * the audit-chain timeline of a single decision.
 */
export function TimelineScrubber({
  events,
  totalDuration,
  className,
}: TimelineScrubberProps): ReactNode {
  const seenStates = new Set(events.map((e) => e.state));
  const currentState = events[events.length - 1]?.state;
  const eventsByState = new Map(events.map((e) => [e.state, e] as const));

  return (
    <figure
      aria-label="Decision lifecycle timeline"
      className={cn("aegis-card flex flex-col gap-5 p-6", className)}
    >
      <header className="flex items-baseline justify-between gap-3">
        <p className="aegis-mono-label">DECISION LIFECYCLE · MAPE-K</p>
        {totalDuration ? (
          <p className="aegis-mono text-aegis-xs text-aegis-fg-3">{totalDuration}</p>
        ) : null}
      </header>

      <ol className="grid grid-cols-6 gap-2">
        {FULL_LIFECYCLE.map((state, idx) => {
          const seen = seenStates.has(state);
          const current = currentState === state;
          const event = eventsByState.get(state);
          const nextState = FULL_LIFECYCLE[idx + 1];
          const nextActive =
            nextState !== undefined && (seenStates.has(nextState) || currentState === nextState);
          return (
            <li key={state} className="flex flex-col items-center gap-2 text-center">
              <div className="flex w-full items-center">
                {idx > 0 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "h-px flex-1",
                      seen || current ? "bg-aegis-stroke-strong" : "bg-aegis-stroke",
                    )}
                  />
                ) : (
                  <span aria-hidden className="flex-1" />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    current
                      ? "border-aegis-accent bg-aegis-accent-soft text-aegis-accent"
                      : seen
                        ? "border-status-ok/60 bg-status-ok-soft text-status-ok"
                        : "border-aegis-stroke bg-aegis-surface-1 text-aegis-fg-disabled",
                  )}
                >
                  {seen && !current ? (
                    <CheckIcon />
                  ) : (
                    <span className="aegis-mono text-[10px]">{idx + 1}</span>
                  )}
                </span>
                {nextState !== undefined ? (
                  <span
                    aria-hidden
                    className={cn(
                      "h-px flex-1",
                      nextActive ? "bg-aegis-stroke-strong" : "bg-aegis-stroke",
                    )}
                  />
                ) : (
                  <span aria-hidden className="flex-1" />
                )}
              </div>
              <p
                className={cn(
                  "aegis-mono text-aegis-xs leading-tight",
                  current ? "text-aegis-accent" : seen ? "text-aegis-fg" : "text-aegis-fg-disabled",
                )}
              >
                {STATE_LABEL[state]}
              </p>
              {event ? (
                <p className="aegis-mono text-[10px] text-aegis-fg-3 leading-tight">
                  {event.relativeTime}
                </p>
              ) : (
                <p className="aegis-mono text-[10px] text-aegis-fg-disabled leading-tight">—</p>
              )}
            </li>
          );
        })}
      </ol>

      {events.length > 0 ? (
        <ol className="border-t border-aegis-stroke pt-4 space-y-2">
          {events.map((event) => (
            <li
              key={`${event.state}-${event.ts}`}
              className="flex items-center gap-3 text-aegis-sm"
            >
              <span className="aegis-mono text-aegis-xs text-aegis-fg-3 tabular-nums w-20">
                {event.relativeTime}
              </span>
              <span className="text-aegis-fg flex-1 truncate">{event.label}</span>
              <span className="aegis-mono text-aegis-xs text-aegis-fg-3 truncate">
                {event.actor}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </figure>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg
      width="12"
      height="12"
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
