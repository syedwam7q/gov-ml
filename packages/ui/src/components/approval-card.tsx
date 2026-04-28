"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "../lib/cn";
import { type Severity, SeverityPill } from "./severity-pill";

export type ApprovalRole = "operator" | "admin";

export interface ApprovalAction {
  /** Stable id used as React key. */
  readonly key: string;
  /** Human label, e.g. "Roll back to 1.4.0". */
  readonly label: string;
  /** Action kind — drives the small mono prefix tag. */
  readonly kind: string;
  /** Whether this is the recommended action (selected on the Pareto frontier). */
  readonly selected: boolean;
}

export interface ApprovalCardProps {
  readonly decisionId: string;
  readonly decisionTitle: string;
  readonly modelLabel: string;
  readonly severity: Severity;
  readonly requiredRole: ApprovalRole;
  /** "20m ago" — host computes. */
  readonly requestedRelative: string;
  /** Two-line context — typically the metric breach or root-cause summary. */
  readonly context: string;
  /** Recommended action. Operator / admin sees this as the headline choice. */
  readonly recommendedAction: ApprovalAction;
  /** Other available actions (alternative Pareto-frontier choices). */
  readonly alternativeActions?: readonly ApprovalAction[];
  /** Whether the current viewer can approve at this role tier. */
  readonly canDecide: boolean;
  /** Justification entered by the operator before approval (controlled). */
  readonly onApprove?: (justification: string, actionKey: string) => void;
  readonly onDeny?: (justification: string) => void;
  /** Render the trailing decision-link (Next Link). */
  readonly renderOpenLink: (props: {
    readonly className: string;
    readonly children: ReactNode;
  }) => ReactNode;
  readonly className?: string;
}

const ROLE_TONE: Record<ApprovalRole, string> = {
  operator: "border-aegis-accent/30 bg-aegis-accent-soft text-aegis-accent",
  admin: "border-sev-critical/40 bg-sev-critical-soft text-sev-critical",
};

/**
 * ApprovalCard — the canonical pending-approval surface used on
 * /approvals. Encapsulates the decision summary + recommended action +
 * inline approve/deny controls. Spec §10.1 / §10.4.
 */
