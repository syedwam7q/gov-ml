import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { ChevronRightIcon } from "./icons";
import { type Severity, SeverityPill } from "./severity-pill";
import { Sparkline, type SparklineTone } from "./sparkline";

export type ModelCardSeverity = Severity | "OK";

export interface ModelCardKPI {
  /** Mono uppercase label — "PREDICTIONS · 24h" */
  readonly label: string;
  /** Pre-formatted value — "128,402" / "38ms" / "+4.2%" */
  readonly value: string;
  /** Optional descriptor — fades into fg-3 next to the value. */
  readonly hint?: string;
}

export interface ModelCardProps {
  /** Stable id used as the React key when many cards render. */
  readonly modelId: string;
  /** Display name — "Credit Approval". */
  readonly name: string;
  /** Active version string — "1.4.2". */
  readonly version: string;
  /** Per-model risk classification — drives the right-side risk chip. */
  readonly riskClass: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Plain-language one-liner for the card body. */
  readonly description: string;
  /** Aggregate severity. "OK" renders as a calm green status chip. */
  readonly severity: ModelCardSeverity;
  /** Open-incident count. Drives the warning chip when > 0. */
  readonly openIncidents: number;
  /**
   * The card's hero metric — typically the model's defining fairness or
   * performance score (DP_gender, F1, AUC) with its policy floor and a
   * 24h trend.
   */
  readonly headline: {
    readonly key: string;
    readonly value: string;
    readonly floor: string;
    readonly status: "ok" | "warning" | "danger";
    readonly trend: readonly number[];
  };
  /** Bottom strip — three secondary KPIs (predictions, p95 latency, error). */
  readonly kpis: readonly [ModelCardKPI, ModelCardKPI, ModelCardKPI];
  /** Renders the trailing call-to-action area as a link. */
  readonly renderAction: (props: {
    readonly className: string;
    readonly children: ReactNode;
  }) => ReactNode;
  readonly className?: string;
}

const HEADLINE_TONE: Record<"ok" | "warning" | "danger", SparklineTone> = {
  ok: "status-ok",
  warning: "severity-medium",
  danger: "severity-high",
};

const HEADLINE_TEXT: Record<"ok" | "warning" | "danger", string> = {
  ok: "text-status-ok",
  warning: "text-sev-medium",
  danger: "text-sev-high",
};

const RISK_TONE: Record<ModelCardProps["riskClass"], string> = {
  LOW: "border-aegis-stroke text-aegis-fg-2",
  MEDIUM: "border-sev-medium/30 text-sev-medium",
  HIGH: "border-sev-high/30 text-sev-high",
  CRITICAL: "border-sev-critical/40 text-sev-critical",
};

/**
 * ModelCard — the canonical fleet-overview surface. Renders a model's
 * identity, severity status, hero metric (with sparkline), and three
 * secondary KPIs. Spec §10.4. Used on the /fleet page and as the rail
 * across /models[id] tabs.
 *
 * The `renderAction` prop is delegated so the host frame (Next/Link or
 * plain anchor) wires up the routing without coupling `@aegis/ui` to a
 * router.
 */
export function ModelCard({
  modelId,
  name,
  version,
  riskClass,
  description,
  severity,
  openIncidents,
  headline,
  kpis,
  renderAction,
  className,
}: ModelCardProps): ReactNode {
  return (
    <article
      data-model-id={modelId}
      data-severity={severity}
      className={cn(
        "aegis-card flex flex-col gap-5 p-6 transition-colors duration-aegis-base ease-aegis",
        "hover:border-aegis-stroke-strong",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <p className="aegis-mono-label">MODEL · {modelId}</p>
          <h3 className="text-aegis-lg font-semibold tracking-aegis-tight text-aegis-fg">{name}</h3>
          <p className="text-aegis-sm text-aegis-fg-2 line-clamp-2">{description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={cn(
              "inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none",
              RISK_TONE[riskClass],
            )}
          >
            {riskClass} risk
          </span>
          <span className="aegis-mono text-aegis-xs text-aegis-fg-3">v{version}</span>
        </div>
      </header>

      <section className="flex items-end justify-between gap-6 border-t border-aegis-stroke pt-5">
        <div className="space-y-1">
          <p className="aegis-mono-label">{headline.key.toUpperCase()} · 24H</p>
          <p
            className={cn(
              "text-aegis-2xl font-semibold tracking-aegis-tight tabular-nums",
              HEADLINE_TEXT[headline.status],
            )}
          >
            {headline.value}
          </p>
          <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
            floor {headline.floor} ·{" "}
            <span className={HEADLINE_TEXT[headline.status]}>
              {headline.status === "ok"
                ? "passing"
                : headline.status === "warning"
                  ? "watch"
                  : "breach"}
            </span>
          </p>
        </div>
        <Sparkline
          values={headline.trend}
          tone={HEADLINE_TONE[headline.status]}
          width={200}
          height={56}
          ariaLabel={`${headline.key} 24h trend`}
        />
      </section>

      <section className="grid grid-cols-3 gap-4 border-t border-aegis-stroke pt-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="space-y-1">
            <p className="aegis-mono-label">{kpi.label}</p>
            <p className="text-aegis-md font-semibold tabular-nums text-aegis-fg">{kpi.value}</p>
            {kpi.hint ? (
              <p className="aegis-mono text-aegis-xs text-aegis-fg-3">{kpi.hint}</p>
            ) : null}
          </div>
        ))}
      </section>

      <footer className="flex items-center justify-between border-t border-aegis-stroke pt-4">
        <div className="flex items-center gap-2">
          {severity === "OK" ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-aegis-control border border-status-ok/30 bg-status-ok-soft px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none text-status-ok"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-status-ok" />
              all clear
            </span>
          ) : (
            <SeverityPill severity={severity} />
          )}
          {openIncidents > 0 ? (
            <span className="aegis-mono text-aegis-xs text-aegis-fg-2">
              {openIncidents} open incident{openIncidents === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        {renderAction({
          className:
            "group inline-flex items-center gap-1 text-aegis-sm text-aegis-accent transition-colors duration-aegis-fast hover:text-aegis-accent-strong",
          children: (
            <>
              <span>open</span>
              <ChevronRightIcon
                width={14}
                height={14}
                className="transition-transform duration-aegis-fast group-hover:translate-x-0.5"
              />
            </>
          ),
        })}
      </footer>
    </article>
  );
}
