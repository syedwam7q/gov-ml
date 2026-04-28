import { listDatasets, listModels } from "../../_lib/api";

import { DatasetsView } from "./_view";

export const metadata = {
  title: "Datasets",
};

interface DatasetsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DatasetsPage({ searchParams }: DatasetsPageProps) {
  const search = await searchParams;
  const datasetFilter = typeof search.dataset === "string" ? search.dataset : undefined;

  const [datasets, models] = await Promise.all([listDatasets(), listModels()]);

  const activeDataset = datasets.find((d) => d.id === datasetFilter) ?? datasets[0];

  return <DatasetsView datasets={datasets} models={models} activeDataset={activeDataset} />;
}
