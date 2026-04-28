import { AuditIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Audit",
};

export default function AuditPage() {
  return (
    <PageStub
      label="Audit"
      description="The Merkle-chained, append-only audit feed with the verify-chain button and CSV/JSON export. Every governance decision lands here."
      arrivingIn="phase 4d"
      icon={<AuditIcon width={24} height={24} />}
    />
  );
}
