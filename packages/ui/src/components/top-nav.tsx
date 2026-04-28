import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { Brand } from "./brand";
import { BellIcon, ChevronRightIcon, ClockIcon, SearchIcon, SparkleIcon } from "./icons";
import { Kbd } from "./kbd";

/** A single segment of the breadcrumb trail. */
export interface BreadcrumbCrumb {
  readonly label: string;
  /** When set, render as a link; otherwise as plain text (the current page). */
  readonly href?: string;
}

export interface TopNavProps {
  /** Breadcrumb trail — first item is the section, last is the current page. */
  readonly crumbs?: readonly BreadcrumbCrumb[];
  /** Currently selected time-window (e.g. "24h"). Display only — wiring lives upstream. */
  readonly timeRange?: string;
  /** Open-the-time-range-picker handler. */
  readonly onOpenTimeRange?: () => void;
  /** Open-the-command-palette handler (Cmd+J also opens it via global listener). */
  readonly onOpenCommandPalette?: () => void;
  /** Open-the-assistant-drawer handler (Cmd+K). */
  readonly onOpenAssistant?: () => void;
  /** Number of unread activity items — `null` when feed is empty. */
  readonly unreadCount?: number | null;
  /** Avatar / user-menu element supplied by the host app. */
  readonly userMenu?: ReactNode;
  /** When `true`, the time-range and assistant buttons render disabled (e.g. during emergency stop). */
  readonly disabled?: boolean;
  readonly className?: string;
}

/**
 * TopNav — the persistent header strip above the dashboard.
 *
 * Hosts the brand, the breadcrumb trail, the time-range selector, the
 * command-palette opener, the assistant trigger, the activity bell, and
 * the user menu. Implementation is purely presentational — every action
 * is delegated to props so the component stays framework-agnostic and
 * tree-shake-friendly. Spec §10.2.
 *
 * The keyboard shortcuts are surfaced inline (`⌘J` / `⌘K`) so users
 * discover them without opening a help modal.
 */
export function TopNav({
  crumbs,
  timeRange,
  onOpenTimeRange,
  onOpenCommandPalette,
  onOpenAssistant,
  unreadCount,
  userMenu,
  disabled = false,
  className,
}: TopNavProps): ReactNode {
  return (
    <header
      role="banner"
      className={cn(
        "sticky top-0 z-30 flex h-[var(--aegis-nav-height)] items-center gap-4 border-b border-aegis-stroke bg-aegis-bg/85 px-6 backdrop-blur",
        className,
      )}
    >
      <Brand />

      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
          <span className="text-aegis-fg-3" aria-hidden>
            <ChevronRightIcon width={14} height={14} />
          </span>
          <ol className="flex min-w-0 items-center gap-1.5 text-aegis-sm">
            {crumbs.map((crumb, idx) => {
              const isLast = idx === crumbs.length - 1;
              return (
                <li key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5 truncate">
                  {crumb.href && !isLast ? (
                    <a
                      href={crumb.href}
                      className="text-aegis-fg-2 truncate hover:text-aegis-fg transition-colors"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span
                      className={cn("truncate", isLast ? "text-aegis-fg" : "text-aegis-fg-2")}
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast ? (
                    <span className="text-aegis-fg-3" aria-hidden>
                      <ChevronRightIcon width={12} height={12} />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <NavButton
          onClick={onOpenCommandPalette}
          disabled={disabled || !onOpenCommandPalette}
          aria-label="Open command palette"
          icon={<SearchIcon />}
        >
          <span className="text-aegis-fg-3">Search</span>
          <span className="ml-2 flex items-center gap-1 text-aegis-fg-3" aria-hidden>
            <Kbd>⌘</Kbd>
            <Kbd>J</Kbd>
          </span>
        </NavButton>

        {onOpenTimeRange ? (
          <NavButton
            onClick={onOpenTimeRange}
            disabled={disabled}
            aria-label="Change time range"
            icon={<ClockIcon />}
          >
            <span className="aegis-mono text-aegis-xs">{timeRange ?? "24h"}</span>
          </NavButton>
        ) : null}

        <NavIconButton
          onClick={onOpenAssistant}
          disabled={disabled || !onOpenAssistant}
          aria-label="Open assistant"
        >
          <SparkleIcon />
        </NavIconButton>

        <NavIconButton aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>
          <span className="relative inline-flex">
            <BellIcon />
            {unreadCount ? (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sev-high ring-2 ring-aegis-bg"
              />
            ) : null}
          </span>
        </NavIconButton>

        {userMenu ?? <div className="h-8 w-8 rounded-full bg-aegis-surface-2" aria-hidden />}
      </div>
    </header>
  );
}

interface NavButtonBaseProps {
  readonly onClick?: (() => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly icon?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string | undefined;
  readonly "aria-label"?: string | undefined;
}

function NavButton({
  onClick,
  disabled,
  icon,
  children,
  className,
  "aria-label": ariaLabel,
}: NavButtonBaseProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 px-3 text-aegis-sm text-aegis-fg-2",
        "transition-colors duration-aegis-fast ease-aegis hover:border-aegis-stroke-strong hover:text-aegis-fg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {icon ? <span className="text-aegis-fg-3">{icon}</span> : null}
      {children}
    </button>
  );
}

function NavIconButton({
  onClick,
  disabled,
  children,
  className,
  "aria-label": ariaLabel,
}: NavButtonBaseProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 text-aegis-fg-2",
        "transition-colors duration-aegis-fast ease-aegis hover:border-aegis-stroke-strong hover:text-aegis-fg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
