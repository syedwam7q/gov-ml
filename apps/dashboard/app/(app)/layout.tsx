import type { ReactNode } from "react";

import { Banner, PowerIcon } from "@aegis/ui";

import { AppChromeShell } from "./_components/app-chrome-shell";

interface AppLayoutProps {
  readonly children: ReactNode;
}

/**
 * (app) route group — every authenticated route inherits this chrome:
 * the top nav (with command-palette + assistant triggers), the left
 * rail, and the global emergency-stop banner. Spec §10.2.
 *
 * The layout itself is a server component — it reads `EMERGENCY_STOP`
 * from the env (so a misconfigured deploy can't bypass it) and renders
 * a client-side `AppChromeShell` that owns pathname-aware highlight,
 * keyboard shortcuts, and dialog state.
 */
export default function AppLayout({ children }: AppLayoutProps): ReactNode {
  const emergencyStop = process.env.EMERGENCY_STOP === "true";

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
      <AppChromeShell>{children}</AppChromeShell>
    </div>
  );
}
