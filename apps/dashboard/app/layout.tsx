import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

/**
 * Inter — UI sans (body, headings, every label that isn't mono).
 * `--font-inter` is the CSS variable consumed by `--aegis-font-sans`
 * in `packages/ui/src/styles/tokens.css`.
 *
 * `display: "swap"` + `adjustFontFallback` keeps the page legible even
 * when the Google CDN fetch is slow — the system fallback paints first,
 * then the woff2 swaps in once it arrives.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  adjustFontFallback: true,
});

/**
 * JetBrains Mono — every technical label, hash, severity pill, timestamp,
 * latency number, signal code. The defining marker of Aegis.
 */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  fallback: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
});

/**
 * Source Serif 4 — used only on the landing page pull-quotes and
 * paper-style content. Never inside the governance dashboard itself.
 */
const serif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "600"],
  fallback: ["Charter", "Georgia", "serif"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: "Aegis — Autonomous Self-Healing Governance for ML Systems",
    template: "%s · Aegis",
  },
  description:
    "Aegis monitors ML systems for drift, fairness regressions, and compliance violations, then proposes and executes remediations through a human-in-the-loop governance pipeline.",
  metadataBase: new URL("https://aegis-governance.dev"),
  openGraph: {
    title: "Aegis — Autonomous Self-Healing Governance for ML Systems",
    description:
      "Continuous, auditable, autonomous governance for production ML — credit, content moderation, and clinical risk.",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  // ClerkProvider wraps the whole app so <SignedIn />, <SignedOut />,
  // <UserButton />, and the auth-aware proxy.ts middleware all share
  // the same client. Editorial Dark theme variables make the
  // SignIn / SignUp / UserButton popovers read like the rest of the
  // dashboard rather than a default Clerk modal.
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#7fb4ff",
          colorBackground: "#14141a",
          colorInputBackground: "#1c1c24",
          colorInputText: "#e8e8ec",
          colorText: "#e8e8ec",
          colorTextSecondary: "#a1a1a8",
          colorNeutral: "#a1a1a8",
          colorDanger: "#f87171",
          borderRadius: "8px",
          fontFamily: "var(--aegis-font-sans)",
        },
        elements: {
          card: "bg-aegis-surface-overlay border border-aegis-stroke-strong",
          formButtonPrimary: "bg-aegis-accent hover:bg-aegis-accent-strong text-aegis-bg",
        },
      }}
    >
      <html
        lang="en"
        data-theme="dark"
        className={`${inter.variable} ${mono.variable} ${serif.variable}`}
        suppressHydrationWarning
      >
        <body className="min-h-[100dvh] bg-aegis-bg text-aegis-fg antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
