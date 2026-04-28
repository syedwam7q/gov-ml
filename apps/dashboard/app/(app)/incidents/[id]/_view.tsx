import Link from "next/link";
import type { ReactNode } from "react";

import {
  CausalDAG,
  type CausalDAGEdge,
  type CausalDAGNode,
  HashBadge,
  ParetoChart,
  type ParetoCandidate,
  SeverityPill,
  ShapleyWaterfall,
  type ShapleyContribution,
  StatePill,
  TimelineScrubber,
  type TimelineEvent,
} from "@aegis/ui";

import { clock, metricValue, relativeTime } from "../../../_lib/format";
import type { AegisModel, AuditRow, GovernanceDecision } from "../../../_lib/types";

interface DecisionDetailViewProps {
  readonly decision: GovernanceDecision;
  readonly model: AegisModel;
  readonly audit: readonly AuditRow[];
}

export function DecisionDetailView({ decision, model, audit }: DecisionDetailViewProps): ReactNode {
  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-8">
      <Header decision={decision} model={model} />
      <Timeline decision={decision} audit={audit} />
      <ContextStrip decision={decision} />
      {decision.causal_attribution ? (
        <Causal decision={decision} />
      ) : (
        <NotePanel
          label="CAUSAL ATTRIBUTION"
          message="No attribution payload — decision did not cross the ANALYZED state with a populated causal record."
        />
      )}
      {decision.plan ? (
        <Plan decision={decision} />
      ) : (
        <NotePanel
          label="ACTION PLAN"
          message="No plan recorded — the policy did not propose actions for this severity tier."
        />
      )}
      {decision.action_result ? <ActionResult decision={decision} /> : null}
      <AuditChain audit={audit} />
    </section>
  );
}

function Header({
  decision,
  model,
}: {
  readonly decision: GovernanceDecision;
  readonly model: AegisModel;
}): ReactNode {
  return (
    <header className="flex flex-col gap-3 border-b border-aegis-stroke pb-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="aegis-mono-label">DECISION · {decision.id.toUpperCase()}</p>
        <Link
          href={`/models/${model.id}`}
          prefetch={false}
          className="aegis-mono text-aegis-xs text-aegis-fg-3 hover:text-aegis-fg-2"
        >
          ← {model.name}
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
            {decision.title}
          </h1>
          <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
            {decision.drift_signal.metric}
            {decision.drift_signal.subgroup ? (
              <>
                {" "}
                · subgroup{" "}
                {Object.entries(decision.drift_signal.subgroup)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
              </>
            ) : null}{" "}
            · severity {decision.severity} · opened {relativeTime(decision.opened_at)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatePill state={decision.state} />
          <SeverityPill severity={decision.severity} />
        </div>
      </div>
    </header>
  );
}

function Timeline({
  decision,
  audit,
}: {
  readonly decision: GovernanceDecision;
  readonly audit: readonly AuditRow[];
}): ReactNode {
  const STATE_FOR_ACTION: Record<string, TimelineEvent["state"]> = {
    "decision.opened": "detected",
    "decision.analyzed": "analyzed",
    "decision.planned": "planned",
    "approval.requested": "awaiting_approval",
    "approval.decided": "executing",
    "action.executed": "executing",
    "decision.evaluated": "evaluated",
  };

  const events: TimelineEvent[] = audit
    .filter((row) => STATE_FOR_ACTION[row.action] !== undefined)
    .map((row) => {
      const state = STATE_FOR_ACTION[row.action] ?? decision.state;
      const labelMap: Record<string, string> = {
        "decision.opened": "Decision opened",
        "decision.analyzed": "Causal attribution complete",
        "decision.planned": "Action plan ready",
        "approval.requested": "Approval requested",
        "approval.decided": "Approval decided",
        "action.executed": "Action executed",
        "decision.evaluated": "Post-action evaluation complete",
      };
      return {
        state,
        ts: row.ts,
        label: labelMap[row.action] ?? row.action,
        relativeTime: relativeTime(row.ts),
        actor: row.actor,
      };
    });

  const totalDuration = decision.evaluated_at
    ? `open ${minutesBetween(decision.opened_at, decision.evaluated_at)} min`
    : `open ${minutesBetween(decision.opened_at, new Date().toISOString())} min`;

  return <TimelineScrubber events={events} totalDuration={totalDuration} />;
}

function ContextStrip({ decision }: { readonly decision: GovernanceDecision }): ReactNode {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Stat
        label="Driving metric"
        value={decision.drift_signal.metric}
        hint={`observed ${metricValue(decision.drift_signal.value)} · baseline ${metricValue(decision.drift_signal.baseline)}`}
        highlight
      />
      <Stat
        label="Severity"
        value={decision.severity}
        hint={
          decision.drift_signal.severity === "CRITICAL"
            ? "spec §10.3 critical pulse · admin approval required"
            : "operator approval gates execution"
        }
      />
      <Stat
        label="Window observed"
        value={decision.evaluated_at ? "closed" : "open"}
        hint={
          decision.evaluated_at
            ? `${minutesBetween(decision.opened_at, decision.evaluated_at)} min total`
            : `since ${relativeTime(decision.opened_at)}`
        }
      />
    </section>
  );
}

function Causal({ decision }: { readonly decision: GovernanceDecision }): ReactNode {
  const attribution = decision.causal_attribution;
  if (!attribution) return null;

  const causes: CausalDAGNode[] = attribution.root_causes.map((rc, idx) => ({
    id: `c-${idx}`,
    label: rc.node,
    layer: 0,
    contribution: rc.contribution,
    primary: idx === 0,
    hint: rc.explanation,
  }));
  const target: CausalDAGNode = {
    id: "target",
    label: attribution.target_metric,
    layer: 1,
    primary: true,
    hint: `${metricValue(attribution.observed_value)} observed · ${metricValue(attribution.counterfactual_value)} counterfactual`,
  };
  const edges: CausalDAGEdge[] = causes.map((c, idx) => ({
    from: c.id,
    to: "target",
    strength: attribution.root_causes[idx]?.contribution ?? 0.3,
  }));

  const shapley: readonly ShapleyContribution[] = attribution.root_causes.map((rc) => ({
    feature: rc.node,
    // attribute share of total drop
    value: (attribution.observed_value - attribution.counterfactual_value) * rc.contribution,
    hint: rc.explanation,
  }));

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <CausalDAG nodes={[...causes, target]} edges={edges} />
      <ShapleyWaterfall
        baseline={attribution.counterfactual_value}
        observed={attribution.observed_value}
        contributions={shapley}
        metric={attribution.target_metric}
      />
    </section>
  );
}

