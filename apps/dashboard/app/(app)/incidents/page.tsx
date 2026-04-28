import { listDecisions, listModels } from "../../_lib/api";

import { IncidentsView } from "./_view";

export const metadata = {
  title: "Incidents",
};

interface IncidentsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function IncidentsPage({ searchParams }: IncidentsPageProps) {
  const search = await searchParams;
  const modelFilter = typeof search.model === "string" ? search.model : undefined;
  const stateFilter = typeof search.state === "string" ? search.state : undefined;
  const severityFilter = typeof search.severity === "string" ? search.severity : undefined;

  const [decisions, models] = await Promise.all([
    listDecisions({
      ...(modelFilter ? { modelId: modelFilter } : {}),
      ...(stateFilter ? { state: stateFilter } : {}),
    }),
    listModels(),
  ]);

  // Severity is filtered client-side because the mock API doesn't expose it
  // as a server-side query parameter — the real control plane will once the
  // /api/cp/decisions endpoint lands in Phase 5.
  const filtered = severityFilter
    ? decisions.filter((d) => d.severity === severityFilter)
    : decisions;

  return (
    <IncidentsView
      decisions={filtered}
      models={models}
      filters={{
        ...(modelFilter ? { model: modelFilter } : {}),
        ...(stateFilter ? { state: stateFilter } : {}),
        ...(severityFilter ? { severity: severityFilter } : {}),
      }}
    />
  );
}
