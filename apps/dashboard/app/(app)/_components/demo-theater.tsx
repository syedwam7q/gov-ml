"use client";

/**
 * <DemoTheater /> — full-screen "Replay Apple Card 2019" overlay.
 *
 * Subscribes to `/api/cp/stream` (the same SSE bus the activity feed
 * uses) and listens for `demo_*` events emitted by the control-plane's
 * `/api/cp/internal/demo/apple-card` endpoint. Each event maps to a
 * scene; scenes cross-fade as the choreography unfolds.
 *
 * The overlay is bespoke — it doesn't reuse the AssistantDrawer chrome
 * because the goal here is *theater*, not interaction. Judges watch
 * the MAPE-K loop play out as a 7.5-second narrative.
 *
 * Spec §11.3 (operator surface). Coupled to the control plane's
 * `routers/demo.py` choreography.
 */

import {
  HashBadge,
  KPITile,
  ParetoChart,
  type ParetoCandidate,
  SeverityPill,
  ShapleyWaterfall,
  type ShapleyContribution,
  SparkleIcon,
  CloseIcon,
} from "@aegis/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type SceneKind =
  | "demo_started"
  | "demo_drift_signal"
  | "demo_causal_attribution"
  | "demo_pareto_front"
  | "demo_action_executed"
  | "demo_audit_extended"
  | "demo_complete";

const SCENE_ORDER: readonly SceneKind[] = [
  "demo_started",
  "demo_drift_signal",
  "demo_causal_attribution",
  "demo_pareto_front",
  "demo_action_executed",
  "demo_audit_extended",
  "demo_complete",
];

const SCENE_LABEL: Record<SceneKind, string> = {
  demo_started: "Briefing",
  demo_drift_signal: "Detection",
  demo_causal_attribution: "Analysis",
  demo_pareto_front: "Planning",
  demo_action_executed: "Execution",
  demo_audit_extended: "Audit",
  demo_complete: "Outcome",
};

interface SSEFrame {
  readonly type: string;
  readonly data: Record<string, unknown>;
}

interface DemoTheaterProps {
  readonly open: boolean;
  readonly demoId: string | null;
  readonly onClose: () => void;
  readonly onComplete?: () => void;
}

function getNumber(payload: unknown, key: string): number | undefined {
  if (payload && typeof payload === "object" && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    return typeof v === "number" ? v : undefined;
  }
  return undefined;
}

