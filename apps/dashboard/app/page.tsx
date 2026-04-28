import Link from "next/link";

import { SeverityPill, StatePill } from "@aegis/ui";

/**
 * Temporary index page — Phase 4a placeholder.
 * Phase 4b will replace this with the auth-gated `/fleet` redirect.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-aegis-content flex-col gap-12 px-6 py-16">
      <header className="space-y-4">
        <span className="aegis-mono-label">Aegis · v0.1.0 · Phase 4a</span>
        <h1 className="text-aegis-3xl font-semibold tracking-aegis-tight">
          Autonomous Self-Healing Governance for ML Systems
        </h1>
        <p className="max-w-2xl text-aegis-md text-aegis-fg-2">
          Editorial Dark design system live. Token foundation, typography stack, and the first
          shared components are wired through <code className="aegis-mono">@aegis/ui</code>.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="aegis-mono-label">Phase 4a sanity check</h2>
        <div className="flex flex-wrap items-center gap-3">
          <SeverityPill severity="LOW">low</SeverityPill>
          <SeverityPill severity="MEDIUM">medium</SeverityPill>
          <SeverityPill severity="HIGH">high</SeverityPill>
          <SeverityPill severity="CRITICAL">critical</SeverityPill>
          <span className="text-aegis-fg-3">·</span>
          <StatePill state="detected" />
          <StatePill state="analyzed" />
          <StatePill state="planned" />
          <StatePill state="executing" />
          <StatePill state="evaluated" />
        </div>
        <Link
          href="/design"
          className="inline-flex items-center text-aegis-sm text-aegis-accent transition-colors hover:text-aegis-accent-strong"
        >
          → component playground
        </Link>
      </section>
    </main>
  );
}
