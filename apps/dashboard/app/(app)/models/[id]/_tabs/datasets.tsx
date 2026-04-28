import type { ReactNode } from "react";

import { compactInt, relativeTime } from "../../../../_lib/format";
import type { Dataset } from "../../../../_lib/types";

interface DatasetsProps {
  readonly datasets: readonly Dataset[];
}

export function ModelDatasetsTab({ datasets }: DatasetsProps): ReactNode {
  if (datasets.length === 0) {
    return (
      <section className="aegis-card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <p className="aegis-mono-label">DATASETS · NO ATTACHMENTS</p>
        <p className="max-w-md text-aegis-sm text-aegis-fg-3">
          No training datasets registered against this model. Open the Datasets page to attach one.
        </p>
      </section>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {datasets.map((d) => (
        <li key={d.id} className="aegis-card flex flex-col gap-3 p-6">
          <header className="space-y-1">
            <p className="aegis-mono-label">DATASET · {d.id.toUpperCase()}</p>
            <p className="text-aegis-base font-semibold text-aegis-fg">{d.name}</p>
            <p className="text-aegis-sm text-aegis-fg-2 leading-aegis-snug">{d.description}</p>
          </header>
          <dl className="grid grid-cols-2 gap-3 text-aegis-xs">
            <div>
              <dt className="aegis-mono-label">ROWS</dt>
              <dd className="aegis-mono text-aegis-sm text-aegis-fg tabular-nums">
                {compactInt(d.row_count)}
              </dd>
            </div>
            <div>
              <dt className="aegis-mono-label">SOURCE</dt>
              <dd className="aegis-mono text-aegis-fg-2 truncate">{d.source}</dd>
            </div>
            <div>
              <dt className="aegis-mono-label">SNAPSHOT</dt>
              <dd className="aegis-mono text-aegis-fg-2">{d.snapshot_id}</dd>
            </div>
            <div>
              <dt className="aegis-mono-label">CREATED</dt>
              <dd className="aegis-mono text-aegis-fg-2">{relativeTime(d.created_at)}</dd>
            </div>
          </dl>
          <a
            href={d.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="aegis-mono text-aegis-xs text-aegis-accent hover:text-aegis-accent-strong"
          >
            datasheet · {d.source_url} →
          </a>
        </li>
      ))}
    </ul>
  );
}
