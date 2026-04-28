import type { ReactNode } from "react";

import { relativeTime } from "../../../../_lib/format";
import type { ModelVersion } from "../../../../_lib/types";

interface VersionsProps {
  readonly versions: readonly ModelVersion[];
}

const STATUS_TONE: Record<ModelVersion["status"], string> = {
  active: "border-status-ok/30 bg-status-ok-soft text-status-ok",
  canary: "border-aegis-accent/30 bg-aegis-accent-soft text-aegis-accent",
  staged: "border-sev-medium/30 bg-sev-medium-soft text-sev-medium",
  retired: "border-aegis-stroke text-aegis-fg-3",
};

export function ModelVersionsTab({ versions }: VersionsProps): ReactNode {
  return (
    <section className="aegis-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-4 border-b border-aegis-stroke px-6 py-4">
        <p className="aegis-mono-label">VERSIONS · ROLLOUT FUNNEL</p>
        <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
          staged → canary → active → retired
        </p>
      </header>
      <table className="w-full">
        <thead>
          <tr className="text-aegis-fg-3 border-b border-aegis-stroke">
            <th className="aegis-mono-label py-3 px-6 text-left">VERSION</th>
            <th className="aegis-mono-label py-3 px-2 text-left">STATUS</th>
            <th className="aegis-mono-label py-3 px-2 text-right">TRAFFIC</th>
            <th className="aegis-mono-label py-3 px-2 text-right">QC METRICS</th>
            <th className="aegis-mono-label py-3 px-6 text-right">CREATED</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-aegis-stroke">
          {versions.map((v) => (
            <tr key={v.id}>
              <td className="px-6 py-4 text-aegis-sm font-medium text-aegis-fg">v{v.version}</td>
              <td className="px-2 py-4">
                <span
                  className={`inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none ${STATUS_TONE[v.status]}`}
                >
                  {v.status}
                </span>
              </td>
              <td className="px-2 py-4 text-right aegis-mono text-aegis-sm text-aegis-fg tabular-nums">
                {v.traffic_share !== undefined ? `${v.traffic_share}%` : "—"}
              </td>
              <td className="px-2 py-4 text-right aegis-mono text-aegis-xs text-aegis-fg-3 tabular-nums">
                {Object.entries(v.qc_metrics)
                  .map(([k, val]) => `${k} ${val.toFixed(3)}`)
                  .join(" · ")}
              </td>
              <td className="px-6 py-4 text-right aegis-mono text-aegis-xs text-aegis-fg-3">
                {relativeTime(v.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
