import { DatasetsIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Datasets",
};

export default function DatasetsPage() {
  return (
    <PageStub
      label="Datasets"
      description="Datasheets-for-Datasets per Gebru 2021 with snapshot diffing, drift between baselines, and full provenance for every training run."
      arrivingIn="phase 4e"
      icon={<DatasetsIcon width={24} height={24} />}
    />
  );
}
