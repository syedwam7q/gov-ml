import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import {
  ApprovalsIcon,
  AuditIcon,
  IncidentsIcon,
  ModelsIcon,
  PoliciesIcon,
  SparkleIcon,
} from "./icons";
import { type Severity } from "./severity-pill";

export type ActivityFeedKind =
  | "signal_detected"
  | "decision_opened"
  | "decision_advanced"
  | "approval_requested"
  | "approval_decided"
  | "action_executed"
  | "decision_evaluated"
  | "policy_changed"
  | "deployment";

export interface ActivityFeedEvent {
  readonly id: string;
  readonly ts: string;
  readonly kind: ActivityFeedKind;
  readonly severity?: Severity | undefined;
  /** Pre-formatted "47m ago" string — host computes this so the feed stays pure. */
  readonly relativeTime: string;
  readonly summary: string;
  readonly actor: string;
}

export interface ActivityFeedProps {
  readonly events: readonly ActivityFeedEvent[];
  /** Renders empty-state copy when no events match the current filter. */
  readonly emptyMessage?: string;
  /** Compact variant — used in side rails. */
  readonly compact?: boolean;
  readonly className?: string;
}

const KIND_ICON: Record<ActivityFeedKind, () => ReactNode> = {
  signal_detected: () => <IncidentsIcon width={14} height={14} />,
  decision_opened: () => <IncidentsIcon width={14} height={14} />,
  decision_advanced: () => <SparkleIcon width={14} height={14} />,
  approval_requested: () => <ApprovalsIcon width={14} height={14} />,
  approval_decided: () => <ApprovalsIcon width={14} height={14} />,
  action_executed: () => <ModelsIcon width={14} height={14} />,
  decision_evaluated: () => <AuditIcon width={14} height={14} />,
  policy_changed: () => <PoliciesIcon width={14} height={14} />,
  deployment: () => <ModelsIcon width={14} height={14} />,
};

const KIND_TONE: Record<ActivityFeedKind, string> = {
  signal_detected: "text-sev-high",
  decision_opened: "text-sev-high",
  decision_advanced: "text-aegis-accent",
  approval_requested: "text-sev-medium",
  approval_decided: "text-aegis-accent",
  action_executed: "text-aegis-fg-2",
  decision_evaluated: "text-status-ok",
  policy_changed: "text-aegis-fg-2",
  deployment: "text-aegis-fg-2",
};

/**
 * ActivityFeed — the always-visible "what just happened" rail. Consumes
 * pre-formatted events (the host computes `relativeTime` so the feed
 * stays presentational). Spec §10.4 — every page in the dashboard
 * surfaces a slice of this same source.
 */
export function ActivityFeed({
  events,
  emptyMessage = "Nothing in the window.",
  compact = false,
  className,
}: ActivityFeedProps): ReactNode {
  return (
    <ol
      role="feed"
      aria-label="Recent activity"
      className={cn("aegis-card flex flex-col divide-y divide-aegis-stroke", className)}
    >
      {events.length === 0 ? (
        <li className="px-4 py-6 text-center text-aegis-sm text-aegis-fg-3">{emptyMessage}</li>
      ) : (
        events.map((event) => {
          const Icon = KIND_ICON[event.kind];
          return (
            <li
              key={event.id}
              className={cn("flex items-start gap-3", compact ? "px-4 py-2.5" : "px-5 py-3.5")}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2",
                  KIND_TONE[event.kind],
                )}
              >
                {Icon()}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-aegis-sm text-aegis-fg leading-aegis-snug truncate">
                  {event.summary}
                </p>
                <p className="aegis-mono text-aegis-xs text-aegis-fg-3 truncate">
                  {event.actor} · {event.relativeTime}
                </p>
              </div>
            </li>
          );
        })
      )}
    </ol>
  );
}
