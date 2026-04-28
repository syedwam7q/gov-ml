"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import { cn } from "../lib/cn";

export interface HashBadgeProps {
  /** Full hash. The badge truncates by default; hover/click reveals it. */
  readonly value: string;
  /** Number of leading characters to show (default 4). */
  readonly head?: number;
  /** Number of trailing characters to show (default 4). */
  readonly tail?: number;
  readonly className?: string;
}

/**
 * Hash badge — truncated monospace with click-to-copy + hover-to-reveal.
 * Used everywhere the audit log surfaces a `row_hash` or `prev_hash`.
 * Spec §10.4.
 */
export function HashBadge({ value, head = 4, tail = 4, className }: HashBadgeProps): ReactNode {
  const truncated =
    value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;

  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    if (typeof navigator === "undefined") return;
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {
        // Clipboard blocked — leave the user a hash to copy by hand via the title attribute.
      });
  }, [value]);

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "copied" : `copy hash ${value}`}
      title={value}
      className={cn(
        "inline-flex items-center rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2",
        "px-2 py-0.5 font-mono text-[11px] tracking-wider text-aegis-fg-2",
        "transition-colors duration-aegis-fast ease-aegis",
        "hover:bg-aegis-surface-3 hover:text-aegis-fg",
        copied && "border-status-ok/50 text-status-ok",
        className,
      )}
    >
      {copied ? "copied ✓" : truncated}
    </button>
  );
}
