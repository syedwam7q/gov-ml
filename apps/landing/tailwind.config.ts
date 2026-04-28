import type { Config } from "tailwindcss";

/**
 * Aegis landing page Tailwind config — mirrors the dashboard config so
 * the Editorial Dark token system carries across both apps.
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
        "aegis-stroke": "var(--aegis-stroke)",
        "aegis-stroke-strong": "var(--aegis-stroke-strong)",
        "aegis-fg": "var(--aegis-fg-primary)",
        "aegis-fg-2": "var(--aegis-fg-secondary)",
        "aegis-fg-3": "var(--aegis-fg-tertiary)",
        "aegis-accent": "var(--aegis-accent)",
        "aegis-accent-soft": "var(--aegis-accent-soft)",
        "aegis-accent-strong": "var(--aegis-accent-strong)",
        "sev-low": "var(--aegis-severity-low)",
        "sev-medium": "var(--aegis-severity-medium)",
        "sev-high": "var(--aegis-severity-high)",
        "sev-critical": "var(--aegis-severity-critical)",
        "status-ok": "var(--aegis-status-ok)",
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
      maxWidth: {
        "aegis-content": "var(--aegis-content-max)",
      },
    },
  },
  plugins: [],
};

export default config;
