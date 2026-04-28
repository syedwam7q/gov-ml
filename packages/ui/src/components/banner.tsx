import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export type BannerTone = "info" | "warning" | "danger";

const SURFACE: Record<BannerTone, string> = {
  info: "border-aegis-accent/40 bg-aegis-accent-soft text-aegis-fg",
  warning: "border-sev-medium/40 bg-sev-medium-soft text-aegis-fg",
  danger: "border-sev-critical/50 bg-sev-critical-soft text-aegis-fg",
};

const ICON_COLOR: Record<BannerTone, string> = {
  info: "text-aegis-accent",
  warning: "text-sev-medium",
  danger: "text-sev-critical",
};

export interface BannerProps {
  /** Visual tone. `danger` is reserved for emergency-stop and outage-class events. */
  readonly tone?: BannerTone;
  /** Pictogram (use one of `./icons`). */
  readonly icon?: ReactNode;
  /** The headline label — short, mono, uppercase. */
  readonly label: string;
  /** Supporting message — sentence-case, regular weight. */
  readonly message: ReactNode;
  /** Optional action element rendered on the right (button or Link). */
  readonly action?: ReactNode;
  readonly className?: string;
}

/**
 * Banner — full-width persistent message above the chrome. Used for
 * EMERGENCY_STOP, ongoing incidents, and (occasionally) operator
 * announcements. Never used for transient toasts. Spec §10.2 / §10.4.
 */
export function Banner({
  tone = "info",
  icon,
  label,
  message,
  action,
  className,
}: BannerProps): ReactNode {
  return (
    <div
      role="status"
      data-tone={tone}
      className={cn(
        "flex items-center gap-3 border-b px-6 py-2.5 text-aegis-sm",
        SURFACE[tone],
        className,
      )}
    >
      {icon ? <span className={cn("shrink-0", ICON_COLOR[tone])}>{icon}</span> : null}
      <span
        className={cn("aegis-mono text-aegis-xs uppercase tracking-aegis-mono", ICON_COLOR[tone])}
      >
        {label}
      </span>
      <span className="text-aegis-fg-2">{message}</span>
      {action ? <span className="ml-auto">{action}</span> : null}
    </div>
  );
}
