import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface SkeletonProps {
  /** Tailwind size utilities — width / height. Defaults to a 1-line block. */
  readonly className?: string;
  /** Render as a circle (avatars). */
  readonly circle?: boolean;
}

/**
 * Skeleton — calm shimmer placeholder for SWR-loading regions. Uses a
 * subtle surface gradient sweep at 200% width so screens with a dark
 * surface still read it. No JS — pure CSS animation off the keyframe
 * utility in `tailwind.config.ts`.
 */
export function Skeleton({ className, circle = false }: SkeletonProps): ReactNode {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block bg-aegis-surface-2 animate-pulse",
        circle ? "rounded-full" : "rounded-aegis-control",
        className,
      )}
    />
  );
}

interface SkeletonRowProps {
  readonly count?: number;
  readonly className?: string;
}

/** Stack of N skeleton lines — used inside cards while data resolves. */
export function SkeletonRows({ count = 3, className }: SkeletonRowProps): ReactNode {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <Skeleton key={idx} className={cn("h-4", idx === count - 1 ? "w-1/2" : "w-full")} />
      ))}
    </div>
  );
}
