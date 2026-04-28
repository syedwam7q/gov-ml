import { notFound } from "next/navigation";

import {
  getModel,
  getModelKPI,
  listAudit,
  listDatasets,
  listDecisions,
  listModelVersions,
  listPolicies,
} from "../../../_lib/api";

import { ModelDetailView, type ModelTabKey } from "./_view";

const TABS: readonly ModelTabKey[] = [
  "overview",
  "drift",
  "fairness",
  "calibration",
  "performance",
  "causal",
  "audit",
  "versions",
  "datasets",
  "policies",
];

interface ModelDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asTab(value: string | string[] | undefined): ModelTabKey {
  const v = Array.isArray(value) ? value[0] : value;
  return TABS.includes(v as ModelTabKey) ? (v as ModelTabKey) : "overview";
}

export default async function ModelDetailPage({ params, searchParams }: ModelDetailPageProps) {
  const { id } = await params;
  const search = await searchParams;
  const activeTab = asTab(search.tab);

  const [model, kpi, decisions, versions, datasets, policies, audit] = await Promise.all([
    getModel(id),
    getModelKPI(id, "24h"),
    listDecisions({ modelId: id, limit: 20 }),
    listModelVersions(id),
    listDatasets(),
    listPolicies(id),
    listAudit({ limit: 30 }),
  ]);

  if (!model || !kpi) notFound();

  // Filter audit rows to only those carrying a payload referencing this model.
  // The mock audit chain keys on `decision_id`; we reconstruct membership via
  // the decisions list.
  const decisionIds = new Set(decisions.map((d) => d.id));
  const modelAudit = audit.rows.filter((r) => {
    const payloadDecisionId = (r.payload as { decision_id?: string }).decision_id;
    return payloadDecisionId !== undefined && decisionIds.has(payloadDecisionId);
  });

  const modelDatasets = datasets.filter((d) => d.model_ids.includes(id));

  return (
    <ModelDetailView
      model={model}
      kpi={kpi}
      decisions={decisions}
      versions={versions}
      datasets={modelDatasets}
      policies={policies}
      audit={modelAudit}
      activeTab={activeTab}
    />
  );
}
