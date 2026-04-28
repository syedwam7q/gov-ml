import type { ReactNode } from "react";

import { Banner, ClockIcon, PowerIcon } from "@aegis/ui";

import { checkReachability } from "../_lib/reachability";
import { AppChromeShell } from "./_components/app-chrome-shell";

interface AppLayoutProps {
  readonly children: ReactNode;
}

/**
 * (app) route group — every authenticated route inherits this chrome:
 * the top nav (with command-palette + assistant triggers), the left
 * rail, the global emergency-stop banner, and (Phase 5) the degraded-
 * mode banner that appears when the FastAPI control plane is unreachable.
 * Spec §10.2.
 *
 * The layout is a server component so the reachability probe runs
 * server-side once per RSC render and the banner is visible on first
 * paint — no client-side flicker.
 */
export default async function AppLayout({ children }: AppLayoutProps): Promise<ReactNode> {
  const emergencyStop = process.env.EMERGENCY_STOP === "true";
  const reachability = await checkReachability();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-aegis-bg">
      {emergencyStop ? (
        <Banner
          tone="danger"
          icon={<PowerIcon />}
          label="EMERGENCY STOP ACTIVE"
          message="All automated remediations are paused. Operators must manually approve every plan until an admin clears the stop."
        />
      ) : null}
      {!reachability.reachable ? (
        <Banner
          tone="info"
          icon={<ClockIcon />}
          label="DEMO MODE · CONTROL PLANE UNREACHABLE"
          message="Live data is offline — the dashboard is rendering against the seeded Apple-Card-2019 hero scenario. Boot the FastAPI control plane (see setup.md §Phase 5) to switch to live data."
        />
      ) : null}
      <AppChromeShell>{children}</AppChromeShell>
    </div>
  );
}
