import { ComplianceIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Compliance",
};

export default function CompliancePage() {
  return (
    <PageStub
      label="Compliance"
      description="Regulatory mapping table — EU AI Act, NIST AI RMF, ECOA, HIPAA — with one-click PDF report generation suitable for auditors."
      arrivingIn="phase 4e"
      icon={<ComplianceIcon width={24} height={24} />}
    />
  );
}
