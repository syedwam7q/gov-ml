"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSWRConfig } from "swr";

import { ApprovalCard, ApprovalsIcon, EmptyState, KPITile, useRole } from "@aegis/ui";

import { transitionDecision } from "../../_lib/api";
import { relativeTime } from "../../_lib/format";
import type { AegisModel, GovernanceDecision } from "../../_lib/types";

interface ApprovalsViewProps {
  readonly decisions: readonly GovernanceDecision[];
  readonly models: readonly AegisModel[];
}

export function ApprovalsView({ decisions, models }: ApprovalsViewProps): ReactNode {
  const role = useRole();
  const modelById = new Map(models.map((m) => [m.id, m] as const));

  const operatorQueue = decisions.filter((d) => d.approval?.required_role === "operator");
  const adminQueue = decisions.filter((d) => d.approval?.required_role === "admin");

  const totalCritical = decisions.filter((d) => d.severity === "CRITICAL").length;
  const totalHigh = decisions.filter((d) => d.severity === "HIGH").length;

  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="aegis-mono-label">APPROVALS · PENDING QUEUE</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
          Approvals
        </h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
          Action plans that crossed the policy threshold and are waiting on human sign-off.
          Approvers leave a justification — recorded in the audit chain — before the executor
          carries the action out. Spec §10.1.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPITile
          label="Pending total"
          value={decisions.length}
          trend={
            decisions.length === 0
              ? "queue empty"
              : `${operatorQueue.length} operator · ${adminQueue.length} admin`
          }
          tone={decisions.length === 0 ? "ok" : "warning"}
        />
        <KPITile
          label="Critical waiting"
          value={totalCritical}
          trend="admin sign-off required"
          tone={totalCritical > 0 ? "danger" : "ok"}
        />
        <KPITile
          label="High waiting"
          value={totalHigh}
          trend="operator or admin"
          tone={totalHigh > 0 ? "warning" : "ok"}
        />
        <KPITile label="Your role" value={role} trend={`approver tier · ${role}`} />
      </section>

      {decisions.length === 0 ? (
        <EmptyState
          icon={<ApprovalsIcon width={20} height={20} />}
          title="QUEUE EMPTY · NO PENDING APPROVALS"
          description="Every action plan in the active window has been decided. New approvals appear here as soon as a policy raises one."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {adminQueue.length > 0 ? (
            <Section
              label="ADMIN-TIER"
              caption="Critical-severity actions. Admins only — operators see them as read-only context."
            >
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {adminQueue.map((d) => (
                  <li key={d.id}>
                    <ApprovalQueueItem
                      decision={d}
                      models={modelById}
                      canDecide={role === "admin"}
                    />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {operatorQueue.length > 0 ? (
            <Section
              label="OPERATOR-TIER"
              caption="Standard-severity actions. Operators and admins can decide; viewers see context only."
            >
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {operatorQueue.map((d) => (
                  <li key={d.id}>
                    <ApprovalQueueItem
                      decision={d}
                      models={modelById}
                      canDecide={role === "operator" || role === "admin"}
                    />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Section({
  label,
  caption,
  children,
}: {
  readonly label: string;
  readonly caption: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section className="space-y-3">
      <header className="flex flex-col gap-0.5">
        <p className="aegis-mono-label">{label}</p>
        <p className="text-aegis-xs text-aegis-fg-3 leading-aegis-snug max-w-xl">{caption}</p>
      </header>
      {children}
    </section>
  );
}

interface ApprovalQueueItemProps {
  readonly decision: GovernanceDecision;
  readonly models: ReadonlyMap<string, AegisModel>;
  readonly canDecide: boolean;
}

function ApprovalQueueItem({ decision, models, canDecide }: ApprovalQueueItemProps): ReactNode {
  const approval = decision.approval;
  const { mutate } = useSWRConfig();
  if (!approval || !decision.plan) return null;

  const recommended = decision.plan.find((a) => a.selected) ?? decision.plan[0];
  if (!recommended) return null;

  const alternatives = decision.plan.filter((a) => a.key !== recommended.key);
  const model = models.get(decision.model_id);
  const modelLabel = model ? `${model.name} · ${decision.model_id}` : decision.model_id;
  const topCause = decision.causal_attribution?.root_causes[0];
  const context = topCause
    ? `${decision.drift_signal.metric} = ${decision.drift_signal.value} (baseline ${decision.drift_signal.baseline}). Top cause · ${topCause.node} (${(topCause.contribution * 100).toFixed(0)}%).`
    : `${decision.drift_signal.metric} = ${decision.drift_signal.value} (baseline ${decision.drift_signal.baseline}).`;

  // Revalidate every list affected by an approval transition.
  const invalidate = (): void => {
    void mutate(
      (key) =>
        Array.isArray(key) &&
        (key[0] === "decisions" || key[0] === "audit" || key[0] === "activity"),
    );
  };

  const onApprove = async (justification: string, actionKey: string): Promise<void> => {
    await transitionDecision(decision.id, {
      target_state: "executing",
      payload: {
        approval: { decision: "approved", justification },
        chosen_action_key: actionKey,
      },
    });
    invalidate();
  };

  const onDeny = async (justification: string): Promise<void> => {
    await transitionDecision(decision.id, {
      target_state: "evaluated",
      payload: {
        approval: { decision: "denied", justification },
      },
    });
    invalidate();
  };

  return (
    <ApprovalCard
      decisionId={decision.id}
      decisionTitle={decision.title}
      modelLabel={modelLabel}
      severity={decision.severity}
      requiredRole={approval.required_role}
      requestedRelative={relativeTime(approval.requested_at)}
      context={context}
      recommendedAction={{
        key: recommended.key,
        label: recommended.label,
        kind: recommended.kind,
        selected: recommended.selected,
      }}
      alternativeActions={alternatives.map((a) => ({
        key: a.key,
        label: a.label,
        kind: a.kind,
        selected: a.selected,
      }))}
      canDecide={canDecide}
      onApprove={(j, k) => {
        void onApprove(j, k);
      }}
      onDeny={(j) => {
        void onDeny(j);
      }}
      renderOpenLink={({ className, children }) => (
        <Link href={`/incidents/${decision.id}`} className={className} prefetch={false}>
          {children}
        </Link>
      )}
    />
  );
}
