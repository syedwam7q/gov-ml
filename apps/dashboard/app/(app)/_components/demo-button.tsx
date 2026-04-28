"use client";

/**
 * <DemoButton /> — kicks off the Apple Card 2019 demo.
 *
 * Posts to `/api/cp/internal/demo/apple-card`, captures the returned
 * `demo_id`, and opens `<DemoTheater />` which subscribes to the SSE
 * bus for the choreographed `demo_*` events. The button's visual
 * style matches the Editorial Dark CTA pattern — accent border with
 * a subtle gradient sweep on hover.
 */

import { SparkleIcon } from "@aegis/ui";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { DemoTheater } from "./demo-theater";

interface DemoResponse {
  readonly demo_id: string;
}

export function DemoButton(): ReactNode {
  const [demoId, setDemoId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onClick = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const res = await fetch("/api/cp/internal/demo/apple-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          // Open the theater with no demo_id so the user sees a clear
          // "awaiting demo" state and can close — better than failing silently.
          setDemoId(null);
          setOpen(true);
          return;
        }
        const body = (await res.json()) as DemoResponse;
        setDemoId(body.demo_id);
        setOpen(true);
      } finally {
        setBusy(false);
      }
    })();
  }, [busy]);

  const onClose = useCallback((): void => {
    setOpen(false);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-label="Replay Apple Card 2019 — live MAPE-K demo"
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-aegis-control border border-aegis-accent/40 bg-aegis-accent/10 px-4 py-2 text-aegis-fg transition-all hover:border-aegis-accent hover:bg-aegis-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-aegis-accent/20 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full"
        />
        <span className="relative text-aegis-accent" aria-hidden>
          <SparkleIcon />
        </span>
        <span className="relative flex flex-col items-start gap-0.5 leading-none">
          <span className="font-mono text-[10px] uppercase tracking-aegis-mono text-aegis-accent">
            Live Demo
          </span>
          <span className="text-aegis-base font-semibold">
            {busy ? "Starting…" : "Replay Apple Card 2019"}
          </span>
        </span>
      </button>
      <DemoTheater open={open} demoId={demoId} onClose={onClose} />
    </>
  );
}
