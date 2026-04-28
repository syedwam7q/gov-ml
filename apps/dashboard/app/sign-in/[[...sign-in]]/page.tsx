import { SignIn } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { Brand } from "@aegis/ui";

/**
 * Aegis sign-in page — Clerk's hosted SignIn component centered on the
 * Editorial Dark surface, with the brand mark above for context.
 */
export default function SignInPage(): ReactNode {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-aegis-bg px-6 py-16">
      <div className="flex flex-col items-center gap-2">
        <Brand />
        <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
          Sign in to the dashboard
        </p>
      </div>
      <SignIn
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/fleet"
        signUpForceRedirectUrl="/fleet"
      />
      <p className="font-mono text-[10px] text-aegis-fg-3">
        Aegis · autonomous self-healing ML governance
      </p>
    </main>
  );
}
