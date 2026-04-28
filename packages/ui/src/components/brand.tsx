import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface BrandProps {
  /** Compact (mark only) or full (mark + wordmark). Default: full. */
  readonly variant?: "full" | "mark";
  /** Tailwind size override. Defaults to text-aegis-base. */
  readonly className?: string;
}

/**
 * Aegis brand — a minimalist shield mark + wordmark in Inter Semibold,
 * letter-spacing tight. The shield is a chevron-derived geometric form
 * that nods to the mythological aegis (Athena's protective shield) without
 * tipping into ornament. Spec §9.4.
 *
 * Used in the top nav, the auth screens, and the landing page hero.
 */
export function Brand({ variant = "full", className }: BrandProps): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-aegis-base font-semibold tracking-aegis-tight text-aegis-fg",
        className,
      )}
      aria-label="Aegis"
    >
      <BrandMark className="text-aegis-accent" />
      {variant === "full" ? <span className="leading-none">Aegis</span> : null}
    </span>
  );
}

interface BrandMarkProps {
  readonly className?: string;
}

/**
 * Just the shield glyph. 18×18 default; size with Tailwind w-/h- if needed.
 * Stroke uses currentColor — wrap in any text-color utility to tint.
 */
export function BrandMark({ className }: BrandMarkProps): ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M12 2 4 6v6c0 4.5 3.4 8.4 8 10 4.6-1.6 8-5.5 8-10V6l-8-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2.2 2.2L15 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
