import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { HashBadge, KPITile, SeverityPill, Sparkline, StatePill } from "@aegis/ui";

/**
 * Aegis component playground.
 *
 * A living style guide — every component in `@aegis/ui` rendered with the
 * design tokens applied. This route is internal-only (404s in production
 * via the guard below). Open it locally to verify components render
 * exactly as the spec mockups (§8) describe.
 */
export default function DesignPlayground() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-aegis-content flex-col gap-16 px-6 py-16">
      <header className="space-y-3">
        <span className="aegis-mono-label">Aegis · component playground</span>
        <h1 className="text-aegis-3xl font-semibold tracking-aegis-tight">Living style guide</h1>
        <p className="max-w-2xl text-aegis-md text-aegis-fg-2">
          Every shared component, with the Editorial Dark tokens applied. If any of these rendered
          wrong, every page in the app would inherit the bug — so we keep this page green.
        </p>
      </header>

      <Section
        label="01 · TYPOGRAPHY"
        title="Three-family stack: Inter / JetBrains Mono / Source Serif"
      >
        <div className="space-y-6 aegis-card p-6">
          <div>
            <p className="aegis-mono-label mb-2">display</p>
            <p className="text-aegis-3xl font-semibold tracking-aegis-tight">
              Aegis catches what the industry misses.
            </p>
          </div>
          <div>
            <p className="aegis-mono-label mb-2">body</p>
            <p className="text-aegis-base text-aegis-fg">
              Inter is our UI workhorse. We rely on its character variants for tabular numerals and
              the geometric letter-shapes that read clean at every weight.
            </p>
          </div>
          <div>
            <p className="aegis-mono-label mb-2">technical mono</p>
            <p className="aegis-mono text-aegis-sm">
              decision_id=00000000-0042 · DP_gender=0.71 · severity=HIGH · ts=12:03:00
            </p>
          </div>
          <div>
            <p className="aegis-mono-label mb-2">editorial serif (sparingly)</p>
            <p className="aegis-editorial text-aegis-lg italic text-aegis-fg-2">
              &ldquo;In every case, the failure was detectable. The system had no mechanism to
              detect it.&rdquo;
            </p>
          </div>
        </div>
      </Section>

      <Section label="02 · SURFACE STACK" title="Tokens compose. They do not collide.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { name: "surface-0", tone: "page bg", className: "bg-aegis-bg" },
            { name: "surface-1", tone: "cards", className: "bg-aegis-surface-1" },
            { name: "surface-2", tone: "nested", className: "bg-aegis-surface-2" },
            { name: "surface-3", tone: "modals", className: "bg-aegis-surface-3" },
          ].map((s) => (
            <div
              key={s.name}
              className={`${s.className} aegis-card flex h-28 flex-col justify-between p-4`}
            >
              <span className="aegis-mono-label">{s.name}</span>
              <span className="text-aegis-sm text-aegis-fg-2">{s.tone}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section label="03 · SEVERITY PILLS" title="Severity is a meaning, not a decoration.">
        <div className="aegis-card flex flex-wrap items-center gap-3 p-6">
          <SeverityPill severity="LOW">low</SeverityPill>
          <SeverityPill severity="MEDIUM">medium</SeverityPill>
          <SeverityPill severity="HIGH">high</SeverityPill>
          <SeverityPill severity="CRITICAL">critical</SeverityPill>
        </div>
      </Section>

      <Section label="04 · DECISION STATE PILLS" title="The 5 durable states + awaiting_approval.">
        <div className="aegis-card flex flex-wrap items-center gap-2 p-6">
          <StatePill state="detected" />
          <StatePill state="analyzed" />
          <StatePill state="planned" />
          <StatePill state="awaiting_approval" />
          <StatePill state="executing" />
          <StatePill state="evaluated" />
        </div>
      </Section>

      <Section label="05 · HASH BADGE" title="Truncated mono with hover-to-reveal full hash.">
        <div className="aegis-card flex flex-wrap items-center gap-3 p-6">
          <HashBadge value="3f9c4ef9b00fa6abef1c01ab12cd34ef" />
          <HashBadge value="d04e0a91a376c3eef00bb1100029ee5588" />
          <HashBadge value="aa01b772c0b1e8c024118a1a2b3c4d5e" />
        </div>
      </Section>

      <Section label="06 · KPI TILE" title="The fleet's headline numbers. Tabular, mono, calm.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPITile label="Models active" value={3} unit="/ 3" trend="all healthy" tone="ok" />
          <KPITile label="Predictions · 24h" value="128,402" trend="+4.2% wow" />
          <KPITile label="Open incidents" value={1} trend="credit-v1 · DP_gender" tone="warning" />
        </div>
      </Section>

      <Section label="07 · SPARKLINE" title="Single accent gradient. No chartjunk.">
        <div className="aegis-card flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <span className="aegis-mono-label">DP_gender · 24h</span>
            <p className="text-aegis-2xl font-semibold tracking-aegis-tight">0.71</p>
            <p className="aegis-mono text-aegis-xs text-aegis-fg-3">floor 0.80 · breach</p>
          </div>
          <Sparkline
            values={[
              0.93, 0.94, 0.94, 0.92, 0.95, 0.93, 0.94, 0.92, 0.91, 0.93, 0.94, 0.92, 0.93, 0.92,
              0.91, 0.9, 0.88, 0.85, 0.82, 0.78, 0.74, 0.71,
            ]}
            tone="severity-high"
            width={280}
            height={56}
            ariaLabel="DP_gender 24-hour trend"
          />
        </div>
      </Section>

      <Section
        label="08 · MOTION + FOCUS"
        title="Tab through. Confirm focus rings on every control."
      >
        <div className="aegis-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
          {(["fast", "base", "slow"] as const).map((speed) => (
            <button
              key={speed}
              type="button"
              className={`aegis-card text-aegis-sm font-medium px-4 py-3 transition-colors duration-aegis-${speed} ease-aegis hover:bg-aegis-surface-2 hover:border-aegis-stroke-strong`}
            >
              motion · {speed}
            </button>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Section({
  label,
  title,
  children,
}: {
  readonly label: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <span className="aegis-mono-label">{label}</span>
        <h2 className="text-aegis-xl font-semibold tracking-aegis-tight text-aegis-fg">{title}</h2>
      </header>
      {children}
    </section>
  );
}
