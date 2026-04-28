import { listModels, listPolicies } from "../../_lib/api";

import { PoliciesView } from "./_view";

export const metadata = {
  title: "Policies",
};

interface PoliciesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PoliciesPage({ searchParams }: PoliciesPageProps) {
  const search = await searchParams;
  const modelFilter = typeof search.model === "string" ? search.model : undefined;

  const [policies, models] = await Promise.all([listPolicies(), listModels()]);

  return (
    <PoliciesView
      policies={policies}
      models={models}
      activeModelId={modelFilter ?? models[0]?.id ?? "credit-v1"}
    />
  );
}