export function ApprovalCard({
  decisionId,
  decisionTitle,
  modelLabel,
  severity,
  requiredRole,
  requestedRelative,
  context,
  recommendedAction,
  alternativeActions = [],
  canDecide,
  onApprove,
  onDeny,
  renderOpenLink,
  className,
}: ApprovalCardProps): ReactNode {
  const [justification, setJustification] = useState("");
  const [chosenAction, setChosenAction] = useState(recommendedAction.key);
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [decided, setDecided] = useState<"approved" | "denied" | null>(null);

  const allActions = [recommendedAction, ...alternativeActions];

  const handleApprove = (): void => {
    if (!onApprove || submitting) return;
    setSubmitting("approve");
    Promise.resolve(onApprove(justification, chosenAction))
      .then(() => setDecided("approved"))
      .catch(() => setSubmitting(null))
      .finally(() => setSubmitting(null));
  };

  const handleDeny = (): void => {
    if (!onDeny || submitting) return;
    setSubmitting("deny");
    Promise.resolve(onDeny(justification))
      .then(() => setDecided("denied"))
      .catch(() => setSubmitting(null))
      .finally(() => setSubmitting(null));
  };

  return (
    <article
      data-decision-id={decisionId}
      data-required-role={requiredRole}
      className={cn(
        "aegis-card flex flex-col gap-4 p-6",
        decided === "approved" && "border-status-ok/40",
        decided === "denied" && "border-sev-high/40",
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline gap-3">
        <span className="aegis-mono-label">DECISION · {decisionId.toUpperCase()}</span>
        <span className="aegis-mono text-aegis-xs text-aegis-fg-3">{modelLabel}</span>
        <span className="ml-auto aegis-mono text-aegis-xs text-aegis-fg-3">
          requested {requestedRelative}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <SeverityPill severity={severity} />
        <span
          className={cn(
            "inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none",
            ROLE_TONE[requiredRole],
          )}
        >
          {requiredRole} approval
        </span>
        {decided ? (
          <span
            className={cn(
              "inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none",
              decided === "approved"
                ? "border-status-ok/40 bg-status-ok-soft text-status-ok"
                : "border-sev-high/40 bg-sev-high-soft text-sev-high",
            )}
          >
            {decided}
          </span>
        ) : null}
      </div>

      <p className="text-aegis-base font-semibold text-aegis-fg leading-aegis-snug">
        {decisionTitle}
      </p>
      <p className="text-aegis-sm text-aegis-fg-2 leading-aegis-snug">{context}</p>

      <fieldset className="space-y-2 border-t border-aegis-stroke pt-4">
        <legend className="aegis-mono-label mb-1">PROPOSED ACTION</legend>
        <div className="space-y-1.5">
          {allActions.map((action) => {
            const checked = chosenAction === action.key;
            const isRecommended = action.key === recommendedAction.key;
            return (
              <label
                key={action.key}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-aegis-control border px-3 py-2.5 transition-colors duration-aegis-fast",
                  checked
                    ? "border-aegis-accent bg-aegis-accent-soft"
                    : "border-aegis-stroke hover:border-aegis-stroke-strong",
                  decided && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="radio"
                  name={`action-${decisionId}`}
                  value={action.key}
                  checked={checked}
                  onChange={() => setChosenAction(action.key)}
                  disabled={!canDecide || decided !== null}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                    checked ? "border-aegis-accent" : "border-aegis-stroke-strong",
                  )}
                >
                  {checked ? <span className="h-2 w-2 rounded-full bg-aegis-accent" /> : null}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-aegis-sm font-medium text-aegis-fg">{action.label}</span>
                    <span className="aegis-mono text-aegis-xs text-aegis-fg-3">{action.kind}</span>
                    {isRecommended ? (
                      <span className="aegis-mono text-aegis-xs text-aegis-accent">
                        RECOMMENDED
                      </span>
                    ) : null}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {!decided ? (
        <div className="space-y-3 border-t border-aegis-stroke pt-4">
          <label className="block space-y-1.5">
            <span className="aegis-mono-label">JUSTIFICATION</span>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={
                canDecide
                  ? "Required for audit log — at least 20 characters."
                  : `Reserved for ${requiredRole} approvers.`
              }
              disabled={!canDecide}
              rows={3}
              className={cn(
                "block w-full resize-none rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-3 py-2 text-aegis-sm text-aegis-fg placeholder:text-aegis-fg-3",
                "focus:border-aegis-accent focus:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleApprove}
              disabled={!canDecide || justification.trim().length < 20 || submitting !== null}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-aegis-control border border-status-ok/40 bg-status-ok-soft px-4 text-aegis-sm font-medium text-status-ok",
                "transition-colors duration-aegis-fast hover:border-status-ok",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {submitting === "approve" ? "approving…" : "approve"}
            </button>
            <button
              type="button"
              onClick={handleDeny}
              disabled={!canDecide || justification.trim().length < 20 || submitting !== null}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-4 text-aegis-sm font-medium text-aegis-fg-2",
                "transition-colors duration-aegis-fast hover:border-sev-high/40 hover:text-sev-high",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {submitting === "deny" ? "denying…" : "deny"}
            </button>
            {renderOpenLink({
              className:
                "ml-auto aegis-mono text-aegis-xs text-aegis-accent hover:text-aegis-accent-strong",
              children: "open decision →",
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 border-t border-aegis-stroke pt-4">
          <p className="text-aegis-sm text-aegis-fg-2">
            Recorded in audit chain. Action {chosenAction} {decided}.
          </p>
          {renderOpenLink({
            className:
              "ml-auto aegis-mono text-aegis-xs text-aegis-accent hover:text-aegis-accent-strong",
            children: "open decision →",
          })}
        </div>
      )}
    </article>
  );
}
