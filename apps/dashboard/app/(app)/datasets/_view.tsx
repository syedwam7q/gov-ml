"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { DatasetsIcon, EmptyState } from "@aegis/ui";

import { compactInt, relativeTime } from "../../_lib/format";
import type { AegisModel, Dataset, DatasetSnapshot } from "../../_lib/types";

interface DatasetsViewProps {
  readonly datasets: readonly Dataset[];
  readonly models: readonly AegisModel[];
  readonly activeDataset?: Dataset | undefined;
}

export function DatasetsView({ datasets, models, activeDataset }: DatasetsViewProps): ReactNode {
  if (!activeDataset) {
    return (
      <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-8">
        <EmptyState
          icon={<DatasetsIcon width={20} height={20} />}
          title="NO DATASETS REGISTERED"
          description="Aegis has not seen any training-data registration yet. Datasets get attached to models in Phase 5."
        />
      </section>
    );
  }
  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="aegis-mono-label">DATASETS · DATASHEETS-FOR-DATASETS (Gebru 2021)</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
          Datasets
        </h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
          Provenance, schema, and snapshot history for every training corpus under Aegis governance.
          Each dataset gets a structured datasheet so reviewers see what was collected, how, and
          where the dataset must not be used.
        </p>
      </header>

      <DatasetTabs datasets={datasets} activeId={activeDataset.id} />

      <DatasetDetail dataset={activeDataset} models={models} />
    </section>
  );
}

interface DatasetTabsProps {
  readonly datasets: readonly Dataset[];
  readonly activeId: string;
}

function DatasetTabs({ datasets, activeId }: DatasetTabsProps): ReactNode {
  return (
    <nav
      role="tablist"
      aria-label="Datasets"
      className="-mx-1 flex flex-wrap items-center gap-1 border-b border-aegis-stroke pb-3"
    >
      {datasets.map((d) => {
        const active = d.id === activeId;
        return (
          <Link
            key={d.id}
            role="tab"
            aria-selected={active}
            href={`/datasets?dataset=${d.id}`}
            prefetch={false}
            scroll={false}
            className={`rounded-aegis-control px-3 py-1.5 text-aegis-sm transition-colors duration-aegis-fast ease-aegis ${
              active
                ? "bg-aegis-accent-soft text-aegis-fg"
                : "text-aegis-fg-2 hover:bg-aegis-surface-2 hover:text-aegis-fg"
            }`}
          >
            {d.name}
          </Link>
        );
      })}
    </nav>
  );
}

interface DatasetDetailProps {
  readonly dataset: Dataset;
  readonly models: readonly AegisModel[];
}

