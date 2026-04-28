import { ApprovalsIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Approvals",
};

export default function ApprovalsPage() {
  return (
    <PageStub
      label="Approvals"
      description="Pending action plans waiting on a human approver. Operators see plans for their model; admins see everything fleet-wide."
      arrivingIn="phase 4d"
      icon={<ApprovalsIcon width={24} height={24} />}
    />
  );
}
