import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/** The four severity levels in spec §10.3. */
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const SURFACE: Record<Severity, string> = {
  LOW: "bg-sev-low-soft text-sev-low border-sev-low/30",
  MEDIUM: "bg-sev-medium-soft text-sev-medium border-sev-medium/30",
  HIGH: "bg-sev-high-soft text-sev-high border-sev-high/30",
  CRITICAL: "bg-sev-critical-soft text-sev-critical border-sev-critical/40",
};

const LABEL: Record<Severity, string> = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

export interface SeverityPillProps {
  /** One of the four spec severities. */
  readonly severity: Severity;
  /** Optional override label — defaults to the severity name. */
  readonly children?: ReactNode;
  /** When true the CRITICAL pill gets a subtle red glow. Default: true. */
  readonly glow?: boolean;
  readonly className?: string;
}

/**
 * Severity Pill — the single canonical way to render a severity label
 * across the dashboard. Spec §10.4. Mono font, uppercase, tracking-mono.
 *
 * Usage: `<SeverityPill severity="HIGH" />`
 */
export function SeverityPill({
  severity,
  children,
  glow = true,
  className,
}: SeverityPillProps): ReactNode {
  const isCritical = severity === "CRITICAL";
  return (
    <span
      role="status"
      aria-label={`severity ${severity.toLowerCase()}`}
      data-severity={severity}
      className={cn(
        "inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none",
        SURFACE[severity],
        isCritical && glow && "shadow-[var(--aegis-glow-critical)]",
        className,
      )}
    >
      {children ?? LABEL[severity]}
    </span>
  );
}
