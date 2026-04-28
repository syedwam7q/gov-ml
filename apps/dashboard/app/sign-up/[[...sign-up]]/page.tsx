import { SignUp } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { Brand } from "@aegis/ui";

export default function SignUpPage(): ReactNode {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-aegis-bg px-6 py-16">
      <div className="flex flex-col items-center gap-2">
        <Brand />
        <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
          Request access
        </p>
      </div>
      <SignUp
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/fleet"
        signInForceRedirectUrl="/fleet"
      />
      <p className="font-mono text-[10px] text-aegis-fg-3">
        Aegis · autonomous self-healing ML governance
      </p>
    </main>
  );
}
