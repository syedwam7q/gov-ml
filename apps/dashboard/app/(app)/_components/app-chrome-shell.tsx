"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { LeftRail, RoleProvider, TopNav, type RailRole } from "@aegis/ui";

import { ROUTES, activeRouteKey, routeLabel } from "../../_lib/routes";
import { CommandPalette } from "./command-palette";
import { AssistantDrawer } from "./assistant-drawer";

interface AppChromeShellProps {
  readonly children: ReactNode;
  /** Resolved viewer role; defaults to `admin` when no auth is configured. */
  readonly role?: RailRole;
}

/**
 * AppChromeShell — the client-side shell that owns:
 *
 *   • pathname-aware active-route highlight on the LeftRail
 *   • breadcrumb derivation for the TopNav
 *   • global Cmd+J / Cmd+K keyboard listeners
 *   • dialog state for the CommandPalette and AssistantDrawer
 *
 * Server data fetching stays in the (app) layout and individual pages —
 * this component is pure interaction + composition.
 */
export function AppChromeShell({ children, role = "admin" }: AppChromeShellProps): ReactNode {
  const pathname = usePathname() ?? "/fleet";
  const activeKey = activeRouteKey(pathname);
  const currentLabel = activeKey ? routeLabel(activeKey) : undefined;

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const openAssistant = useCallback(() => setAssistantOpen(true), []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;
      const key = event.key.toLowerCase();
      if (key === "j") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (key === "k") {
        event.preventDefault();
        setAssistantOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const crumbs = currentLabel
    ? [{ label: "Aegis", href: "/fleet" }, { label: currentLabel }]
    : [{ label: "Aegis", href: "/fleet" }];

  return (
    <RoleProvider value={role}>
      <TopNav
        crumbs={crumbs}
        timeRange="24h"
        onOpenCommandPalette={openPalette}
        onOpenAssistant={openAssistant}
        unreadCount={null}
      />
      <div className="flex flex-1">
        <LeftRail
          items={ROUTES}
          activeKey={activeKey}
          role={role}
          renderLink={({ href, className, children: linkContent, ariaCurrent }) => (
            <Link
              href={href}
              aria-current={ariaCurrent ? "page" : undefined}
              className={className}
              prefetch={false}
            >
              {linkContent}
            </Link>
          )}
        />
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <AssistantDrawer open={assistantOpen} onClose={closeAssistant} />
    </RoleProvider>
  );
}
