import Link from "next/link";
import type { ReactNode } from "react";

import { DecisionCard, EmptyState, IncidentsIcon } from "@aegis/ui";

import { metricValue, relativeTime } from "../../_lib/format";
import type { AegisModel, GovernanceDecision } from "../../_lib/types";

interface IncidentsViewProps {
  readonly decisions: readonly GovernanceDecision[];
  readonly models: readonly AegisModel[];
  readonly filters: {
    readonly model?: string;
    readonly state?: string;
    readonly severity?: string;
  };
}

const STATES = [
  "detected",
  "analyzed",
  "planned",
  "awaiting_approval",
  "executing",
  "evaluated",
] as const;

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export function IncidentsView({ decisions, models, filters }: IncidentsViewProps): ReactNode {
  const modelById = new Map(models.map((m) => [m.id, m] as const));

  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="aegis-mono-label">INCIDENTS · GOVERNANCE DECISIONS</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
          Incidents
        </h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
          Every governance decision in the active window. Filter by model, lifecycle state, or
          severity. Click through to see the full MAPE-K timeline, causal attribution, action plan,
          and audit chain.
        </p>
      </header>

      <FilterBar filters={filters} models={models} totalShown={decisions.length} />

      {decisions.length === 0 ? (
        <EmptyState
          icon={<IncidentsIcon width={20} height={20} />}
          title="NO INCIDENTS · CURRENT FILTERS"
          description="No governance decisions match the current filter combination. Clear filters or open the Audit page for the full chain."
          action={
            <Link
              href="/incidents"
              prefetch={false}
              className="aegis-mono text-aegis-xs text-aegis-accent hover:text-aegis-accent-strong"
            >
              clear filters →
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {decisions.map((d) => {
            const model = modelById.get(d.model_id);
            return (
              <li key={d.id}>
                <DecisionCard
                  id={d.id}
                  title={d.title}
                  modelLabel={model ? `${model.name} · ${d.model_id}` : d.model_id}
                  state={d.state}
                  severity={d.severity}
                  openedRelative={relativeTime(d.opened_at)}
                  metricKey={d.drift_signal.metric}
                  observedValue={metricValue(d.drift_signal.value)}
                  baselineValue={metricValue(d.drift_signal.baseline)}
                  subhead={subheadFor(d)}
                  renderAction={({ className, children }) => (
                    <Link href={`/incidents/${d.id}`} className={className} prefetch={false}>
                      {children}
                    </Link>
                  )}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface FilterBarProps {
  readonly filters: IncidentsViewProps["filters"];
  readonly models: readonly AegisModel[];
  readonly totalShown: number;
}

function FilterBar({ filters, models, totalShown }: FilterBarProps): ReactNode {
  const buildHref = (key: string, value?: string): string => {
    const params = new URLSearchParams();
    if (filters.model && key !== "model") params.set("model", filters.model);
    if (filters.state && key !== "state") params.set("state", filters.state);
    if (filters.severity && key !== "severity") params.set("severity", filters.severity);
    if (value !== undefined) params.set(key, value);
    const qs = params.toString();
    return qs ? `/incidents?${qs}` : "/incidents";
  };

  return (
    <nav
      aria-label="Incident filters"
      className="aegis-card flex flex-wrap items-center gap-3 px-5 py-3"
    >
      <FilterGroup
        label="MODEL"
        active={filters.model}
        all={[
          { value: undefined, label: "all" },
          ...models.map((m) => ({ value: m.id, label: m.id })),
        ]}
        buildHref={(value) => buildHref("model", value)}
      />
      <span aria-hidden className="h-4 w-px bg-aegis-stroke" />
      <FilterGroup
        label="STATE"
        active={filters.state}
        all={[
          { value: undefined, label: "any" },
          ...STATES.map((s) => ({ value: s, label: s.replace("_", " ") })),
        ]}
        buildHref={(value) => buildHref("state", value)}
      />
      <span aria-hidden className="h-4 w-px bg-aegis-stroke" />
      <FilterGroup
        label="SEVERITY"
        active={filters.severity}
        all={[
          { value: undefined, label: "any" },
          ...SEVERITIES.map((s) => ({ value: s, label: s.toLowerCase() })),
        ]}
        buildHref={(value) => buildHref("severity", value)}
      />
      <span className="ml-auto aegis-mono text-aegis-xs text-aegis-fg-3">
        showing {totalShown} decision{totalShown === 1 ? "" : "s"}
      </span>
    </nav>
  );
}

interface FilterGroupProps {
  readonly label: string;
  readonly active: string | undefined;
  readonly all: readonly { readonly value: string | undefined; readonly label: string }[];
  readonly buildHref: (value: string | undefined) => string;
}

function FilterGroup({ label, active, all, buildHref }: FilterGroupProps): ReactNode {
  return (
    <div className="flex items-center gap-2">
      <span className="aegis-mono-label">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        {all.map((opt) => {
          const isActive = (active ?? undefined) === opt.value;
          return (
            <Link
              key={opt.label}
              href={buildHref(opt.value)}
              prefetch={false}
              className={`aegis-mono rounded-aegis-control px-2 py-0.5 text-aegis-xs uppercase tracking-aegis-mono leading-none ${
                isActive
                  ? "bg-aegis-accent-soft text-aegis-accent"
                  : "text-aegis-fg-3 hover:text-aegis-fg-2"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function subheadFor(d: GovernanceDecision): string | undefined {
  if (d.action_result?.succeeded) {
    return `executed ${d.action_result.executed_action} · post-action ${d.drift_signal.metric}=${d.action_result.post_action_metric.toFixed(2)}`;
  }
  if (d.state === "awaiting_approval" && d.approval) {
    return `approval pending · role ${d.approval.required_role}`;
  }
  if (d.causal_attribution?.root_causes[0]) {
    const top = d.causal_attribution.root_causes[0];
    return `top cause · ${top.node} (${(top.contribution * 100).toFixed(0)}%)`;
  }
  return undefined;
}
