import { ModelsIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Models",
};

export default function ModelsPage() {
  return (
    <PageStub
      label="Models"
      description="Each model's full surface — overview, drift, fairness, calibration, performance, causal DAG, audit, versions, datasets, policies. Spec §10.1 lists the ten tabs."
      arrivingIn="phase 4d"
      icon={<ModelsIcon width={24} height={24} />}
    />
  );
}
