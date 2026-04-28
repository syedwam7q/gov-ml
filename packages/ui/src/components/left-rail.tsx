import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "../lib/cn";

export type RailRole = "viewer" | "operator" | "admin";

const ROLE_RANK: Record<RailRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

export interface RailItem {
  /** Stable key — used for React keys and active matching. */
  readonly key: string;
  /** Visible label. */
  readonly label: string;
  /** Route path — passed back to the host's link renderer. */
  readonly href: string;
  /** Pictogram from `./icons` (rendered at 18×18). */
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Minimum role required to see this entry. Defaults to "viewer". */
  readonly minRole?: RailRole;
  /** Optional badge shown to the right of the label (e.g. unread approvals). */
  readonly badge?: number | string;
}

export interface LeftRailProps {
  /** Ordered nav items. */
  readonly items: readonly RailItem[];
  /** The active item's key — drives the active-row highlight. */
  readonly activeKey?: string | undefined;
  /** Current viewer role. Items requiring a higher role are hidden. */
  readonly role?: RailRole | undefined;
  /**
   * Renders the actual link element. Lets the host inject a framework
   * link (Next's `<Link>`) without coupling `@aegis/ui` to a router.
   */
  readonly renderLink: (props: {
    readonly href: string;
    readonly className: string;
    readonly children: ReactNode;
    readonly ariaCurrent: boolean;
  }) => ReactNode;
  readonly className?: string;
}

/**
 * LeftRail — persistent navigation rail. 220px wide, surface-1 background,
 * accent strip on the active row. Items requiring a higher role than the
 * current user disappear from the list silently. Spec §10.1 / §10.2.
 *
 * The component never renders raw `<a>` tags — the host supplies its own
 * link renderer (`renderLink`) so the dashboard can use Next.js `<Link>`
 * with prefetching and the landing-page (when it exists) can use plain
 * anchors.
 */
export function LeftRail({
  items,
  activeKey,
  role = "viewer",
  renderLink,
  className,
}: LeftRailProps): ReactNode {
  const visible = items.filter((item) => ROLE_RANK[role] >= ROLE_RANK[item.minRole ?? "viewer"]);

  return (
    <aside
      aria-label="Primary"
      className={cn(
        "sticky top-[var(--aegis-nav-height)] hidden h-[calc(100dvh-var(--aegis-nav-height))] shrink-0 flex-col gap-1 border-r border-aegis-stroke bg-aegis-surface-1 px-3 py-4",
        "w-[var(--aegis-rail-width)] md:flex",
        className,
      )}
    >
      <p className="aegis-mono-label px-2 pb-2 pt-1">NAVIGATION</p>
      <nav className="flex flex-col gap-0.5">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = activeKey === item.key;
          return (
            <span key={item.key} className="block">
              {renderLink({
                href: item.href,
                ariaCurrent: active,
                className: cn(
                  "group flex items-center gap-3 rounded-aegis-control px-2.5 py-2 text-aegis-sm",
                  "transition-colors duration-aegis-fast ease-aegis",
                  active
                    ? "bg-aegis-accent-soft text-aegis-fg"
                    : "text-aegis-fg-2 hover:bg-aegis-surface-2 hover:text-aegis-fg",
                ),
                children: (
                  <>
                    <Icon
                      className={cn(
                        "shrink-0",
                        active
                          ? "text-aegis-accent"
                          : "text-aegis-fg-3 group-hover:text-aegis-fg-2",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined ? (
                      <span
                        className={cn(
                          "ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-aegis-pill px-1.5",
                          "font-mono text-[10px] font-medium tabular-nums",
                          active
                            ? "bg-aegis-accent text-aegis-bg"
                            : "bg-aegis-surface-3 text-aegis-fg-2",
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </>
                ),
              })}
            </span>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-aegis-stroke px-2 pt-3">
        <p className="aegis-mono-label">VERSION</p>
        <span className="aegis-mono text-[11px] text-aegis-fg-3">aegis · v0.1.0</span>
      </div>
    </aside>
  );
}
