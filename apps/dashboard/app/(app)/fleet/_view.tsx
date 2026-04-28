"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  ActivityFeed,
  KPITile,
  ModelCard,
  type ActivityFeedEvent,
  type ActivityFeedKind,
  type ModelCardSeverity,
} from "@aegis/ui";

import { useActivity, useFleetKPIs, useModels } from "../../_lib/hooks";
import { compactInt, metricValue, relativeTime } from "../../_lib/format";
import type { ActivityEvent, AegisModel, ModelKPI } from "../../_lib/types";

interface FleetViewProps {
  readonly models: readonly AegisModel[];
  readonly kpis: readonly ModelKPI[];
  readonly activity: readonly ActivityEvent[];
}

/**
 * /fleet client view — subscribes to SWR for live revalidation while
 * starting from the server-rendered snapshot. Renders three ModelCards
 * and the global activity feed.
 */
export function FleetView({
  models: initialModels,
  kpis: initialKpis,
  activity: initialActivity,
}: FleetViewProps): ReactNode {
  const { data: models = initialModels } = useModels();
  const { data: kpis = initialKpis } = useFleetKPIs("24h");
  const { data: activity = initialActivity } = useActivity(20);

  const totals = aggregateTotals(kpis);

  const events: readonly ActivityFeedEvent[] = activity.map((e) => ({
    id: e.id,
    ts: e.ts,
    kind: e.kind satisfies ActivityFeedKind,
    severity: e.severity,
    relativeTime: relativeTime(e.ts),
    summary: e.summary,
    actor: e.actor,
  }));

  const kpiByModel = new Map(kpis.map((k) => [k.model_id, k] as const));

  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="aegis-mono-label">FLEET · 24H</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
          Fleet overview
        </h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
          Three production models under continuous Aegis governance. Headline metrics, severity
          rollup, and the live MAPE-K activity stream — everything refreshing in place.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPITile
          label="Models active"
          value={totals.activeModels}
          unit={`/ ${models.length}`}
          trend={totals.activeModels === models.length ? "all healthy" : "fleet partial"}
          tone={totals.activeModels === models.length ? "ok" : "warning"}
        />
        <KPITile
          label="Predictions · 24h"
          value={compactInt(totals.predictions)}
          trend={`across ${models.length} models`}
        />
        <KPITile
          label="Open incidents"
          value={totals.openIncidents}
          trend={totals.openIncidents === 0 ? "clean window" : `${totals.severityHint}`}
          tone={
            totals.openIncidents === 0 ? "ok" : totals.criticalIncidents > 0 ? "danger" : "warning"
          }
        />
        <KPITile
          label="Highest severity"
          value={totals.highestSeverity}
          trend={totals.highestSeverity === "OK" ? "no severity" : `${totals.openIncidents} active`}
          tone={
            totals.highestSeverity === "OK"
              ? "ok"
              : totals.highestSeverity === "CRITICAL" || totals.highestSeverity === "HIGH"
                ? "danger"
                : "warning"
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {models.map((m) => {
            const kpi = kpiByModel.get(m.id);
            const cardSeverity: ModelCardSeverity = kpi?.severity ?? "OK";
            return (
              <ModelCard
                key={m.id}
                modelId={m.id}
                name={m.name}
                version={m.active_version}
                riskClass={m.risk_class}
                description={m.description}
                severity={cardSeverity}
                openIncidents={kpi?.open_incidents ?? 0}
                headline={
                  kpi
                    ? {
                        key: kpi.headline_metric.key,
                        value: metricValue(kpi.headline_metric.value),
                        floor: metricValue(kpi.headline_metric.floor),
                        status: kpi.headline_metric.status,
                        trend: kpi.headline_metric.trend.map((p) => p.v),
                      }
                    : { key: "—", value: "—", floor: "—", status: "ok", trend: [] }
                }
                kpis={
                  kpi
                    ? [
                        {
                          label: "PREDICTIONS · 24H",
                          value: compactInt(kpi.predictions_total),
                          hint: `peak ${compactInt(Math.round(Math.max(...kpi.predictions_trend.map((p) => p.v))))}/hr`,
                        },
                        {
                          label: "P95 LATENCY",
                          value: `${kpi.p95_latency_ms}ms`,
                          hint: `p50 ${kpi.p50_latency_ms}ms`,
                        },
                        {
                          label: "ERROR RATE",
                          value: `${(kpi.error_rate * 100).toFixed(2)}%`,
                          hint: kpi.error_rate < 0.005 ? "within slo" : "above slo",
                        },
                      ]
                    : [
                        { label: "PREDICTIONS", value: "—" },
                        { label: "P95 LATENCY", value: "—" },
                        { label: "ERROR RATE", value: "—" },
                      ]
                }
                renderAction={({ className, children }) => (
                  <Link href={`/models/${m.id}`} className={className} prefetch={false}>
                    {children}
                  </Link>
                )}
              />
            );
          })}
        </div>

        <aside className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="aegis-mono-label">LIVE ACTIVITY</p>
            <Link
              href="/audit"
              className="aegis-mono text-aegis-xs text-aegis-fg-3 hover:text-aegis-fg-2"
              prefetch={false}
            >
              full audit →
            </Link>
          </div>
          <ActivityFeed events={events} compact />
        </aside>
      </section>
    </section>
  );
}

interface FleetTotals {
  readonly activeModels: number;
  readonly predictions: number;
  readonly openIncidents: number;
  readonly criticalIncidents: number;
  readonly highestSeverity: "OK" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly severityHint: string;
}

function aggregateTotals(kpis: readonly ModelKPI[]): FleetTotals {
  const RANK = { OK: -1, LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
  let predictions = 0;
  let openIncidents = 0;
  let criticalIncidents = 0;
  let highestSeverity: FleetTotals["highestSeverity"] = "OK";
  for (const k of kpis) {
    predictions += k.predictions_total;
    openIncidents += k.open_incidents;
    if (k.severity === "CRITICAL") criticalIncidents++;
    const rank = RANK[k.severity];
    if (rank > RANK[highestSeverity]) highestSeverity = k.severity;
  }
  return {
    activeModels: kpis.length,
    predictions,
    openIncidents,
    criticalIncidents,
    highestSeverity,
    severityHint:
      highestSeverity === "OK"
        ? "clean window"
        : `${highestSeverity.toLowerCase()} severity active`,
  };
}
