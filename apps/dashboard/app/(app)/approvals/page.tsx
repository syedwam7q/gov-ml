import { listDecisions, listModels } from "../../_lib/api";

import { ApprovalsView } from "./_view";

export const metadata = {
  title: "Approvals",
};

export default async function ApprovalsPage() {
  const [decisions, models] = await Promise.all([
    listDecisions({ state: "awaiting_approval" }),
    listModels(),
  ]);
  return <ApprovalsView decisions={decisions} models={models} />;
}
