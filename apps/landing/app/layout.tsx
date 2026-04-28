import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Aegis — Autonomous Self-Healing ML Governance",
  description:
    "Aegis monitors three production ML models for drift, fairness, and policy violations under a MAPE-K control loop. Detect, attribute, plan, execute, audit — autonomously, with grounded transparency.",
  keywords: [
    "ML governance",
    "fairness",
    "drift detection",
    "causal attribution",
    "MAPE-K",
    "EU AI Act",
    "Aegis",
  ],
  authors: [{ name: "Syed Wamiq", url: "https://github.com/syedwam7q" }],
  openGraph: {
    title: "Aegis — Autonomous Self-Healing ML Governance",
    description:
      "Detect, attribute, plan, execute, audit — autonomously, with grounded transparency.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis — Autonomous Self-Healing ML Governance",
  },
};

export default function RootLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
