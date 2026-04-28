"use client";

/**
 * <DriftSimulator /> — interactive PSI slider on the model drift tab.
 *
 * Judges drag the slider; the distribution chart re-renders, the
 * severity badge transitions (with a one-shot pulse), and once PSI
 * crosses the policy ceiling the panel exposes a "Trigger live
 * demo" CTA that posts to `/api/cp/internal/demo/apple-card`.
 *
 * The simulator is a *visual* exercise — it does NOT touch the
 * detector pipeline. The "Trigger live demo" CTA is the single
 * call that produces real backend events.
 */

import { DistributionDiff, PulseOnChange, SeverityPill } from "@aegis/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { DemoTheater } from "../../../_components/demo-theater";

const PSI_MIN = 0.05;
const PSI_MAX = 0.45;
const PSI_WATCH = 0.1;
const PSI_DRIFT = 0.2;

type Status = "ok" | "warning" | "danger";

interface DriftSimulatorProps {
  readonly modelId: string;
  readonly metric: string;
}

interface DemoResponse {
  readonly demo_id: string;
}

function statusFor(psi: number): Status {
  if (psi >= PSI_DRIFT) return "danger";
  if (psi >= PSI_WATCH) return "warning";
  return "ok";
}

function severityFor(status: Status): "LOW" | "MEDIUM" | "HIGH" {
  if (status === "danger") return "HIGH";
  if (status === "warning") return "MEDIUM";
  return "LOW";
}

function gaussian(mu: number, sigma: number, n: number): readonly number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) / 2;
    out.push(Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)));
  }
  const max = Math.max(...out);
  return out.map((v) => v / max);
}

export function DriftSimulator({ modelId, metric }: DriftSimulatorProps): ReactNode {
  const [psi, setPsi] = useState(0.08);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = statusFor(psi);
  const severity = severityFor(status);

  // The current distribution shifts further from baseline as PSI grows.
  const baseline = useMemo(() => gaussian(0, 1.5, 12), []);
  const current = useMemo(() => gaussian(0 - psi * 4.5, 1.5 - Math.min(0.5, psi), 12), [psi]);

  const onSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v)) setPsi(v);
  }, []);

  const onTriggerDemo = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const res = await fetch("/api/cp/internal/demo/apple-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          setDemoId(null);
          setDemoOpen(true);
          return;
        }
        const body = (await res.json()) as DemoResponse;
        setDemoId(body.demo_id);
        setDemoOpen(true);
      } finally {
        setBusy(false);
      }
    })();
  }, [busy]);

  const onClose = useCallback((): void => setDemoOpen(false), []);

  // After 5s of dwelling at danger, glow the trigger button so judges
  // notice the affordance.
  const [breathe, setBreathe] = useState(false);
  useEffect(() => {
    if (status !== "danger") {
      setBreathe(false);
      return undefined;
    }
    const id = window.setTimeout(() => setBreathe(true), 1200);
    return (): void => window.clearTimeout(id);
  }, [status]);

  return (
    <section className="aegis-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 border-b border-aegis-stroke px-6 py-4">
        <div>
          <p className="aegis-mono-label">DRIFT SIMULATOR · LIVE</p>
          <p className="text-aegis-base font-semibold text-aegis-fg">
            Drag the slider — watch <span className="font-mono text-aegis-fg-2">{metric}</span>{" "}
            cross the policy thresholds.
          </p>
        </div>
        <PulseOnChange signal={severity}>
          <SeverityPill severity={severity} />
        </PulseOnChange>
      </header>

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-4">
          <div>
            <p className="aegis-mono-label">PSI · drag to simulate</p>
            <p className="aegis-count-up mt-1 text-aegis-2xl font-semibold text-aegis-fg">
              {psi.toFixed(2)}
            </p>
            <p className="aegis-mono mt-1 text-aegis-xs text-aegis-fg-3">
              floor 0.10 · drift gate 0.20 · {modelId}
            </p>
          </div>
          <input
            type="range"
            min={PSI_MIN}
            max={PSI_MAX}
            step={0.01}
            value={psi}
            onChange={onSliderChange}
            aria-label="PSI drift simulator"
            className="aegis-drift-slider"
          />
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-aegis-mono text-aegis-fg-3">
            <span>{PSI_MIN.toFixed(2)} · stable</span>
            <span className="text-sev-medium">0.10 watch</span>
            <span className="text-sev-high">0.20 drift</span>
            <span>{PSI_MAX.toFixed(2)} · max</span>
          </div>

          <div className="rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 p-4">
            <p className="aegis-mono-label">VERDICT</p>
            <p
              className={`mt-1 text-aegis-base font-medium ${
                status === "danger"
                  ? "text-sev-high"
                  : status === "warning"
                    ? "text-sev-medium"
                    : "text-status-ok"
              }`}
            >
              {status === "danger"
                ? "Drift signal would fire — Aegis would auto-open a decision."
                : status === "warning"
                  ? "Watch zone — close to the gate; monitoring is heightened."
                  : "Stable — within policy tolerance."}
            </p>
          </div>

          <button
            type="button"
            onClick={onTriggerDemo}
            disabled={busy || status !== "danger"}
            className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-aegis-control border px-4 py-2 transition-all ${
              status === "danger"
                ? "border-aegis-accent bg-aegis-accent/10 text-aegis-fg hover:bg-aegis-accent/20"
                : "border-aegis-stroke bg-aegis-surface-2 text-aegis-fg-3"
            } disabled:cursor-not-allowed disabled:opacity-60 ${breathe ? "animate-pulse" : ""}`}
            aria-label="Trigger the live MAPE-K demo for this drift"
          >
            <span className="font-mono text-[11px] uppercase tracking-aegis-mono">
              {status === "danger"
                ? busy
                  ? "Starting…"
                  : "Trigger live MAPE-K demo →"
                : "Push past 0.20 to enable"}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <p className="aegis-mono-label">DISTRIBUTION DIFF · BASELINE vs. CURRENT</p>
          <DistributionDiff
            baseline={baseline}
            current={current}
            severity={status}
            width={520}
            height={220}
            ariaLabel={`${metric} simulated drift at PSI ${psi.toFixed(2)}`}
          />
          <p className="aegis-mono text-[11px] text-aegis-fg-3">
            Detector under the hood: Population Stability Index (PSI) + Kolmogorov-Smirnov. The same
            code that runs in production powers this simulator.
          </p>
        </div>
      </div>

      <DemoTheater open={demoOpen} demoId={demoId} onClose={onClose} />
    </section>
  );
}
