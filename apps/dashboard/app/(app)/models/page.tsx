import Link from "next/link";

import { ModelsIcon } from "@aegis/ui";

import { listModels } from "../../_lib/api";

export const metadata = {
  title: "Models",
};

/**
 * /models — model index. Lists every registered model with a deep-link
 * into its detail surface. Most users land here from the LeftRail or
 * the command palette.
 */
export default async function ModelsIndex() {
  const models = await listModels();
  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="aegis-mono-label">MODELS · REGISTRY</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">Models</h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
          Every registered model under Aegis governance. Open one to inspect drift, fairness,
          calibration, performance, the causal DAG, audit log, versions, datasets, and policies.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {models.map((m) => (
          <li key={m.id}>
            <Link
              href={`/models/${m.id}`}
              prefetch={false}
              className="aegis-card flex flex-col gap-3 p-5 transition-colors duration-aegis-base ease-aegis hover:border-aegis-stroke-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="aegis-mono-label">{m.id.toUpperCase()}</p>
                  <p className="text-aegis-base font-semibold text-aegis-fg">{m.name}</p>
                </div>
                <span className="text-aegis-fg-3">
                  <ModelsIcon />
                </span>
              </div>
              <p className="text-aegis-sm text-aegis-fg-2 line-clamp-3">{m.description}</p>
              <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
                family={m.family} · risk={m.risk_class} · v{m.active_version}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
