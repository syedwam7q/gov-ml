import Link from "next/link";
import type { ReactNode } from "react";

import { KPITile, Sparkline, StatePill } from "@aegis/ui";

import { compactInt, metricValue, relativeTime, signedPct } from "../../../../_lib/format";
import type { AegisModel, GovernanceDecision, ModelKPI } from "../../../../_lib/types";

interface OverviewProps {
  readonly model: AegisModel;
  readonly kpi: ModelKPI;
  readonly decisions: readonly GovernanceDecision[];
}

export function ModelOverviewTab({ model, kpi, decisions }: OverviewProps): ReactNode {
  const headlineDelta = computeDelta(kpi.headline_metric.trend.map((p) => p.v));

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPITile
          label={`${kpi.headline_metric.key} · 24h`}
          value={metricValue(kpi.headline_metric.value)}
          trend={`floor ${metricValue(kpi.headline_metric.floor)} · ${kpi.headline_metric.status === "ok" ? "passing" : kpi.headline_metric.status === "warning" ? "watch" : "breach"}`}
          tone={
            kpi.headline_metric.status === "ok"
              ? "ok"
              : kpi.headline_metric.status === "warning"
                ? "warning"
                : "danger"
          }
        >
          <Sparkline
            values={kpi.headline_metric.trend.map((p) => p.v)}
            tone={
              kpi.headline_metric.status === "danger"
                ? "severity-high"
                : kpi.headline_metric.status === "warning"
                  ? "severity-medium"
                  : "status-ok"
            }
            width={220}
            height={42}
          />
        </KPITile>

        <KPITile
          label="Predictions · 24h"
          value={compactInt(kpi.predictions_total)}
          trend={`${signedPct(headlineDelta)} on metric`}
        >
          <Sparkline
            values={kpi.predictions_trend.map((p) => p.v)}
            tone="accent"
            width={220}
            height={42}
          />
        </KPITile>

        <KPITile
          label="Latency · p95"
          value={`${kpi.p95_latency_ms}ms`}
          trend={`p50 ${kpi.p50_latency_ms}ms`}
          tone="ok"
        >
          <Sparkline
            values={kpi.latency_trend.map((p) => p.v)}
            tone="accent"
            width={220}
            height={42}
          />
        </KPITile>

        <KPITile
          label="Errors · 24h"
          value={`${(kpi.error_rate * 100).toFixed(2)}%`}
          trend={kpi.error_rate < 0.005 ? "within slo" : "above slo"}
          tone={kpi.error_rate < 0.005 ? "ok" : "warning"}
        >
          <Sparkline
            values={kpi.error_trend.map((p) => p.v)}
            tone="accent"
            width={220}
            height={42}
          />
        </KPITile>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <article className="aegis-card p-6">
          <header className="mb-4 flex items-baseline justify-between gap-3">
            <p className="aegis-mono-label">RECENT DECISIONS · 24H</p>
            <Link
              href={`/incidents?model=${model.id}`}
              prefetch={false}
              className="aegis-mono text-aegis-xs text-aegis-accent hover:text-aegis-accent-strong"
            >
              all incidents →
            </Link>
          </header>
          {decisions.length === 0 ? (
            <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
              No decisions opened in this window.
            </p>
          ) : (
            <ul className="-mx-2 divide-y divide-aegis-stroke">
              {decisions.slice(0, 5).map((d) => (
                <li key={d.id} className="px-2 py-3">
                  <Link
                    href={`/incidents/${d.id}`}
                    prefetch={false}
                    className="flex items-center gap-3 text-aegis-sm"
                  >
                    <StatePill state={d.state} />
                    <span className="flex-1 truncate text-aegis-fg">{d.title}</span>
                    <span className="aegis-mono text-aegis-xs text-aegis-fg-3 shrink-0">
                      {relativeTime(d.opened_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="aegis-card p-6">
          <p className="aegis-mono-label mb-4">RISK PROFILE</p>
          <dl className="space-y-3">
            <Pair label="Family" value={model.family} />
            <Pair label="Risk class" value={model.risk_class} />
            <Pair label="Active version" value={`v${model.active_version}`} />
            <Pair label="Owner" value={model.owner_id} />
            <Pair label="Domain" value={model.domain} />
          </dl>
          <div className="mt-5 space-y-2">
            <p className="aegis-mono-label">REFERENCE</p>
            <p className="text-aegis-xs text-aegis-fg-3 leading-aegis-snug">
              {model.real_world_incident ?? "No prior real-world incident mapped."}
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}

function Pair({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="flex items-center justify-between text-aegis-sm">
      <dt className="aegis-mono-label">{label.toUpperCase()}</dt>
      <dd className="aegis-mono text-aegis-fg-2">{value}</dd>
    </div>
  );
}

function computeDelta(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const first = values[0];
  const last = values[values.length - 1];
  if (first === undefined || last === undefined || first === 0) return 0;
  return (last - first) / first;
}
