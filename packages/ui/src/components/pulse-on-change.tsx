"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * <PulseOnChange /> — wraps a child node and triggers a one-shot
 * `aegis-pulse-once` glow whenever `signal` changes value. Useful for
 * highlighting that a severity badge or KPI just got worse.
 *
 * Mount does NOT pulse — only subsequent changes. The pulse animation
 * lives in `apps/dashboard/app/globals.css` so all pages get the
 * Editorial Dark glow color without per-component knobs.
 */
export interface PulseOnChangeProps {
  /** Value whose change triggers the pulse — typically a severity level. */
  readonly signal: string | number | null | undefined;
  readonly children: ReactNode;
  readonly className?: string;
}

export function PulseOnChange({ signal, children, className }: PulseOnChangeProps): ReactNode {
  const [pulse, setPulse] = useState(false);
  const previous = useRef(signal);

  useEffect(() => {
    if (previous.current !== signal && previous.current !== undefined) {
      setPulse(false);
      const id = window.requestAnimationFrame(() => setPulse(true));
      const timeout = window.setTimeout(() => setPulse(false), 4500);
      previous.current = signal;
      return (): void => {
        window.cancelAnimationFrame(id);
        window.clearTimeout(timeout);
      };
    }
    previous.current = signal;
    return undefined;
  }, [signal]);

  return (
    <span className={cn("inline-block", pulse && "aegis-pulse-once", className)}>{children}</span>
  );
}
