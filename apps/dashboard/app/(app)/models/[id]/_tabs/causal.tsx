import Link from "next/link";
import type { ReactNode } from "react";

import { CausalDAG, type CausalDAGEdge, type CausalDAGNode } from "@aegis/ui";

import type { AegisModel, GovernanceDecision } from "../../../../_lib/types";

interface CausalProps {
  readonly model: AegisModel;
  readonly decisions: readonly GovernanceDecision[];
}

export function ModelCausalTab({ model, decisions }: CausalProps): ReactNode {
  const decision = decisions.find((d) => d.causal_attribution !== undefined);
  const attribution = decision?.causal_attribution;

  if (!attribution) {
    return (
      <section className="aegis-card flex flex-col items-center gap-3 px-6 py-12 text-center">
        <p className="aegis-mono-label">CAUSAL DAG · NO ROOT-CAUSE PAYLOAD</p>
        <p className="max-w-md text-aegis-sm text-aegis-fg-3">
          {model.name} has no decisions in this window with a populated causal attribution. Causal
          analysis runs only when a decision crosses the ANALYZED state.
        </p>
      </section>
    );
  }

  const target: CausalDAGNode = {
    id: "target",
    label: attribution.target_metric,
    layer: 1,
    primary: true,
    hint: `observed ${attribution.observed_value.toFixed(2)} · counterfactual ${attribution.counterfactual_value.toFixed(2)}`,
  };

  const causes: CausalDAGNode[] = attribution.root_causes.map((rc, idx) => ({
    id: `c-${idx}`,
    label: rc.node,
    layer: 0,
    contribution: rc.contribution,
    primary: idx === 0,
    hint: rc.explanation,
  }));

  const edges: CausalDAGEdge[] = causes.map((c, idx) => ({
    from: c.id,
    to: "target",
    strength: attribution.root_causes[idx]?.contribution ?? 0.3,
  }));

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          label="Target metric"
          value={attribution.target_metric}
          hint={`observed = ${attribution.observed_value.toFixed(2)}`}
        />
        <Stat
          label="Counterfactual"
          value={attribution.counterfactual_value.toFixed(2)}
          hint="if root causes had not shifted"
        />
        <Stat
          label="Top contributor"
          value={`${(attribution.root_causes[0]?.contribution ?? 0) * 100}%`.replace(/\.\d+/, "")}
          hint={attribution.root_causes[0]?.node ?? "—"}
        />
      </section>

      <CausalDAG nodes={[...causes, target]} edges={edges} />

      <section className="aegis-card p-6">
        <p className="aegis-mono-label mb-3">ROOT CAUSES · CONTRIBUTION BREAKDOWN</p>
        <ul className="divide-y divide-aegis-stroke">
          {attribution.root_causes.map((rc, idx) => (
            <li
              key={rc.node}
              className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(160px,260px)]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`aegis-mono text-aegis-xs ${idx === 0 ? "text-sev-high" : "text-aegis-accent"}`}
                  >
                    {(rc.contribution * 100).toFixed(0)}%
                  </span>
                  <span className="text-aegis-sm font-medium text-aegis-fg">{rc.node}</span>
                </div>
                <p className="text-aegis-xs text-aegis-fg-3 leading-aegis-snug">{rc.explanation}</p>
              </div>
              <div className="self-center">
                <ContributionBar value={rc.contribution} primary={idx === 0} />
              </div>
            </li>
          ))}
        </ul>
        {decision ? (
          <div className="mt-5 flex items-center gap-3 border-t border-aegis-stroke pt-4">
            <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
              attribution from decision · {decision.id}
            </p>
            <Link
              href={`/incidents/${decision.id}`}
              prefetch={false}
              className="aegis-mono text-aegis-xs text-aegis-accent hover:text-aegis-accent-strong"
            >
              open decision →
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}): ReactNode {
  return (
    <article className="aegis-card p-5 space-y-1">
      <p className="aegis-mono-label">{label.toUpperCase()}</p>
      <p className="text-aegis-md font-semibold tabular-nums text-aegis-fg">{value}</p>
      <p className="aegis-mono text-aegis-xs text-aegis-fg-3">{hint}</p>
    </article>
  );
}

function ContributionBar({
  value,
  primary,
}: {
  readonly value: number;
  readonly primary: boolean;
}): ReactNode {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="h-2 w-full overflow-hidden rounded-aegis-pill bg-aegis-surface-2"
    >
      <div
        className={primary ? "h-full bg-sev-high" : "h-full bg-aegis-accent"}
        style={{ width: `${(value * 100).toFixed(1)}%` }}
      />
    </div>
  );
}