function DatasetDetail({ dataset, models }: DatasetDetailProps): ReactNode {
  const linkedModels = models.filter((m) => dataset.model_ids.includes(m.id));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <article className="aegis-card flex flex-col gap-5 p-6">
        <header className="space-y-2">
          <p className="aegis-mono-label">DATASET · {dataset.id.toUpperCase()}</p>
          <p className="text-aegis-base font-semibold text-aegis-fg">{dataset.name}</p>
          <p className="text-aegis-sm text-aegis-fg-2 leading-aegis-snug">{dataset.description}</p>
        </header>

        <section className="grid grid-cols-2 gap-4 border-t border-aegis-stroke pt-4 md:grid-cols-4">
          <Pair label="ROWS" value={compactInt(dataset.row_count)} />
          <Pair label="ACTIVE SNAPSHOT" value={dataset.snapshot_id} mono />
          <Pair label="SOURCE" value={dataset.source} />
          <Pair label="REGISTERED" value={relativeTime(dataset.created_at)} />
        </section>

        {dataset.datasheet ? (
          <section className="grid grid-cols-1 gap-4 border-t border-aegis-stroke pt-5">
            <DatasheetEntry title="MOTIVATION">{dataset.datasheet.motivation}</DatasheetEntry>
            <DatasheetEntry title="COMPOSITION">{dataset.datasheet.composition}</DatasheetEntry>
            <DatasheetEntry title="COLLECTION">{dataset.datasheet.collection}</DatasheetEntry>
            <DatasheetEntry title="RECOMMENDED USES">{dataset.datasheet.uses}</DatasheetEntry>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DatasheetEntry title="SENSITIVE ATTRIBUTES">
                <ul className="flex flex-wrap gap-1.5">
                  {dataset.datasheet.sensitive_attributes.map((attr) => (
                    <li
                      key={attr}
                      className="rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-2 py-0.5 aegis-mono text-[11px] text-aegis-fg-2"
                    >
                      {attr}
                    </li>
                  ))}
                </ul>
              </DatasheetEntry>
              <DatasheetEntry title="MAINTENANCE">{dataset.datasheet.maintenance}</DatasheetEntry>
            </div>
          </section>
        ) : null}

        {dataset.schema ? (
          <section className="space-y-3 border-t border-aegis-stroke pt-5">
            <p className="aegis-mono-label">SCHEMA · {dataset.schema.length} COLUMNS</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {dataset.schema.map((col) => (
                <li
                  key={col.column}
                  className="flex items-center justify-between rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 px-3 py-2"
                >
                  <span className="aegis-mono text-aegis-xs text-aegis-fg">{col.column}</span>
                  <span className="aegis-mono text-aegis-xs text-aegis-fg-3">
                    {col.type}
                    {col.hint ? ` · ${col.hint}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      <aside className="flex flex-col gap-4">
        <article className="aegis-card flex flex-col gap-3 p-6">
          <header className="flex items-baseline justify-between gap-3">
            <p className="aegis-mono-label">USED BY MODELS</p>
          </header>
          {linkedModels.length === 0 ? (
            <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
              No models bind to this dataset.
            </p>
          ) : (
            <ul className="space-y-2">
              {linkedModels.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/models/${m.id}`}
                    prefetch={false}
                    className="aegis-card flex items-center justify-between p-3 text-aegis-sm text-aegis-fg transition-colors duration-aegis-fast hover:border-aegis-stroke-strong"
                  >
                    <span>{m.name}</span>
                    <span className="aegis-mono text-aegis-xs text-aegis-fg-3">{m.id}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        {dataset.snapshots && dataset.snapshots.length > 0 ? (
          <article className="aegis-card flex flex-col gap-3 p-6">
            <header className="flex items-baseline justify-between gap-3">
              <p className="aegis-mono-label">SNAPSHOTS · DRIFT VS BASELINE</p>
              <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
                psi · 0.0 stable · ≥ 0.20 drift
              </p>
            </header>
            <ol className="divide-y divide-aegis-stroke">
              {dataset.snapshots.map((snap, idx) => (
                <SnapshotRow key={snap.id} snap={snap} isFirst={idx === 0} />
              ))}
            </ol>
          </article>
        ) : null}

        <a
          href={dataset.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="aegis-card flex items-center justify-between gap-2 p-4 text-aegis-sm text-aegis-fg transition-colors duration-aegis-fast hover:border-aegis-stroke-strong"
        >
          <span>
            <p className="aegis-mono-label mb-1">CANONICAL SOURCE</p>
            <span className="aegis-mono text-aegis-xs text-aegis-fg-3 break-all">
              {dataset.source_url}
            </span>
          </span>
          <span className="aegis-mono text-aegis-xs text-aegis-accent shrink-0">visit →</span>
        </a>
      </aside>
    </div>
  );
}

function DatasheetEntry({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section className="space-y-1.5">
      <p className="aegis-mono-label">{title}</p>
      <div className="text-aegis-sm text-aegis-fg-2 leading-aegis-snug">{children}</div>
    </section>
  );
}

function Pair({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}): ReactNode {
  return (
    <div className="space-y-1">
      <p className="aegis-mono-label">{label}</p>
      <p
        className={mono ? "aegis-mono text-aegis-sm text-aegis-fg" : "text-aegis-sm text-aegis-fg"}
      >
        {value}
      </p>
    </div>
  );
}

function SnapshotRow({
  snap,
  isFirst,
}: {
  readonly snap: DatasetSnapshot;
  readonly isFirst: boolean;
}): ReactNode {
  const tone =
    snap.psi_vs_baseline === 0
      ? "border-aegis-stroke text-aegis-fg-3"
      : snap.psi_vs_baseline >= 0.2
        ? "border-sev-high/40 bg-sev-high-soft text-sev-high"
        : snap.psi_vs_baseline >= 0.1
          ? "border-sev-medium/40 bg-sev-medium-soft text-sev-medium"
          : "border-status-ok/40 bg-status-ok-soft text-status-ok";

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-3 px-1 py-3">
      <div className="space-y-0.5">
        <p className="aegis-mono text-aegis-sm text-aegis-fg">
          {snap.id}
          {isFirst ? (
            <span className="ml-2 aegis-mono text-aegis-xs text-aegis-accent">ACTIVE</span>
          ) : null}
        </p>
        <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
          {compactInt(snap.row_count)} rows · {relativeTime(snap.created_at)}
          {snap.note ? ` · ${snap.note}` : ""}
        </p>
      </div>
      <span
        className={`inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[11px] tabular-nums ${tone}`}
      >
        psi · {snap.psi_vs_baseline.toFixed(2)}
      </span>
    </li>
  );
}
