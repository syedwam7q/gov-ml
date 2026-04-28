# Aegis — Phase 4: Dashboard + Landing · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal.** Stand up the Aegis dashboard (`apps/dashboard`) and public landing page (`apps/landing`) — Editorial Dark aesthetic, Clerk OTP auth, the 14 dashboard routes from spec §10, real data from the Phase 2 control-plane REST + SSE + the Phase 3 detection signals. By the end of Phase 4 the **Apple-Card-2019 replay scenario is visibly walkable end-to-end on screen** — that demo is what the project ships on.

**Architecture.** Two Next.js 16 apps in `apps/dashboard` and `apps/landing`, both rendering server-first under the App Router. Shared design system in `packages/ui` (theme tokens + 22 reusable governance components). Server Components fetch from the control plane; Client Components subscribe to the SSE stream and render charts. Auth via Clerk middleware. Tailwind theme is fully token-driven so every color/font decision lives in one file (`packages/ui/src/styles/tokens.css`).

**Tech Stack.** Next.js 16 (App Router), TypeScript 5.6, Tailwind CSS 3.4 (or 4 if stable), shadcn/ui, Apache ECharts 6 (`echarts-for-react`), Server-Sent Events (native EventSource), Clerk, SWR for client-side data fetching, framer-motion for the landing page hero, Inter + JetBrains Mono + Source Serif 4 fonts via `next/font`.

**Spec reference.** `docs/superpowers/specs/2026-04-28-aegis-design.md` (sections 7, 8, 9, 10 — landing, dashboard, design system, components).

---

## Phase 4 sub-phases

Each sub-phase ends in working, testable software. **Do not skip ahead** — the dashboard's quality bar depends on every layer below it being perfect.

### Phase 4a — Design foundations _(this plan focuses here)_

The work that makes everything else look right.

1. `apps/dashboard` Next.js 16 scaffold — TypeScript, App Router, no-pages, strict tsconfig, `output: standalone` for Vercel.
2. Tailwind 3.4 + PostCSS configuration. **Tokens live in `packages/ui/src/styles/tokens.css`** — surfaces, strokes, accent, severities, status, motion. Tailwind reads them as CSS variables.
3. Typography via `next/font/google` — Inter (UI), JetBrains Mono (technical), Source Serif 4 (editorial-only). One font file per family, subset for performance.
4. Global CSS reset + base styles in `apps/dashboard/app/globals.css` (imports the token CSS).
5. shadcn/ui init — `components.json` configured, base button + dialog primitives generated.
6. First batch of reusable components in `packages/ui` — `SeverityPill`, `StatePill`, `HashBadge`, `KPITile`, `Sparkline`. Each is fully typed, theme-token-driven, has a Storybook story (or a component-playground page).
7. A `/_design` route in `apps/dashboard` rendering the component library as a living style-guide. Internal-only; route excluded from production builds.
8. CI runs `pnpm typecheck` + `pnpm lint` + `pnpm test` against the new app.

### Phase 4b — Auth + chrome

9. Clerk middleware at `apps/dashboard/middleware.ts` — protects all routes except `/login`, `/onboarding`, `/api/health`.
10. OTP-only authentication policy (Clerk dashboard config; no password sign-up in code).
11. 3-role RBAC (`viewer` / `operator` / `admin`) — public-metadata-driven. `<RoleGate role="admin">` component in `packages/ui`.
12. Top nav (route, breadcrumb, time-range selector, activity bell, user menu).
13. **Cmd+K Assistant Drawer** (Phase 8 wires the Groq backend; Phase 4b ships the drawer + command palette UI).
14. **Cmd+J Command Palette** (kbar-style fuzzy nav).
15. Global emergency-stop banner (when `EMERGENCY_STOP=true`).

### Phase 4c — Marketing landing

16. `apps/landing` Next.js 16 SSG (no client-side state; `output: export` for static generation).
17. The 9 landing sections from spec §9.1: hero with animated MAPE-K SVG, live mini-demo (Apple-Card replay scrubber), "the problem" with three real incidents, "the system," "architecture," "research extensions," "benchmark results," "compliance mapping," "CTA + footer."
18. framer-motion hero animation; ECharts mini-demo widget on the live mini-demo section.
19. Lighthouse 95+ on all four metrics (perf / a11y / SEO / best-practices).

### Phase 4d — Dashboard core

20. `/fleet` — fleet overview with three model cards. **Server-rendered** with data from the control plane; client-side SSE subscription for live activity feed.
21. `/models/[id]` — model detail with 10 tabs (Overview, Drift, Fairness, Calibration, Performance, Causal DAG, Audit, Versions, Datasets, Policies).
22. `/incidents` and `/incidents/[id]` — decisions list + the artifact-rich decision-detail page (timeline scrubber, Shapley waterfall, Pareto front, audit chain).
23. `/audit` — paginated audit log + verify-chain button.
24. **Apple-Card-2019 hero scenario** — seeded into Postgres at first run; the dashboard walks through it end-to-end so the demo always works regardless of live detection state.

### Phase 4e — Advanced pages + polish

25. `/policies` (Monaco YAML editor with policy DSL syntax highlighting).
26. `/datasets`, `/compliance`, `/chat` shell, `/settings`, `/approvals`.
27. Visual snapshot tests with Playwright + `@axe-core/playwright` for WCAG 2.1 AA.
28. Setup deploy to Vercel preview, verify SSR + edge runtime + cron compatibility.

### Phase 4f — Phase 4 wrap-up

29. setup.md "Dashboard" section — local run, Clerk signup walk-through, env vars.
30. Push, tag `phase-4-complete`, verify CI green.

---

## This plan executes Phase 4a only (design foundations)

The other sub-phases get their own plans once 4a lands and the design system is locked in.

## Self-review

**Spec coverage** (Phase 4a):

| Spec §                   | Requirement                                         | Task    |
| ------------------------ | --------------------------------------------------- | ------- |
| 10.3 (design tokens)     | Surface, stroke, accent, severities, status palette | 2       |
| 10.4 (component library) | First five components                               | 6       |
| 9.3 (Editorial Dark)     | Typography + color discipline                       | 2, 3, 4 |
| 8 (mockups)              | Visual direction                                    | 6, 7    |

**Placeholder scan.** Every task in 4a names exact files. Nothing is "TBD."

**Type consistency.** TypeScript types for `Severity`, `DecisionState`, `RiskClass`, `Role` come from `packages/shared-ts/src/index.ts` (auto-generated from `shared-py`). Components in `packages/ui` import them; no string-literal duplication.

**Scope check.** Phase 4a delivers a working living-style-guide page proving every design token + every shared component renders correctly. The actual `/fleet` arrives in 4d once the design system is locked.
