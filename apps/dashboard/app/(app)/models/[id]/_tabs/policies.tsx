import type { ReactNode } from "react";

import { relativeTime } from "../../../../_lib/format";
import type { Policy } from "../../../../_lib/types";

interface PoliciesProps {
  readonly policies: readonly Policy[];
}

const MODE_TONE: Record<Policy["mode"], string> = {
  live: "border-status-ok/30 bg-status-ok-soft text-status-ok",
  dry_run: "border-aegis-accent/30 bg-aegis-accent-soft text-aegis-accent",
  shadow: "border-aegis-stroke text-aegis-fg-2",
};

export function ModelPoliciesTab({ policies }: PoliciesProps): ReactNode {
  if (policies.length === 0) {
    return (
      <section className="aegis-card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <p className="aegis-mono-label">POLICIES · NONE ACTIVE</p>
        <p className="max-w-md text-aegis-sm text-aegis-fg-3">
          No policy is bound to this model. Open the Policies page to author one.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {policies.map((p) => (
        <article key={p.id} className="aegis-card flex flex-col gap-4 p-6">
          <header className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="aegis-mono-label">POLICY · v{p.version}</p>
              <p className="text-aegis-base font-semibold text-aegis-fg">{p.id}</p>
              <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
                authored by {p.created_by} · {relativeTime(p.created_at)}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none ${MODE_TONE[p.mode]}`}
            >
              {p.mode.replace("_", " ")}
            </span>
          </header>
          <pre className="overflow-x-auto rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-4 py-3 font-mono text-aegis-xs text-aegis-fg-2 leading-aegis-snug">
            {p.dsl_yaml}
          </pre>
        </article>
      ))}
    </div>
  );
}
