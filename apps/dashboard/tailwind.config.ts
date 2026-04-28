import type { Config } from "tailwindcss";

/**
 * Aegis Tailwind config — every color/font/spacing token reads from CSS
 * custom properties defined in `packages/ui/src/styles/tokens.css`. This
 * keeps Tailwind classes useful without forking the design system.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "aegis-bg": "var(--aegis-surface-0)",
        "aegis-surface-1": "var(--aegis-surface-1)",
        "aegis-surface-2": "var(--aegis-surface-2)",
        "aegis-surface-3": "var(--aegis-surface-3)",
        "aegis-surface-overlay": "var(--aegis-surface-overlay)",
        "aegis-surface-overlay-elevated": "var(--aegis-surface-overlay-elevated)",
        "aegis-stroke": "var(--aegis-stroke)",
        "aegis-stroke-strong": "var(--aegis-stroke-strong)",
        "aegis-fg": "var(--aegis-fg-primary)",
        "aegis-fg-2": "var(--aegis-fg-secondary)",
        "aegis-fg-3": "var(--aegis-fg-tertiary)",
        "aegis-fg-disabled": "var(--aegis-fg-disabled)",
        "aegis-accent": "var(--aegis-accent)",
        "aegis-accent-soft": "var(--aegis-accent-soft)",
        "aegis-accent-strong": "var(--aegis-accent-strong)",
        "sev-low": "var(--aegis-severity-low)",
        "sev-medium": "var(--aegis-severity-medium)",
        "sev-high": "var(--aegis-severity-high)",
        "sev-critical": "var(--aegis-severity-critical)",
        "sev-low-soft": "var(--aegis-severity-low-soft)",
        "sev-medium-soft": "var(--aegis-severity-medium-soft)",
        "sev-high-soft": "var(--aegis-severity-high-soft)",
        "sev-critical-soft": "var(--aegis-severity-critical-soft)",
        "status-ok": "var(--aegis-status-ok)",
        "status-ok-soft": "var(--aegis-status-ok-soft)",
        "status-warning": "var(--aegis-status-warning)",
        "status-error": "var(--aegis-status-error)",
        "status-info": "var(--aegis-status-info)",
      },
      fontFamily: {
        sans: ["var(--aegis-font-sans)"],
        mono: ["var(--aegis-font-mono)"],
        serif: ["var(--aegis-font-serif)"],
      },
      fontSize: {
        "aegis-xs": "var(--aegis-fz-xs)",
        "aegis-sm": "var(--aegis-fz-sm)",
        "aegis-base": "var(--aegis-fz-base)",
        "aegis-md": "var(--aegis-fz-md)",
        "aegis-lg": "var(--aegis-fz-lg)",
        "aegis-xl": "var(--aegis-fz-xl)",
        "aegis-2xl": "var(--aegis-fz-2xl)",
        "aegis-3xl": "var(--aegis-fz-3xl)",
        "aegis-4xl": "var(--aegis-fz-4xl)",
      },
      letterSpacing: {
        "aegis-tight": "var(--aegis-tracking-tight)",
        "aegis-mono": "var(--aegis-tracking-mono)",
      },
      borderRadius: {
        "aegis-pill": "var(--aegis-radius-pill)",
        "aegis-card": "var(--aegis-radius-card)",
        "aegis-control": "var(--aegis-radius-control)",
      },
      transitionDuration: {
        "aegis-fast": "120ms",
        "aegis-base": "200ms",
        "aegis-slow": "360ms",
      },
      transitionTimingFunction: {
        aegis: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      maxWidth: {
        "aegis-content": "var(--aegis-content-max)",
      },
    },
  },
  plugins: [],
};

export default config;
