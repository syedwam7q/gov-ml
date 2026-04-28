import type { ReactNode } from "react";

import { HashBadge } from "@aegis/ui";

import { clock, relativeTime } from "../../../../_lib/format";
import type { AuditRow } from "../../../../_lib/types";

interface AuditProps {
  readonly audit: readonly AuditRow[];
}

export function ModelAuditTab({ audit }: AuditProps): ReactNode {
  if (audit.length === 0) {
    return (
      <section className="aegis-card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <p className="aegis-mono-label">AUDIT · NO ROWS IN WINDOW</p>
        <p className="max-w-md text-aegis-sm text-aegis-fg-3">
          No model-scoped audit rows in the current 24h window. Open the global Audit page for the
          full chain.
        </p>
      </section>
    );
  }

  return (
    <section className="aegis-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-4 border-b border-aegis-stroke px-6 py-4">
        <p className="aegis-mono-label">AUDIT · MODEL-SCOPED ({audit.length} rows)</p>
        <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
          merkle-chained · hmac-sha256 signed
        </p>
      </header>
      <ol className="divide-y divide-aegis-stroke">
        {audit.map((row) => (
          <li key={row.row_hash} className="px-6 py-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="aegis-mono text-aegis-xs text-aegis-fg-3 tabular-nums">
                #{row.sequence_n}
              </span>
              <span className="aegis-mono text-aegis-xs text-aegis-fg-3">{clock(row.ts)}</span>
              <span className="text-aegis-sm font-medium text-aegis-fg">{row.action}</span>
              <span className="text-aegis-fg-3">·</span>
              <span className="aegis-mono text-aegis-xs text-aegis-fg-2">{row.actor}</span>
              <span className="ml-auto aegis-mono text-aegis-xs text-aegis-fg-3">
                {relativeTime(row.ts)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 aegis-mono text-aegis-xs text-aegis-fg-3">
              <span>row_hash</span>
              <HashBadge value={row.row_hash} />
              <span>prev_hash</span>
              <HashBadge value={row.prev_hash} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
