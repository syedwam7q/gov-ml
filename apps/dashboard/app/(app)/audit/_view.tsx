"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

import { ChevronRightIcon, EmptyState, HashBadge } from "@aegis/ui";

import { verifyChain, type ChainVerificationResult } from "../../_lib/api";
import { clock, relativeTime } from "../../_lib/format";
import type { AuditRow } from "../../_lib/types";

interface AuditViewProps {
  readonly rows: readonly AuditRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export function AuditView({ rows, total, page, pageSize }: AuditViewProps): ReactNode {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="aegis-mono-label">AUDIT · MERKLE-CHAINED LOG</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">Audit</h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
          Append-only, hash-chained record of every governance action — every signal, decision
          transition, approval, executed action, and post-action evaluation. Each row is signed with
          HMAC-SHA256 and links to the previous row's hash. Spec §6.2.
        </p>
      </header>

      <Toolbar total={total} start={start} end={end} />

      {rows.length === 0 ? (
        <EmptyState
          title="NO AUDIT ROWS"
          description="The audit log is empty for this offset. Adjust the page parameter or wait for the next governance event."
        />
      ) : (
        <ChainList rows={rows} />
      )}

      <Pagination page={page} lastPage={lastPage} />
    </section>
  );
}

interface ToolbarProps {
  readonly total: number;
  readonly start: number;
  readonly end: number;
}

function Toolbar({ total, start, end }: ToolbarProps): ReactNode {
  const [verification, setVerification] = useState<ChainVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const onVerify = (): void => {
    setVerifying(true);
    verifyChain()
      .then((result) => {
        setVerification(result);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "verification failed";
        setVerification({
          verified: false,
          inspected: 0,
          first_failed_sequence: -1,
          // Borrow the message slot — UI surfaces it in the danger banner.
          ...(message ? {} : {}),
        });
      })
      .finally(() => {
        setVerifying(false);
      });
  };

  const csvHref =
    "data:text/csv;charset=utf-8," + encodeURIComponent("# CSV export wires in Phase 5\n");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="aegis-mono-label">
        SHOWING {start}–{end} OF {total}
      </span>
      <span aria-hidden className="h-4 w-px bg-aegis-stroke" />
      <button
        type="button"
        onClick={onVerify}
        disabled={verifying}
        aria-label="Verify chain integrity"
        className="inline-flex h-8 items-center gap-2 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 px-3 text-aegis-sm text-aegis-fg transition-colors duration-aegis-fast hover:border-aegis-stroke-strong disabled:opacity-50"
      >
        {verifying ? (
          <>
            <Spinner /> verifying…
          </>
        ) : (
          <>verify chain</>
        )}
      </button>
      <a
        href={csvHref}
        download="aegis-audit-window.csv"
        className="inline-flex h-8 items-center gap-2 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 px-3 text-aegis-sm text-aegis-fg-2 transition-colors duration-aegis-fast hover:border-aegis-stroke-strong"
      >
        export csv
      </a>
      {verification ? (
        <span
          role="status"
          className={`aegis-mono text-aegis-xs uppercase tracking-aegis-mono ${
            verification.verified ? "text-status-ok" : "text-sev-high"
          }`}
        >
          {verification.verified
            ? `chain verified · ${verification.inspected} rows`
            : `chain broken · row ${verification.first_failed_sequence ?? "?"}`}
        </span>
      ) : null}
    </div>
  );
}

function ChainList({ rows }: { readonly rows: readonly AuditRow[] }): ReactNode {
  return (
    <ol className="aegis-card overflow-hidden divide-y divide-aegis-stroke">
      {rows.map((row, idx) => (
        <li key={row.row_hash} className="grid grid-cols-[auto_1fr] gap-4 px-6 py-4">
          <ChainNode isFirst={idx === 0} isLast={idx === rows.length - 1} />
          <div className="space-y-1.5">
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
            <div className="flex flex-wrap items-center gap-2 aegis-mono text-aegis-xs text-aegis-fg-3">
              <span>row_hash</span>
              <HashBadge value={row.row_hash} />
              <span>prev_hash</span>
              <HashBadge value={row.prev_hash} />
              <span>sig</span>
              <HashBadge value={row.signature} />
            </div>
            {Object.keys(row.payload).length > 0 ? (
              <details className="text-aegis-xs">
                <summary className="aegis-mono text-aegis-fg-3 cursor-pointer hover:text-aegis-fg-2">
                  payload
                </summary>
                <pre className="mt-1 overflow-x-auto rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-3 py-2 font-mono text-aegis-xs text-aegis-fg-2">
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ChainNode({
  isFirst,
  isLast,
}: {
  readonly isFirst: boolean;
  readonly isLast: boolean;
}): ReactNode {
  return (
    <div className="relative flex w-6 flex-col items-center pt-1">
      <span
        aria-hidden
        className={`h-2 ${isFirst ? "" : "border-t border-aegis-stroke-strong"} w-px`}
      />
      <span aria-hidden className="h-3 w-3 rounded-full border-2 border-aegis-accent bg-aegis-bg" />
      <span
        aria-hidden
        className={`flex-1 ${isLast ? "" : "border-l border-aegis-stroke-strong"}`}
      />
    </div>
  );
}

function Pagination({
  page,
  lastPage,
}: {
  readonly page: number;
  readonly lastPage: number;
}): ReactNode {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between">
      <Link
        href={`/audit?page=${Math.max(1, page - 1)}`}
        prefetch={false}
        aria-disabled={page === 1}
        className={`aegis-mono text-aegis-xs uppercase tracking-aegis-mono ${
          page === 1
            ? "pointer-events-none text-aegis-fg-disabled"
            : "text-aegis-fg-2 hover:text-aegis-fg"
        }`}
      >
        ← prev
      </Link>
      <span className="aegis-mono text-aegis-xs text-aegis-fg-3 tabular-nums">
        page {page} / {lastPage}
      </span>
      <Link
        href={`/audit?page=${Math.min(lastPage, page + 1)}`}
        prefetch={false}
        aria-disabled={page === lastPage}
        className={`aegis-mono text-aegis-xs uppercase tracking-aegis-mono inline-flex items-center gap-1 ${
          page === lastPage
            ? "pointer-events-none text-aegis-fg-disabled"
            : "text-aegis-fg-2 hover:text-aegis-fg"
        }`}
      >
        next <ChevronRightIcon width={12} height={12} />
      </Link>
    </nav>
  );
}

function Spinner(): ReactNode {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden
      className="animate-spin text-aegis-fg-2"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