function Plan({ decision }: { readonly decision: GovernanceDecision }): ReactNode {
  if (!decision.plan) return null;
  const candidates: readonly ParetoCandidate[] = decision.plan.map((a) => ({
    id: a.key,
    label: a.label,
    kind: a.kind,
    utility: a.reward.utility,
    safety: a.reward.safety,
    cost: a.reward.cost,
    pareto: a.pareto,
    selected: a.selected,
    explanation: a.explanation,
  }));

  return (
    <ParetoChart
      candidates={candidates}
      caption="Frontier solved with three-objective Pareto-optimal action selector (spec §12.2). Dominated actions retained for audit completeness."
    />
  );
}

function ActionResult({ decision }: { readonly decision: GovernanceDecision }): ReactNode {
  const result = decision.action_result;
  if (!result) return null;

  return (
    <section className="aegis-card p-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Stat
        label="Action executed"
        value={result.executed_action}
        hint={`at ${clock(result.executed_at)}`}
        highlight={result.succeeded}
      />
      <Stat
        label="Outcome"
        value={result.succeeded ? "succeeded" : "failed"}
        hint={result.notes ?? "—"}
      />
      <Stat
        label="Post-action metric"
        value={metricValue(result.post_action_metric)}
        hint={
          decision.approval
            ? `${decision.approval.decision} by ${decision.approval.decided_by ?? "—"}`
            : "auto-approved"
        }
      />
    </section>
  );
}

function AuditChain({ audit }: { readonly audit: readonly AuditRow[] }): ReactNode {
  if (audit.length === 0) return null;
  return (
    <section className="aegis-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 border-b border-aegis-stroke px-6 py-4">
        <p className="aegis-mono-label">AUDIT CHAIN · DECISION-SCOPED ({audit.length} ROWS)</p>
        <Link
          href="/audit"
          prefetch={false}
          className="aegis-mono text-aegis-xs text-aegis-accent hover:text-aegis-accent-strong"
        >
          full chain →
        </Link>
      </header>
      <ol className="divide-y divide-aegis-stroke">
        {audit.map((row) => (
          <li key={row.row_hash} className="px-6 py-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="aegis-mono text-aegis-xs text-aegis-fg-3 tabular-nums">
                #{row.sequence_n}
              </span>
              <span className="aegis-mono text-aegis-xs text-aegis-fg-3">{clock(row.ts)}</span>
              <span className="text-aegis-sm font-medium text-aegis-fg">{row.action}</span>
              <span className="text-aegis-fg-3">·</span>
              <span className="aegis-mono text-aegis-xs text-aegis-fg-2">{row.actor}</span>
              <span className="ml-auto aegis-mono text-aegis-xs text-aegis-fg-3">
                {relativeTime(row.ts)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 aegis-mono text-aegis-xs text-aegis-fg-3">
              <span>row_hash</span>
              <HashBadge value={row.row_hash} />
              <span>prev_hash</span>
              <HashBadge value={row.prev_hash} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NotePanel({
  label,
  message,
}: {
  readonly label: string;
  readonly message: string;
}): ReactNode {
  return (
    <section className="aegis-card flex items-center gap-3 px-6 py-4">
      <p className="aegis-mono-label">{label}</p>
      <p className="text-aegis-sm text-aegis-fg-3">{message}</p>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly highlight?: boolean;
}): ReactNode {
  return (
    <article className="aegis-card p-5 space-y-1">
      <p className="aegis-mono-label">{label.toUpperCase()}</p>
      <p
        className={`text-aegis-md font-semibold tabular-nums ${highlight ? "text-aegis-accent" : "text-aegis-fg"}`}
      >
        {value}
      </p>
      {hint ? <p className="aegis-mono text-aegis-xs text-aegis-fg-3">{hint}</p> : null}
    </article>
  );
}

function minutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / 60_000));
}
