import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/** The 6 GovernanceDecision states from spec §5.1 + 6.1. */
export type DecisionState =
  | "detected"
  | "analyzed"
  | "planned"
  | "awaiting_approval"
  | "executing"
  | "evaluated";

const SURFACE: Record<DecisionState, string> = {
  detected: "bg-sev-high-soft text-sev-high border-sev-high/30",
  analyzed: "bg-aegis-accent-soft text-aegis-accent border-aegis-accent/30",
  planned: "bg-aegis-surface-2 text-aegis-fg border-aegis-stroke-strong",
  awaiting_approval: "bg-sev-medium-soft text-sev-medium border-sev-medium/30",
  executing: "bg-sev-medium-soft text-sev-medium border-sev-medium/30",
  evaluated: "bg-status-ok-soft text-status-ok border-status-ok/30",
};

const LABEL: Record<DecisionState, string> = {
  detected: "DETECTED",
  analyzed: "ANALYZED",
  planned: "PLANNED",
  awaiting_approval: "AWAITING APPROVAL",
  executing: "EXECUTING",
  evaluated: "EVALUATED",
};

export interface StatePillProps {
  /** One of the 6 lifecycle states. */
  readonly state: DecisionState;
  readonly className?: string;
}

/**
 * State Pill — the lifecycle marker that appears in every decision row,
 * audit log, and timeline. Spec §10.4. Mono font, uppercase, tracking-mono.
 */
export function StatePill({ state, className }: StatePillProps): ReactNode {
  return (
    <span
      role="status"
      aria-label={`state ${state.replace(/_/g, " ")}`}
      data-state={state}
      className={cn(
        "inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none",
        SURFACE[state],
        className,
      )}
    >
      {LABEL[state]}
    </span>
  );
}
