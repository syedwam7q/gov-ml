import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Aegis-aware Tailwind merger.
 *
 * Out of the box, `tailwind-merge` collapses every `text-*` class as if
 * it were a single group — so `cn("text-aegis-sm", "text-aegis-fg")`
 * would drop the font-size and keep only the color. We extend the
 * default groups so our custom Aegis token suffixes are recognised:
 *
 *   • `text-aegis-{xs|sm|base|md|lg|xl|2xl|3xl|4xl}` → `font-size`
 *   • `text-aegis-{fg|fg-2|fg-3|fg-disabled|accent|...}` → `text-color`
 *
 * Same logic applies to `bg-*`, `border-*`, `rounded-*`, etc., but the
 * conflicts we hit in practice live entirely on the `text-*` axis, so
 * we keep the override surface narrow.
 */
const AEGIS_FONT_SIZES = [
  "aegis-xs",
  "aegis-sm",
  "aegis-base",
  "aegis-md",
  "aegis-lg",
  "aegis-xl",
  "aegis-2xl",
  "aegis-3xl",
  "aegis-4xl",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": AEGIS_FONT_SIZES.map((token) => `text-${token}`),
    },
  },
});

/**
 * Composes class names with Tailwind-aware conflict resolution.
 * Used by every component in @aegis/ui.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
