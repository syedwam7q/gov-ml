import { listCompliance } from "../../_lib/api";

import { ComplianceView } from "./_view";

export const metadata = {
  title: "Compliance",
};

export default async function CompliancePage() {
  const frameworks = await listCompliance();
  return <ComplianceView frameworks={frameworks} />;
}
