import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface KbdProps {
  /** The key text — e.g. "K", "⌘", "Esc". */
  readonly children: ReactNode;
  /** Slightly bigger surface — used in the command palette UI. */
  readonly size?: "sm" | "md";
  readonly className?: string;
}

/**
 * Kbd — keyboard shortcut chip in JetBrains Mono. Used in the command
 * palette, assistant drawer, and tooltips that announce shortcuts.
 * Spec §10.2.
 */
export function Kbd({ children, size = "sm", className }: KbdProps): ReactNode {
  return (
    <kbd
      className={cn(
        "inline-flex select-none items-center justify-center rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2",
        "font-mono text-aegis-fg-2 leading-none",
        size === "sm"
          ? "min-w-[1.5rem] h-[1.5rem] px-1.5 text-[10.5px]"
          : "min-w-[1.75rem] h-[1.75rem] px-2 text-[11.5px]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
