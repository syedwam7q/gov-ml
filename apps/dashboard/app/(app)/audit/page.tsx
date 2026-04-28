import { listAudit } from "../../_lib/api";

import { AuditView } from "./_view";

export const metadata = {
  title: "Audit",
};

interface AuditPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 20;

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const search = await searchParams;
  const pageParam = typeof search.page === "string" ? Number.parseInt(search.page, 10) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const { rows, total } = await listAudit({ limit: PAGE_SIZE, offset });

  return <AuditView rows={rows} total={total} page={page} pageSize={PAGE_SIZE} />;
}
