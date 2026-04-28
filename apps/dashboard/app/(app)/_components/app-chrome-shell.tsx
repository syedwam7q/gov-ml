"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
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
      <a
        href="#aegis-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-aegis-control focus:border focus:border-aegis-accent focus:bg-aegis-surface-2 focus:px-3 focus:py-1.5 focus:text-aegis-sm focus:text-aegis-fg"
      >
        skip to content
      </a>
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
        <main id="aegis-main" className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <AssistantDrawer open={assistantOpen} onClose={closeAssistant} />

      {/* Floating UserButton in the top-right. Clerk's component renders
          its own avatar + dropdown — we just position it; the
          ClerkProvider in app/layout.tsx supplies the Editorial Dark
          theming so the popover doesn't read like a default Clerk modal. */}
      <div className="pointer-events-none fixed right-5 top-3 z-30 flex items-center gap-2">
        <SignedIn>
          <span className="pointer-events-auto">
            <UserButton afterSignOutUrl="/sign-in" />
          </span>
        </SignedIn>
        <SignedOut>
          <Link
            href="/sign-in"
            className="pointer-events-auto rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-2 hover:text-aegis-fg"
          >
            sign in
          </Link>
        </SignedOut>
      </div>
    </RoleProvider>
  );
}
