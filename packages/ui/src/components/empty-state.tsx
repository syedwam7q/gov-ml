import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface EmptyStateProps {
  /** Two-line label — "No incidents · 24h" style. */
  readonly title: string;
  /** Optional supporting copy explaining what this view shows. */
  readonly description?: string;
  /** Optional pictogram (an icon from `./icons`). Renders 32×32 + faded. */
  readonly icon?: ReactNode;
  /** Optional CTA — typically a `<Link>` or `<button>`. */
  readonly action?: ReactNode;
  readonly className?: string;
}

/**
 * EmptyState — the canonical "no rows yet" surface used by every list.
 * Spec §10.4. Calm, never alarmed; tertiary text on a card surface.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps): ReactNode {
  return (
    <div
      role="status"
      className={cn(
        "aegis-card flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex h-9 w-9 items-center justify-center rounded-aegis-control border border-aegis-stroke text-aegis-fg-3">
          {icon}
        </div>
      ) : null}
      <p className="aegis-mono-label">{title}</p>
      {description ? <p className="max-w-sm text-aegis-sm text-aegis-fg-3">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
