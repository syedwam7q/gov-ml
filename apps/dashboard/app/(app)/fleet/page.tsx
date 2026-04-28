import { FleetIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Fleet",
};

export default function FleetPage() {
  return (
    <PageStub
      label="Fleet"
      description="Three production models — credit, toxicity, hospital readmission — with their KPI tiles, sparklines, and live activity feed. The default-after-login view per spec §10.1."
      arrivingIn="phase 4d"
      icon={<FleetIcon width={24} height={24} />}
    />
  );
}
