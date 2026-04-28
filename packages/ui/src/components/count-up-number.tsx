"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * <CountUpNumber /> — ticks a number up from `from` to `to` over
 * `durationMs`, using `requestAnimationFrame`. Honours
 * `prefers-reduced-motion`: in that mode the final value renders
 * immediately, no animation.
 *
 * Used on the Fleet overview KPI tiles so the page feels alive on
 * first paint without us pulling in framer-motion.
 */
export interface CountUpNumberProps {
  readonly to: number;
  readonly from?: number;
  readonly durationMs?: number;
  readonly format?: (n: number) => string;
  readonly className?: string;
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

export function CountUpNumber({
  to,
  from = 0,
  durationMs = 700,
  format,
  className,
}: CountUpNumberProps): ReactNode {
  const [value, setValue] = useState<number>(from);
  const fromRef = useRef(from);

  useEffect(() => {
    if (typeof window === "undefined") {
      setValue(to);
      return undefined;
    }
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || durationMs <= 0) {
      setValue(to);
      return undefined;
    }
    const start = performance.now();
    const startValue = fromRef.current;
    let raf = 0;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(t);
      setValue(startValue + (to - startValue) * eased);
      if (t < 1) raf = window.requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = window.requestAnimationFrame(tick);
    return (): void => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [to, durationMs]);

  const formatter =
    format ?? ((n: number): string => (Number.isInteger(to) ? `${Math.round(n)}` : n.toFixed(2)));
  return (
    <span className={className} aria-label={String(to)}>
      {formatter(value)}
    </span>
  );
}
