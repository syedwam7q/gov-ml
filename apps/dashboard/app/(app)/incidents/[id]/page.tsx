import { notFound } from "next/navigation";

import { getDecision, getModel, listAudit } from "../../../_lib/api";

import { DecisionDetailView } from "./_view";

interface DecisionPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function DecisionDetailPage({ params }: DecisionPageProps) {
  const { id } = await params;
  const decision = await getDecision(id);
  if (!decision) notFound();
  const [model, audit] = await Promise.all([
    getModel(decision.model_id),
    listAudit({ decisionId: id }),
  ]);
  if (!model) notFound();
  return <DecisionDetailView decision={decision} model={model} audit={audit.rows} />;
}
