"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn, SeverityPill } from "@aegis/ui";

import type {
  AegisModel,
  AuditRow,
  Dataset,
  GovernanceDecision,
  ModelKPI,
  ModelVersion,
  Policy,
} from "../../../_lib/types";
import { ModelOverviewTab } from "./_tabs/overview";
import { ModelDriftTab } from "./_tabs/drift";
import { ModelFairnessTab } from "./_tabs/fairness";
import { ModelCalibrationTab } from "./_tabs/calibration";
import { ModelPerformanceTab } from "./_tabs/performance";
import { ModelCausalTab } from "./_tabs/causal";
import { ModelAuditTab } from "./_tabs/audit";
import { ModelVersionsTab } from "./_tabs/versions";
import { ModelDatasetsTab } from "./_tabs/datasets";
import { ModelPoliciesTab } from "./_tabs/policies";

export type ModelTabKey =
  | "overview"
  | "drift"
  | "fairness"
  | "calibration"
  | "performance"
  | "causal"
  | "audit"
  | "versions"
  | "datasets"
  | "policies";

interface ModelDetailViewProps {
  readonly model: AegisModel;
  readonly kpi: ModelKPI;
  readonly decisions: readonly GovernanceDecision[];
  readonly versions: readonly ModelVersion[];
  readonly datasets: readonly Dataset[];
  readonly policies: readonly Policy[];
  readonly audit: readonly AuditRow[];
  readonly activeTab: ModelTabKey;
}

const TABS: readonly { readonly key: ModelTabKey; readonly label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "drift", label: "Drift" },
  { key: "fairness", label: "Fairness" },
  { key: "calibration", label: "Calibration" },
  { key: "performance", label: "Performance" },
  { key: "causal", label: "Causal DAG" },
  { key: "audit", label: "Audit" },
  { key: "versions", label: "Versions" },
  { key: "datasets", label: "Datasets" },
  { key: "policies", label: "Policies" },
];

export function ModelDetailView({
  model,
  kpi,
  decisions,
  versions,
  datasets,
  policies,
  audit,
  activeTab,
}: ModelDetailViewProps): ReactNode {
  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-8">
      <ModelHeader model={model} kpi={kpi} />
      <ModelTabBar modelId={model.id} activeTab={activeTab} />
      <div role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "overview" && (
          <ModelOverviewTab model={model} kpi={kpi} decisions={decisions} />
        )}
        {activeTab === "drift" && <ModelDriftTab model={model} kpi={kpi} />}
        {activeTab === "fairness" && <ModelFairnessTab model={model} />}
        {activeTab === "calibration" && <ModelCalibrationTab model={model} kpi={kpi} />}
        {activeTab === "performance" && <ModelPerformanceTab model={model} kpi={kpi} />}
        {activeTab === "causal" && <ModelCausalTab model={model} decisions={decisions} />}
        {activeTab === "audit" && <ModelAuditTab audit={audit} />}
        {activeTab === "versions" && <ModelVersionsTab versions={versions} />}
        {activeTab === "datasets" && <ModelDatasetsTab datasets={datasets} />}
        {activeTab === "policies" && <ModelPoliciesTab policies={policies} />}
      </div>
    </section>
  );
}

interface ModelHeaderProps {
  readonly model: AegisModel;
  readonly kpi: ModelKPI;
}

function ModelHeader({ model, kpi }: ModelHeaderProps): ReactNode {
  const isOk = kpi.severity === "OK";
  return (
    <header className="flex flex-col gap-3 border-b border-aegis-stroke pb-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="aegis-mono-label">MODEL · {model.id.toUpperCase()}</p>
        <span className="aegis-mono text-aegis-xs text-aegis-fg-3">
          family={model.family} · risk={model.risk_class} · v{model.active_version}
        </span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
            {model.name}
          </h1>
          <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">{model.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOk ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-aegis-control border border-status-ok/30 bg-status-ok-soft px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none text-status-ok"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-status-ok" />
              all clear
            </span>
          ) : (
            <SeverityPill severity={kpi.severity} />
          )}
          <span className="aegis-mono text-aegis-xs text-aegis-fg-2">
            {kpi.open_incidents} open incident{kpi.open_incidents === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      {model.real_world_incident ? (
        <p className="max-w-3xl rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 px-3 py-2 text-aegis-xs text-aegis-fg-3">
          <span className="aegis-mono-label mr-2">REFERENCE INCIDENT</span>
          {model.real_world_incident}
        </p>
      ) : null}
    </header>
  );
}

interface ModelTabBarProps {
  readonly modelId: string;
  readonly activeTab: ModelTabKey;
}

function ModelTabBar({ modelId, activeTab }: ModelTabBarProps): ReactNode {
  return (
    <nav
      role="tablist"
      aria-label="Model views"
      className="-mx-1 flex flex-wrap items-center gap-1 border-b border-aegis-stroke pb-3"
    >
      {TABS.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Link
            key={tab.key}
            id={`tab-${tab.key}`}
            role="tab"
            aria-selected={active}
            href={`/models/${modelId}?tab=${tab.key}`}
            prefetch={false}
            scroll={false}
            className={cn(
              "rounded-aegis-control px-3 py-1.5 text-aegis-sm transition-colors duration-aegis-fast ease-aegis",
              active
                ? "bg-aegis-accent-soft text-aegis-fg"
                : "text-aegis-fg-2 hover:bg-aegis-surface-2 hover:text-aegis-fg",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
