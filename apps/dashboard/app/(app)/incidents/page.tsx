import { IncidentsIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Incidents",
};

export default function IncidentsPage() {
  return (
    <PageStub
      label="Incidents"
      description="Filterable list of governance decisions across the fleet. Click through to a decision detail to see the MAPE-K timeline, Pareto front, and audit chain."
      arrivingIn="phase 4d"
      icon={<IncidentsIcon width={24} height={24} />}
    />
  );
}