function getString(payload: unknown, key: string): string | undefined {
  if (payload && typeof payload === "object" && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

type SubStatus = "idle" | "connecting" | "live" | "closed" | "errored";

export function DemoTheater({ open, demoId, onClose, onComplete }: DemoTheaterProps): ReactNode {
  const [scenes, setScenes] = useState<Record<string, SSEFrame>>({});
  const [activeScene, setActiveScene] = useState<SceneKind>("demo_started");
  const [subStatus, setSubStatus] = useState<SubStatus>("idle");
  const [eventCount, setEventCount] = useState(0);
  const [debugLog, setDebugLog] = useState<readonly string[]>([]);
  const completedRef = useRef(false);

  // Reset on open with a fresh demo_id.
  useEffect(() => {
    if (open && demoId) {
      setScenes({});
      setActiveScene("demo_started");
      setEventCount(0);
      setDebugLog([`open · demo_id=${demoId.slice(0, 8)}…`]);
      completedRef.current = false;
    }
  }, [open, demoId]);

  // ESC closes.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return (): void => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Subscribe to the SSE bus and capture demo_* events for our demo_id.
  // The `demoId` capture below must be stable for the lifetime of one
  // demo run — we read it from a ref so the closure inside onMessage
  // doesn't get a stale value if the component re-renders.
  const demoIdRef = useRef(demoId);
  useEffect(() => {
    demoIdRef.current = demoId;
  }, [demoId]);

  useEffect(() => {
    if (!open || !demoId) return undefined;
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return undefined;
    }
    setSubStatus("connecting");
    const src = new EventSource("/api/cp/stream");
    src.onopen = (): void => {
      setSubStatus("live");
      setDebugLog((p) => [...p, "sse: open"]);
    };
    src.onerror = (): void => {
      setSubStatus("errored");
      setDebugLog((p) => [...p, "sse: error"]);
    };
    function onMessage(ev: MessageEvent<string>): void {
      let frame: SSEFrame;
      try {
        frame = JSON.parse(ev.data) as SSEFrame;
      } catch {
        return;
      }
      if (!frame.type.startsWith("demo_")) return;
      const eventDemoId = getString(frame.data, "demo_id");
      if (eventDemoId !== demoIdRef.current) {
        setDebugLog((p) =>
          [
            ...p,
            `skip ${frame.type} · id=${(eventDemoId ?? "?").slice(0, 6)}≠${(demoIdRef.current ?? "?").slice(0, 6)}`,
          ].slice(-10),
        );
        return;
      }
      setEventCount((c) => c + 1);
      setDebugLog((p) => [...p, `recv ${frame.type}`].slice(-10));
      setScenes((prev) => ({ ...prev, [frame.type]: frame }));
      if (SCENE_ORDER.includes(frame.type as SceneKind)) {
        setActiveScene(frame.type as SceneKind);
      }
      if (frame.type === "demo_complete" && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }
    src.addEventListener("message", onMessage);
    return (): void => {
      src.removeEventListener("message", onMessage);
      src.close();
      setSubStatus("closed");
    };
  }, [open, demoId, onComplete]);

  const progressIndex = useMemo(() => SCENE_ORDER.indexOf(activeScene), [activeScene]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Apple Card 2019 demo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-aegis-bg/95 backdrop-blur-md"
    >
      <button
        type="button"
        aria-hidden
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div className="relative z-10 mx-4 flex h-[min(800px,92vh)] w-[min(1100px,95vw)] flex-col overflow-hidden rounded-aegis-card border border-aegis-stroke-strong bg-aegis-surface-overlay shadow-2xl">
        <DemoHeader
          onClose={onClose}
          activeScene={activeScene}
          subStatus={subStatus}
          eventCount={eventCount}
          debugLog={debugLog}
        />
        <DemoStage scenes={scenes} activeScene={activeScene} demoId={demoId} />
        <DemoProgressBar activeIndex={progressIndex} />
      </div>
    </div>
  );
}

function DemoHeader({
  onClose,
  activeScene,
  subStatus,
  eventCount,
  debugLog,
}: {
  readonly onClose: () => void;
  readonly activeScene: SceneKind;
  readonly subStatus: SubStatus;
  readonly eventCount: number;
  readonly debugLog: readonly string[];
}): ReactNode {
  const dotColor: Record<SubStatus, string> = {
    idle: "bg-aegis-fg-3",
    connecting: "bg-sev-medium animate-pulse",
    live: "bg-status-ok",
    closed: "bg-aegis-fg-3",
    errored: "bg-sev-high",
  };
  return (
    <header className="flex items-center justify-between border-b border-aegis-stroke px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="text-aegis-accent" aria-hidden>
          <SparkleIcon />
        </span>
        <div>
          <p className="text-aegis-base font-semibold text-aegis-fg">
            Apple Card 2019 — Live Replay
          </p>
          <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
            Stage · {SCENE_LABEL[activeScene]} · {eventCount}/7 events
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <details className="relative">
          <summary className="flex cursor-pointer items-center gap-2 rounded-aegis-control border border-aegis-stroke px-2 py-1 font-mono text-[10px] uppercase tracking-aegis-mono text-aegis-fg-2 hover:text-aegis-fg">
            <span aria-hidden className={`h-2 w-2 rounded-full ${dotColor[subStatus]}`} />
            sse · {subStatus}
          </summary>
          <div className="absolute right-0 mt-2 w-72 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-overlay-elevated p-3 shadow-2xl">
            <p className="aegis-mono-label mb-2">DEBUG · LAST 10 EVENTS</p>
            <ol className="space-y-1 font-mono text-[10px] text-aegis-fg-2">
              {debugLog.length === 0 ? (
                <li className="text-aegis-fg-3">no log yet</li>
              ) : (
                debugLog.map((line, idx) => <li key={idx}>{line}</li>)
              )}
            </ol>
          </div>
        </details>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close demo"
          className="rounded-aegis-control border border-aegis-stroke p-2 text-aegis-fg-2 transition-colors hover:bg-aegis-surface-2 hover:text-aegis-fg"
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  );
}

function DemoProgressBar({ activeIndex }: { readonly activeIndex: number }): ReactNode {
  return (
    <footer className="border-t border-aegis-stroke px-6 py-3">
      <div className="flex items-center gap-2">
        {SCENE_ORDER.map((scene, idx) => {
          const reached = idx <= activeIndex && activeIndex >= 0;
          const active = idx === activeIndex;
          return (
            <div key={scene} className="flex flex-1 items-center gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <p
                  className={`font-mono text-[10px] uppercase tracking-aegis-mono ${
                    active ? "text-aegis-accent" : reached ? "text-aegis-fg-2" : "text-aegis-fg-3"
                  }`}
                >
                  {SCENE_LABEL[scene]}
                </p>
                <div className="h-1 overflow-hidden rounded-full bg-aegis-stroke">
                  <div
                    className={`h-full transition-all duration-500 ease-out ${
                      reached ? "w-full bg-aegis-accent" : "w-0 bg-transparent"
                    } ${active ? "animate-pulse" : ""}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </footer>
  );
}

function DemoStage({
  scenes,
  activeScene,
  demoId,
}: {
  readonly scenes: Record<string, SSEFrame>;
  readonly activeScene: SceneKind;
  readonly demoId: string | null;
}): ReactNode {
  return (
    <main className="relative flex-1 overflow-y-auto p-8">
      {!demoId && (
        <div className="flex h-full items-center justify-center">
          <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
            Awaiting demo …
          </p>
        </div>
      )}
      {demoId && activeScene === "demo_started" && (
        <SceneStarted frame={scenes.demo_started ?? null} />
      )}
      {demoId && activeScene === "demo_drift_signal" && (
        <SceneDrift frame={scenes.demo_drift_signal ?? null} />
      )}
      {demoId && activeScene === "demo_causal_attribution" && (
        <SceneCausal frame={scenes.demo_causal_attribution ?? null} />
      )}
      {demoId && activeScene === "demo_pareto_front" && (
        <ScenePareto frame={scenes.demo_pareto_front ?? null} />
      )}
      {demoId && activeScene === "demo_action_executed" && (
        <SceneAction
          drift={scenes.demo_drift_signal ?? null}
          action={scenes.demo_action_executed ?? null}
        />
      )}
      {demoId && activeScene === "demo_audit_extended" && (
        <SceneAudit frame={scenes.demo_audit_extended ?? null} />
      )}
      {demoId && activeScene === "demo_complete" && (
        <SceneComplete frame={scenes.demo_complete ?? null} />
      )}
    </main>
  );
}

// ─── Scenes ───────────────────────────────────────────────────────────

function FadeIn({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className="aegis-fade-in flex h-full flex-col gap-6">{children}</div>;
}

function SceneStarted({ frame }: { readonly frame: SSEFrame | null }): ReactNode {
  const title = getString(frame?.data ?? {}, "title") ?? "Apple Card 2019 — fairness drift";
  const summary =
    getString(frame?.data ?? {}, "summary") ??
    "Replaying a textbook governance failure on credit-v1.";
  return (
    <FadeIn>
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-accent">
          MAPE-K Loop · Self-Healing Demo
        </p>
        <h2 className="text-3xl font-semibold leading-tight text-aegis-fg">{title}</h2>
        <p className="max-w-xl text-aegis-base text-aegis-fg-2">{summary}</p>
        <div className="mt-4 flex gap-2">
          {(["Detect", "Analyze", "Plan", "Execute", "Audit"] as const).map((stage) => (
            <span
              key={stage}
              className="rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-3 py-1 font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-2"
            >
              {stage}
            </span>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}

function SceneDrift({ frame }: { readonly frame: SSEFrame | null }): ReactNode {
  const drift = (frame?.data?.drift_signal ?? {}) as Record<string, unknown>;
  const value = getNumber(drift, "value") ?? 0.71;
  const baseline = getNumber(drift, "baseline") ?? 0.83;
  const floor = getNumber(drift, "floor") ?? 0.8;
  const psi = getNumber(drift, "psi") ?? 0.31;
  const metric = getString(drift, "metric") ?? "demographic_parity_gender";
  const severity =
    (getString(drift, "severity") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined) ?? "HIGH";
  return (
    <FadeIn>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-2xl font-semibold text-aegis-fg">Drift detected</h3>
        <SeverityPill severity={severity} />
      </div>
      <p className="text-aegis-base text-aegis-fg-2">
        <span className="font-mono text-aegis-fg-3">credit-v1</span> ·{" "}
        <span className="font-mono">{metric}</span> fell below the policy floor.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPITile
          label="Current"
          value={value.toFixed(2)}
          tone="danger"
          trend={`baseline ${baseline.toFixed(2)} · floor ${floor.toFixed(2)}`}
        />
        <KPITile
          label="PSI Drift"
          value={psi.toFixed(2)}
          tone="danger"
          trend="population stability index"
        />
        <KPITile label="Window" value="24h" trend="rolling observation window" />
      </div>
      <div className="mt-4 rounded-aegis-card border border-sev-high/30 bg-sev-high-soft/40 p-4">
        <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-sev-high">Trigger</p>
        <p className="mt-1 text-aegis-base text-aegis-fg-2">
          Aegis detector observed <span className="font-mono text-aegis-fg">{metric}</span> at{" "}
          <span className="font-mono text-aegis-fg">{value.toFixed(2)}</span>, below the{" "}
          {floor.toFixed(2)} floor encoded in the active policy. The MAPE-K loop has opened a
          decision and advanced to <span className="font-mono text-aegis-fg">analyzed</span>.
        </p>
      </div>
    </FadeIn>
  );
}

function SceneCausal({ frame }: { readonly frame: SSEFrame | null }): ReactNode {
  const attribution = (frame?.data?.causal_attribution ?? {}) as Record<string, unknown>;
  const method = getString(attribution, "method") ?? "dowhy_gcm";
  const recommended = getString(attribution, "recommended_action") ?? "REWEIGH";
  const rootCausesRaw = (attribution.root_causes ?? []) as Record<string, unknown>[];
  const contributions: ShapleyContribution[] = rootCausesRaw.map((rc) => {
    const hint = getString(rc, "narrative");
    return {
      feature: getString(rc, "node") ?? "?",
      value: getNumber(rc, "contribution") ?? 0,
      ...(hint !== undefined ? { hint } : {}),
    };
  });
  // Map to a 0.0 → 1.0 axis (contributions sum to ~1.0).
  return (
    <FadeIn>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-2xl font-semibold text-aegis-fg">Causal attribution</h3>
        <span className="rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-aegis-mono text-aegis-fg-2">
          {method}
        </span>
      </div>
      <p className="text-aegis-base text-aegis-fg-2">
        Shapley decomposition over the model's causal graph (Budhathoki et al., AISTATS 2021).
        Contributions sum to the observed metric shift.
      </p>
      <ShapleyWaterfall
        baseline={0}
        observed={1}
        metric="contribution share"
        contributions={contributions}
        formatValue={(n: number): string => `${(n * 100).toFixed(0)}%`}
      />
      <div className="mt-2 rounded-aegis-card border border-aegis-accent/30 bg-aegis-accent/10 p-4">
        <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-accent">
          Recommended action
        </p>
        <p className="mt-1 text-aegis-base text-aegis-fg">
          <span className="font-mono font-semibold">{recommended}</span> — mapped from the dominant
          cause via the cause→action table.
        </p>
      </div>
    </FadeIn>
  );
}

function ScenePareto({ frame }: { readonly frame: SSEFrame | null }): ReactNode {
  const plan = (frame?.data?.plan_evidence ?? {}) as Record<string, unknown>;
  const candidatesRaw = (plan.candidates ?? []) as Record<string, unknown>[];
  const candidates: ParetoCandidate[] = candidatesRaw.map((c, idx) => {
    const reward = (c.reward_vector as number[] | undefined) ?? [0, 0, 0, 0];
    const explanation = getString(c, "narrative");
    return {
      id: `cand-${idx}`,
      label: getString(c, "action") ?? `Candidate ${idx + 1}`,
      kind: getString(c, "action") ?? "?",
      // Map 4-dim reward to 3 visible axes — utility (Δ-fairness),
      // safety (1 − |approval-rate-delta|), cost (latency cost; clamped).
      utility: clamp01((reward[0] ?? 0) * 4),
      safety: clamp01(1 + (reward[3] ?? 0) * 0.5),
      cost: clamp01(1 + (reward[2] ?? 0) / 60),
      pareto: Boolean(c.on_pareto_front),
      selected: Boolean(c.selected),
      ...(explanation !== undefined ? { explanation } : {}),
    };
  });
  return (
    <FadeIn>
      <h3 className="text-2xl font-semibold text-aegis-fg">Pareto-optimal action selection</h3>
      <p className="text-aegis-base text-aegis-fg-2">
        CB-Knapsacks bandit (Slivkins-Sankararaman-Foster, JMLR 2024) — regret-bounded selection
        over a 4-dimensional reward space.
      </p>
      <ParetoChart
        candidates={candidates}
        caption="Pareto frontier highlighted; selected action carries the operator-approved badge."
      />
    </FadeIn>
  );
}

function SceneAction({
  drift,
  action,
}: {
  readonly drift: SSEFrame | null;
  readonly action: SSEFrame | null;
}): ReactNode {
  const driftPayload = (drift?.data?.drift_signal ?? {}) as Record<string, unknown>;
  const actionPayload = (action?.data?.action_result ?? {}) as Record<string, unknown>;
  const post = (actionPayload.post_mitigation ?? {}) as Record<string, unknown>;
  const before = getNumber(driftPayload, "value") ?? 0.71;
  const after = getNumber(post, "demographic_parity_gender") ?? 0.83;
  const floor = getNumber(driftPayload, "floor") ?? 0.8;
  const approvalDelta = getNumber(post, "approval_rate_delta") ?? -0.014;
  const latencyDelta = getNumber(post, "p95_latency_ms_delta") ?? 6.2;
  return (
    <FadeIn>
      <h3 className="text-2xl font-semibold text-aegis-fg">Action executed · REWEIGH</h3>
      <p className="text-aegis-base text-aegis-fg-2">
        Reweigh applied to the income-proxy feature. Fairness metric recomputed on the next batch.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPITile
          label="Before"
          value={before.toFixed(2)}
          tone="danger"
          trend={`below ${floor.toFixed(2)} floor`}
        />
        <KPITile
          label="After"
          value={after.toFixed(2)}
          tone="ok"
          trend={`+${(after - before).toFixed(2)} restored`}
        />
        <KPITile
          label="Cost"
          value={`Δ ${approvalDelta.toFixed(3)}`}
          tone="warning"
          unit="approval rate"
          trend={`+${latencyDelta.toFixed(1)}ms p95`}
        />
      </div>
      <BeforeAfterChart before={before} after={after} floor={floor} />
    </FadeIn>
  );
}

function BeforeAfterChart({
  before,
  after,
  floor,
}: {
  readonly before: number;
  readonly after: number;
  readonly floor: number;
}): ReactNode {
  const max = Math.max(before, after, floor) * 1.1;
  return (
    <div className="aegis-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
          Demographic parity · before vs. after
        </p>
        <p className="font-mono text-[11px] text-aegis-fg-3">policy floor · {floor.toFixed(2)}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-aegis-mono text-sev-high">
            Before
          </span>
          <div className="relative h-32 overflow-hidden rounded-aegis-control bg-aegis-surface-2">
            <div
              className="absolute bottom-0 left-0 right-0 bg-sev-high/70 transition-all duration-700 ease-out"
              style={{ height: `${(before / max) * 100}%` }}
            />
            <div
              aria-hidden
              className="absolute left-0 right-0 border-t border-dashed border-aegis-fg-3/40"
              style={{ bottom: `${(floor / max) * 100}%` }}
            />
          </div>
          <span className="font-mono text-base text-aegis-fg">{before.toFixed(2)}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-aegis-mono text-status-ok">
            After
          </span>
          <div className="relative h-32 overflow-hidden rounded-aegis-control bg-aegis-surface-2">
            <div
              className="absolute bottom-0 left-0 right-0 bg-status-ok/70 transition-all duration-700 ease-out"
              style={{ height: `${(after / max) * 100}%` }}
            />
            <div
              aria-hidden
              className="absolute left-0 right-0 border-t border-dashed border-aegis-fg-3/40"
              style={{ bottom: `${(floor / max) * 100}%` }}
            />
          </div>
          <span className="font-mono text-base text-aegis-fg">{after.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function SceneAudit({ frame }: { readonly frame: SSEFrame | null }): ReactNode {
  const chain = (frame?.data?.audit_chain ?? {}) as Record<string, unknown>;
  const rows = getNumber(chain, "rows_appended") ?? 6;
  const headHash = getString(chain, "head_hash") ?? "0x" + "a".repeat(8) + "..." + "b".repeat(4);
  const anchor = getString(chain, "anchor") ?? "github://syedwam7q/gov-ml";
  return (
    <FadeIn>
      <h3 className="text-2xl font-semibold text-aegis-fg">Audit chain extended</h3>
      <p className="text-aegis-base text-aegis-fg-2">
        Every state transition produces a Merkle-chained, HMAC-signed audit row. Daily snapshots are
        anchored to a public GitHub repository so tampering is externally detectable.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPITile label="Rows appended" value={rows} tone="ok" trend="this decision" />
        <KPITile label="Head hash" value={`${headHash.slice(0, 14)}…`} trend="latest row hash" />
        <KPITile label="Anchor" value="2026-04-29" trend="external GitHub commit" />
      </div>
      <div className="rounded-aegis-card border border-aegis-stroke bg-aegis-surface-2 p-4">
        <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
          Verifiable trail
        </p>
        <ol className="mt-2 space-y-2">
          {[
            "decision_open · t=0.0s",
            "state_transition · detected → analyzed",
            "state_transition · analyzed → planned",
            "state_transition · planned → awaiting_approval",
            "state_transition · awaiting_approval → executing",
            "state_transition · executing → evaluated",
          ].map((line, idx) => (
            <li
              key={line}
              className="flex items-center gap-3 font-mono text-[12px] text-aegis-fg-2"
            >
              <HashBadge value={longFakeHash(idx)} head={4} tail={4} />
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="font-mono text-[11px] text-aegis-fg-3">{anchor}</p>
    </FadeIn>
  );
}

function SceneComplete({ frame }: { readonly frame: SSEFrame | null }): ReactNode {
  const elapsed = getNumber(frame?.data ?? {}, "elapsed_s") ?? 7.5;
  return (
    <FadeIn>
      <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full border border-aegis-accent/40 bg-aegis-accent/10 text-aegis-accent">
          <SparkleIcon />
        </div>
        <h3 className="text-3xl font-semibold text-aegis-fg">
          Self-healed in {elapsed.toFixed(1)}s
        </h3>
        <p className="max-w-xl text-aegis-base text-aegis-fg-2">
          Drift detected, root cause attributed, Pareto-optimal action selected, applied, and
          audit-chained — without operator intervention. The full investigation is interrogable
          through the Governance Assistant.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-aegis-fg-2">
          <Stat label="Detect → Analyze" value="0.6 → 1.6s" />
          <Stat label="Plan" value="3.2s" />
          <Stat label="Execute" value="4.8s" />
          <Stat label="Audit" value="6.3s" />
        </div>
      </div>
    </FadeIn>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <span className="rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-aegis-mono">
      <span className="text-aegis-fg-3">{label}</span>
      <span className="ml-2 text-aegis-fg">{value}</span>
    </span>
  );
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function longFakeHash(seed: number): string {
  const palette = "0123456789abcdef";
  let out = "";
  let cursor = seed * 7919 + 13;
  for (let i = 0; i < 64; i++) {
    cursor = (cursor * 1664525 + 1013904223) >>> 0;
    out += palette[cursor % palette.length];
  }
  return out;
}
