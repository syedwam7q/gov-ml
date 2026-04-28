"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { HashBadge, PowerIcon, RoleGate, useRole } from "@aegis/ui";

interface SettingsViewProps {
  readonly emergencyStopActive: boolean;
}

const SECTIONS = [
  { key: "profile", label: "Profile" },
  { key: "notifications", label: "Notifications" },
  { key: "team", label: "Team" },
  { key: "tokens", label: "API tokens" },
  { key: "operations", label: "Operations" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export function SettingsView({ emergencyStopActive }: SettingsViewProps): ReactNode {
  const [active, setActive] = useState<SectionKey>("profile");

  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="aegis-mono-label">SETTINGS · WORKSPACE</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
          Settings
        </h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">
          Personal profile, notification routes, team membership, machine credentials, and the
          admin-tier emergency-stop control. Every change is recorded in the audit chain.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav role="tablist" aria-label="Settings sections" className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active === s.key}
              onClick={() => setActive(s.key)}
              className={`rounded-aegis-control px-3 py-2 text-left text-aegis-sm transition-colors duration-aegis-fast ${
                active === s.key
                  ? "bg-aegis-accent-soft text-aegis-fg"
                  : "text-aegis-fg-2 hover:bg-aegis-surface-2 hover:text-aegis-fg"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div role="tabpanel">
          {active === "profile" && <ProfileSection />}
          {active === "notifications" && <NotificationsSection />}
          {active === "team" && <TeamSection />}
          {active === "tokens" && <TokensSection />}
          {active === "operations" && (
            <OperationsSection emergencyStopActive={emergencyStopActive} />
          )}
        </div>
      </div>
    </section>
  );
}

function ProfileSection(): ReactNode {
  const role = useRole();
  return (
    <article className="aegis-card flex flex-col gap-5 p-6">
      <header className="flex items-baseline justify-between gap-3">
        <p className="aegis-mono-label">PROFILE</p>
        <span
          className={`inline-flex items-center rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-aegis-mono leading-none ${
            role === "admin"
              ? "border-sev-critical/40 bg-sev-critical-soft text-sev-critical"
              : role === "operator"
                ? "border-aegis-accent/40 bg-aegis-accent-soft text-aegis-accent"
                : "border-aegis-stroke text-aegis-fg-2"
          }`}
        >
          role · {role}
        </span>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Display name" defaultValue="Syed Wamiq" />
        <Field label="Email" defaultValue="sdirwamiq@aegis.dev" type="email" />
        <Field label="Default time zone" defaultValue="UTC" />
        <Field label="Default time range" defaultValue="24h" />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 px-3 text-aegis-sm text-aegis-fg-2 hover:border-aegis-stroke-strong"
        >
          discard
        </button>
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-aegis-control border border-aegis-accent/40 bg-aegis-accent-soft px-3 text-aegis-sm text-aegis-accent hover:border-aegis-accent"
        >
          save profile
        </button>
      </div>
    </article>
  );
}

function NotificationsSection(): ReactNode {
  return (
    <article className="aegis-card flex flex-col gap-5 p-6">
      <header className="flex items-baseline justify-between gap-3">
        <p className="aegis-mono-label">NOTIFICATIONS · DELIVERY ROUTES</p>
        <p className="aegis-mono text-aegis-xs text-aegis-fg-3">routed via /workflows</p>
      </header>
      <ul className="divide-y divide-aegis-stroke">
        <Toggle
          label="Email · CRITICAL severity"
          hint="Page on every CRITICAL incident — admin only"
          defaultOn
        />
        <Toggle
          label="Email · HIGH severity"
          hint="Daily digest by default; flip to per-event"
          defaultOn
        />
        <Toggle
          label="Slack · #aegis-incidents"
          hint="Mirror every signal_detected and approval_requested"
          defaultOn
        />
        <Toggle
          label="Slack · #aegis-decisions-evaluated"
          hint="Post the post-action evaluation summary"
        />
        <Toggle label="Webhook · ops.aegis.dev" hint="Forward audit events to the SIEM webhook" />
      </ul>
    </article>
  );
}

function TeamSection(): ReactNode {
  const members = [
    { email: "syed@aegis.dev", role: "admin", joined: "60d" },
    { email: "ana.salah@aegis.dev", role: "operator", joined: "32d" },
    { email: "james.wu@aegis.dev", role: "operator", joined: "18d" },
    { email: "auditor@cfpb.example", role: "viewer", joined: "5d" },
  ];
  return (
    <article className="aegis-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 border-b border-aegis-stroke px-6 py-4">
        <p className="aegis-mono-label">TEAM · {members.length} MEMBERS</p>
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-aegis-control border border-aegis-accent/40 bg-aegis-accent-soft px-3 text-aegis-sm text-aegis-accent hover:border-aegis-accent"
        >
          invite
        </button>
      </header>
      <table className="w-full">
        <thead>
          <tr className="text-aegis-fg-3 border-b border-aegis-stroke">
            <th className="aegis-mono-label py-3 px-6 text-left">EMAIL</th>
            <th className="aegis-mono-label py-3 px-2 text-left">ROLE</th>
            <th className="aegis-mono-label py-3 px-6 text-right">JOINED</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-aegis-stroke">
          {members.map((m) => (
            <tr key={m.email}>
              <td className="px-6 py-3 aegis-mono text-aegis-sm text-aegis-fg">{m.email}</td>
              <td className="px-2 py-3">
                <span className="aegis-mono text-aegis-xs uppercase tracking-aegis-mono text-aegis-fg-2">
                  {m.role}
                </span>
              </td>
              <td className="px-6 py-3 text-right aegis-mono text-aegis-xs text-aegis-fg-3">
                {m.joined} ago
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function TokensSection(): ReactNode {
  return (
    <article className="aegis-card flex flex-col gap-5 p-6">
      <header className="flex items-baseline justify-between gap-3">
        <p className="aegis-mono-label">API TOKENS · MACHINE CREDENTIALS</p>
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-aegis-control border border-aegis-accent/40 bg-aegis-accent-soft px-3 text-aegis-sm text-aegis-accent hover:border-aegis-accent"
        >
          mint token
        </button>
      </header>
      <ul className="space-y-3">
        <TokenRow
          label="ci · Tinybird ingest"
          token="aks_live_3f9c4ef9b00fa6abef1c01ab12cd34ef9b00fa6a"
          lastSeen="3m ago"
          scope="ingest:write · audit:read"
        />
        <TokenRow
          label="cron · detect-fanout"
          token="aks_live_8b1f2a3c45e6d7891022aabbccddeeff8b1f2a3c"
          lastSeen="42m ago"
          scope="signals:write · decisions:read"
        />
        <TokenRow
          label="dashboard · ssr"
          token="aks_live_c2d3e4f5a6b71829304050607080a0b0c2d3e4f5"
          lastSeen="just now"
          scope="cp:read"
        />
      </ul>
      <p className="aegis-mono text-aegis-xs text-aegis-fg-3 leading-aegis-snug">
        Tokens are HMAC-signed and scoped per service. Rotation is automatic on the 90th day —
        rotate manually now if a token is suspected leaked.
      </p>
    </article>
  );
}

function OperationsSection({
  emergencyStopActive,
}: {
  readonly emergencyStopActive: boolean;
}): ReactNode {
  return (
    <article className="flex flex-col gap-5">
      <RoleGate
        minRole="admin"
        fallback={
          <div className="aegis-card flex flex-col items-center gap-2 px-6 py-10 text-center">
            <p className="aegis-mono-label">ADMIN ONLY</p>
            <p className="text-aegis-sm text-aegis-fg-3">
              Operational controls — including emergency stop — are limited to admin role. Ask an
              admin or escalate via /approvals if you need a temporary policy override.
            </p>
          </div>
        }
      >
        <article
          className={`aegis-card flex flex-col gap-4 p-6 ${
            emergencyStopActive ? "border-sev-critical/40" : ""
          }`}
        >
          <header className="flex items-start gap-4">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-aegis-control border ${
                emergencyStopActive
                  ? "border-sev-critical/50 bg-sev-critical-soft text-sev-critical"
                  : "border-aegis-stroke text-aegis-fg-2"
              }`}
            >
              <PowerIcon />
            </span>
            <div className="space-y-1">
              <p className="aegis-mono-label">EMERGENCY STOP</p>
              <p className="text-aegis-base font-semibold text-aegis-fg">
                {emergencyStopActive ? "Active · all auto-actions paused" : "Standby"}
              </p>
              <p className="text-aegis-sm text-aegis-fg-2 leading-aegis-snug max-w-2xl">
                When active, the executor refuses every plan until an admin clears the stop. The
                dashboard shows a full-width red banner across every page. Toggle this only when
                there's a confirmed runaway action.
              </p>
            </div>
          </header>
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-aegis-stroke pt-4">
            <p className="aegis-mono text-aegis-xs text-aegis-fg-3 mr-auto">
              env · EMERGENCY_STOP={emergencyStopActive ? "true" : "false"}
            </p>
            <button
              type="button"
              disabled
              className={`inline-flex h-9 items-center rounded-aegis-control border px-4 text-aegis-sm font-medium transition-colors duration-aegis-fast ${
                emergencyStopActive
                  ? "border-status-ok/40 bg-status-ok-soft text-status-ok hover:border-status-ok"
                  : "border-sev-critical/40 bg-sev-critical-soft text-sev-critical hover:border-sev-critical"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Wired to the control plane in Phase 5"
            >
              {emergencyStopActive ? "clear emergency stop" : "engage emergency stop"}
            </button>
          </footer>
        </article>

        <article className="aegis-card flex flex-col gap-3 p-6">
          <p className="aegis-mono-label">DATA RETENTION</p>
          <ul className="space-y-2 text-aegis-sm text-aegis-fg-2 leading-aegis-snug">
            <li>· Audit log · permanent (immutable, Merkle-chained)</li>
            <li>· Drift snapshots · 13-month rolling window</li>
            <li>· Decision payloads · 24-month rolling window</li>
            <li>· PII · never — stored hashed at the control-plane boundary</li>
          </ul>
        </article>
      </RoleGate>
    </article>
  );
}

interface FieldProps {
  readonly label: string;
  readonly defaultValue?: string;
  readonly type?: string;
}

function Field({ label, defaultValue, type = "text" }: FieldProps): ReactNode {
  return (
    <label className="space-y-1.5 block">
      <span className="aegis-mono-label">{label.toUpperCase()}</span>
      <input
        type={type}
        defaultValue={defaultValue}
        className="block w-full rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-3 py-2 text-aegis-sm text-aegis-fg placeholder:text-aegis-fg-3 focus:border-aegis-accent focus:outline-none"
      />
    </label>
  );
}

interface ToggleProps {
  readonly label: string;
  readonly hint: string;
  readonly defaultOn?: boolean;
}

function Toggle({ label, hint, defaultOn = false }: ToggleProps): ReactNode {
  const [on, setOn] = useState(defaultOn);
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <p className="text-aegis-sm font-medium text-aegis-fg">{label}</p>
        <p className="aegis-mono text-aegis-xs text-aegis-fg-3 leading-tight">{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        aria-label={`${label} · ${on ? "on" : "off"}`}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-aegis-fast ${
          on ? "bg-aegis-accent" : "bg-aegis-surface-3"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-aegis-bg transition-transform duration-aegis-fast ${
            on ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </li>
  );
}

interface TokenRowProps {
  readonly label: string;
  readonly token: string;
  readonly lastSeen: string;
  readonly scope: string;
}

function TokenRow({ label, token, lastSeen, scope }: TokenRowProps): ReactNode {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-1 px-4 py-3">
      <div className="space-y-1">
        <p className="text-aegis-sm font-medium text-aegis-fg">{label}</p>
        <p className="aegis-mono text-aegis-xs text-aegis-fg-3">
          {scope} · last seen {lastSeen}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <HashBadge value={token} head={6} tail={6} />
        <button
          type="button"
          className="aegis-mono text-aegis-xs text-aegis-fg-3 hover:text-sev-high"
        >
          revoke
        </button>
      </div>
    </li>
  );
}
