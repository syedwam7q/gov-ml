import { PoliciesIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Policies",
};

export default function PoliciesPage() {
  return (
    <PageStub
      label="Policies"
      description="Monaco YAML editor with the Aegis policy DSL — drift thresholds, fairness floors, and approval routing. Dry-run / live toggle plus trigger preview."
      arrivingIn="phase 4e"
      icon={<PoliciesIcon width={24} height={24} />}
    />
  );
}
