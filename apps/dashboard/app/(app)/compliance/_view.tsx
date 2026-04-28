"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { ComplianceIcon, KPITile } from "@aegis/ui";

import type { ComplianceMapping } from "../../_lib/types";

interface ComplianceViewProps {
  readonly frameworks: readonly ComplianceMapping[];
}

const STATUS_TONE: Record<"complete" | "partial" | "n/a", string> = {
  complete: "border-status-ok/40 bg-status-ok-soft text-status-ok",
  partial: "border-sev-medium/40 bg-sev-medium-soft text-sev-medium",
  "n/a": "border-aegis-stroke text-aegis-fg-3",
};

const STATUS_LABEL: Record<"complete" | "partial" | "n/a", string> = {
  complete: "complete",
  partial: "partial",
  "n/a": "n/a",
};

export function ComplianceView({ frameworks }: ComplianceViewProps): ReactNode {
  const [exporting, setExporting] = useState(false);

  const totals = frameworks.reduce(
    (acc, f) => {
      for (const c of f.clauses) {
        acc[c.status] = (acc[c.status] ?? 0) + 1;
        acc.total = (acc.total ?? 0) + 1;
      }
      return acc;
    },
    { total: 0, complete: 0, partial: 0, "n/a": 0 } as Record<string, number>,
  );

  const totalCount = totals.total ?? 0;
  const completeCount = totals.complete ?? 0;
  const partialCount = totals.partial ?? 0;
  const naCount = totals["n/a"] ?? 0;
  const pct = totalCount === 0 ? 0 : (completeCount / totalCount) * 100;

  const onExport = (): void => {
    setExporting(true);
    // The real PDF render lives in services/compliance (Phase 4e+).
    window.setTimeout(() => setExporting(false), 1200);
  };

  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="aegis-mono-label">COMPLIANCE · REGULATORY MAPPING</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
          Compliance
        </h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
          Each framework's clauses mapped to the Aegis evidence that satisfies them. Use the PDF
          export when an auditor asks for a single packet of authority — every line links back to
          its source artifact in the audit chain.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPITile
          label="Frameworks tracked"
          value={frameworks.length}
          trend="EU AI Act · NIST AI RMF · ECOA · FCRA · HIPAA"
        />
        <KPITile
          label="Clauses · complete"
          value={`${completeCount}`}
          trend={`${pct.toFixed(0)}% of total`}
          tone={pct >= 80 ? "ok" : pct >= 60 ? "warning" : "danger"}
        />
        <KPITile
          label="Clauses · partial"
          value={`${partialCount}`}
          trend="evidence partial · in flight"
          tone={partialCount === 0 ? "ok" : "warning"}
        />
        <KPITile label="Clauses · n/a" value={`${naCount}`} trend="out of scope for this fleet" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="aegis-mono-label">
          {frameworks.length} FRAMEWORK{frameworks.length === 1 ? "" : "S"}
        </p>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          aria-label="Export PDF report"
          className="inline-flex h-8 items-center gap-2 rounded-aegis-control border border-aegis-accent/40 bg-aegis-accent-soft px-3 text-aegis-sm text-aegis-accent transition-colors duration-aegis-fast hover:border-aegis-accent disabled:opacity-50"
        >
          {exporting ? "rendering pdf…" : "export pdf report"}
        </button>
      </div>

      {frameworks.length === 0 ? (
        <article className="aegis-card flex flex-col items-center gap-3 px-6 py-10 text-center">
          <ComplianceIcon width={20} height={20} />
          <p className="aegis-mono-label">NO FRAMEWORKS REGISTERED</p>
        </article>
      ) : (
        <div className="flex flex-col gap-4">
          {frameworks.map((f) => (
            <FrameworkCard key={f.framework} framework={f} />
          ))}
        </div>
      )}
    </section>
  );
}

function FrameworkCard({ framework }: { readonly framework: ComplianceMapping }): ReactNode {
  const total = framework.clauses.length;
  const complete = framework.clauses.filter((c) => c.status === "complete").length;
  const partial = framework.clauses.filter((c) => c.status === "partial").length;

  return (
    <article className="aegis-card overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-aegis-stroke px-6 py-4">
        <div className="space-y-1">
          <p className="aegis-mono-label">{framework.framework.toUpperCase()}</p>
          <p className="text-aegis-base font-semibold text-aegis-fg">{framework.framework}</p>
        </div>
        <div className="aegis-mono text-aegis-xs text-aegis-fg-3 tabular-nums">
          {complete}/{total} complete{partial > 0 ? ` · ${partial} partial` : ""}
        </div>
      </header>
      <table className="w-full">
        <thead>
          <tr className="text-aegis-fg-3 border-b border-aegis-stroke">
            <th className="aegis-mono-label py-3 px-6 text-left">CLAUSE</th>
            <th className="aegis-mono-label py-3 px-2 text-left">REQUIREMENT</th>
            <th className="aegis-mono-label py-3 px-2 text-left">EVIDENCE</th>
            <th className="aegis-mono-label py-3 px-6 text-right">STATUS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-aegis-stroke">
          {framework.clauses.map((c) => (
            <tr key={c.clause}>
              <td className="px-6 py-3 aegis-mono text-aegis-xs text-aegis-fg">{c.clause}</td>
              <td className="px-2 py-3 text-aegis-sm text-aegis-fg-2">{c.title}</td>
              <td className="px-2 py-3 text-aegis-xs text-aegis-fg-3 leading-aegis-snug max-w-md">
                {c.evidence ?? "—"}
              </td>
              <td className="px-6 py-3 text-right">
                <span
                  className={`inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none ${STATUS_TONE[c.status]}`}
                >
                  {STATUS_LABEL[c.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
