"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState, PoliciesIcon, PolicyYaml, RoleGate } from "@aegis/ui";

import { relativeTime } from "../../_lib/format";
import type { AegisModel, Policy } from "../../_lib/types";

interface PoliciesViewProps {
  readonly policies: readonly Policy[];
  readonly models: readonly AegisModel[];
  readonly activeModelId: string;
}

const MODE_TONE: Record<Policy["mode"], string> = {
  live: "border-status-ok/40 bg-status-ok-soft text-status-ok",
  dry_run: "border-aegis-accent/40 bg-aegis-accent-soft text-aegis-accent",
  shadow: "border-aegis-stroke text-aegis-fg-2",
};

export function PoliciesView({ policies, models, activeModelId }: PoliciesViewProps): ReactNode {
  const policiesForModel = policies
    .filter((p) => p.model_id === activeModelId)
    .sort((a, b) => b.version - a.version);
  const activePolicy = policiesForModel.find((p) => p.active) ?? policiesForModel[0];

  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="aegis-mono-label">POLICIES · GOVERNANCE DSL</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
          Policies
        </h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
          Versioned YAML policies governing what triggers an Aegis decision and which actions are
          proposed. Each policy is line-level diffable in the audit chain. Spec §6.3.
        </p>
      </header>

      <ModelTabs models={models} activeModelId={activeModelId} policies={policies} />

      {activePolicy ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <article className="aegis-card flex flex-col gap-4 p-6">
            <header className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="space-y-1">
                <p className="aegis-mono-label">{activePolicy.id.toUpperCase()}</p>
                <p className="text-aegis-base font-semibold text-aegis-fg">
                  v{activePolicy.version} · authored by {activePolicy.created_by}
                </p>
                <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
                  {relativeTime(activePolicy.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none ${MODE_TONE[activePolicy.mode]}`}
                >
                  {activePolicy.mode.replace("_", " ")}
                </span>
                <RoleGate minRole="operator">
                  <ModeToggle mode={activePolicy.mode} />
                </RoleGate>
              </div>
            </header>
            <PolicyYaml source={activePolicy.dsl_yaml} />
            <RoleGate minRole="operator">
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-aegis-stroke pt-4">
                <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
                  Editing requires operator role. Saves bump the version and append a Merkle row.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 px-3 text-aegis-sm text-aegis-fg-2 hover:border-aegis-stroke-strong"
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 rounded-aegis-control border border-aegis-accent/40 bg-aegis-accent-soft px-3 text-aegis-sm text-aegis-accent hover:border-aegis-accent"
                  >
                    dry-run new version
                  </button>
                </div>
              </footer>
            </RoleGate>
          </article>

          <aside className="flex flex-col gap-3">
            <header>
              <p className="aegis-mono-label">VERSION HISTORY</p>
              <p className="aegis-mono text-aegis-xs text-aegis-fg-3 mt-1">
                {policiesForModel.length} version{policiesForModel.length === 1 ? "" : "s"} on file
              </p>
            </header>
            <ol className="aegis-card divide-y divide-aegis-stroke">
              {policiesForModel.map((p) => (
                <li
                  key={p.id}
                  className="px-4 py-3 flex flex-wrap items-baseline justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-aegis-sm font-medium text-aegis-fg">v{p.version}</p>
                    <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
                      {p.created_by} · {relativeTime(p.created_at)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none ${
                      p.active ? MODE_TONE[p.mode] : "border-aegis-stroke text-aegis-fg-3"
                    }`}
                  >
                    {p.active ? p.mode.replace("_", " ") : "retired"}
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      ) : (
        <EmptyState
          icon={<PoliciesIcon width={20} height={20} />}
          title="NO POLICIES"
          description="No governance policy is bound to this model yet. Create one to start emitting governance decisions."
        />
      )}
    </section>
  );
}

interface ModelTabsProps {
  readonly models: readonly AegisModel[];
  readonly activeModelId: string;
  readonly policies: readonly Policy[];
}

function ModelTabs({ models, activeModelId, policies }: ModelTabsProps): ReactNode {
  return (
    <nav
      role="tablist"
      aria-label="Policies by model"
      className="-mx-1 flex flex-wrap items-center gap-1 border-b border-aegis-stroke pb-3"
    >
      {models.map((m) => {
        const active = m.id === activeModelId;
        const count = policies.filter((p) => p.model_id === m.id).length;
        return (
          <Link
            key={m.id}
            role="tab"
            aria-selected={active}
            href={`/policies?model=${m.id}`}
            prefetch={false}
            scroll={false}
            className={`rounded-aegis-control px-3 py-1.5 text-aegis-sm transition-colors duration-aegis-fast ease-aegis ${
              active
                ? "bg-aegis-accent-soft text-aegis-fg"
                : "text-aegis-fg-2 hover:bg-aegis-surface-2 hover:text-aegis-fg"
            }`}
          >
            {m.name}
            <span className="ml-2 aegis-mono text-aegis-xs text-aegis-fg-3 tabular-nums">
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function ModeToggle({ mode }: { readonly mode: Policy["mode"] }): ReactNode {
  return (
    <div className="inline-flex rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 p-0.5">
      {(["live", "dry_run", "shadow"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={mode === opt}
          className={`px-2.5 py-0.5 aegis-mono text-[10px] uppercase tracking-aegis-mono rounded-aegis-control transition-colors duration-aegis-fast ${
            mode === opt
              ? "bg-aegis-surface-3 text-aegis-fg"
              : "text-aegis-fg-3 hover:text-aegis-fg-2"
          }`}
        >
          {opt.replace("_", " ")}
        </button>
      ))}
    </div>
  );
}
