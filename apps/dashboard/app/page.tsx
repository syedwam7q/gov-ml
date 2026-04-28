import type { ReactNode } from "react";

import { Brand, BrandMark, SparkleIcon } from "@aegis/ui";

/**
 * The Aegis landing page.
 *
 * Single scrolling page, server-rendered, Editorial Dark. CSS-only
 * animations (no framer-motion dependency) so the bundle stays light
 * and prefers-reduced-motion users get a static surface.
 *
 * Section inventory:
 *
 *   1. Hero            — tagline + animated MAPE-K ring + dual CTAs
 *   2. Problem         — three real industry incidents with numbers
 *   3. Loop            — the five MAPE-K stages explained
 *   4. Research        — two novel contributions, papers cited
 *   5. Models          — three production models monitored
 *   6. Stack           — the platform's free-tier infrastructure
 *   7. Compliance      — regulatory frameworks Aegis maps to
 *   8. CTA             — open dashboard / replay demo / read paper
 *   9. Footer          — author + repo + license
 */
export default function LandingPage(): ReactNode {
  return (
    <main className="relative min-h-screen overflow-hidden bg-aegis-bg text-aegis-fg">
      <BackgroundGrid />
      <NavBar />
      <Hero />
      <Problem />
      <Loop />
      <Research />
      <Models />
      <Stack />
      <Compliance />
      <CTA />
      <Footer />
    </main>
  );
}

// ─── Decorative background ────────────────────────────────────────────

function BackgroundGrid(): ReactNode {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.18]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 30% 20%, rgba(127,180,255,0.18) 0%, transparent 45%), " +
          "radial-gradient(circle at 70% 80%, rgba(127,180,255,0.10) 0%, transparent 40%)",
      }}
    />
  );
}

// ─── Navigation ───────────────────────────────────────────────────────

function NavBar(): ReactNode {
  return (
    <nav className="relative z-10 border-b border-aegis-stroke">
      <div className="mx-auto flex max-w-aegis-content items-center justify-between px-6 py-5">
        <Brand />
        <div className="flex items-center gap-6 font-mono text-[12px] uppercase tracking-aegis-mono text-aegis-fg-2">
          <a href="#problem" className="hover:text-aegis-fg">
            Problem
          </a>
          <a href="#loop" className="hover:text-aegis-fg">
            Loop
          </a>
          <a href="#research" className="hover:text-aegis-fg">
            Research
          </a>
          <a href="#stack" className="hover:text-aegis-fg">
            Stack
          </a>
          <a
            href="/fleet"
            className="rounded-aegis-control border border-aegis-accent/40 bg-aegis-accent/10 px-3 py-1.5 text-aegis-accent transition-colors hover:bg-aegis-accent/20"
          >
            Open dashboard →
          </a>
        </div>
      </div>
    </nav>
  );
}

// ─── 1. Hero ──────────────────────────────────────────────────────────

function Hero(): ReactNode {
  return (
    <section className="relative z-10 mx-auto flex max-w-aegis-content flex-col items-center gap-10 px-6 pt-20 pb-24 lg:flex-row lg:gap-16 lg:pt-32 lg:pb-40">
      <div className="aegis-fade-in-up flex flex-1 flex-col gap-6">
        <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-accent">
          Aegis · Final-year research project · 2026
        </p>
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-aegis-tight text-aegis-fg md:text-6xl lg:text-7xl">
          Governance that{" "}
          <span className="bg-gradient-to-br from-aegis-accent to-aegis-accent-strong bg-clip-text text-transparent">
            self-heals
          </span>{" "}
          your ML.
        </h1>
        <p className="max-w-2xl text-aegis-md text-aegis-fg-2 leading-relaxed">
          Three production models, watched continuously for drift, fairness, calibration, and policy
          drift. When something breaks, Aegis attributes the cause, picks the Pareto-optimal
          remediation, executes it, and writes a Merkle-chained audit trail — all in seconds, all
          verifiable, all without a human in the loop unless one wants in.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <a
            href="/fleet"
            className="aegis-cta group inline-flex items-center gap-2 rounded-aegis-control px-5 py-3 text-aegis-base font-semibold text-aegis-bg shadow-lg transition-transform hover:scale-[1.02]"
          >
            <SparkleIcon />
            Try the live demo
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
          <a
            href="https://github.com/syedwam7q/gov-ml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-aegis-control border border-aegis-stroke-strong bg-aegis-surface-2 px-5 py-3 text-aegis-base text-aegis-fg-2 transition-colors hover:bg-aegis-surface-3 hover:text-aegis-fg"
          >
            View on GitHub
            <span aria-hidden>↗</span>
          </a>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
          <span>282 tests · 0 type errors</span>
          <span aria-hidden className="text-aegis-fg-disabled">
            ·
          </span>
          <span>EU AI Act ready</span>
          <span aria-hidden className="text-aegis-fg-disabled">
            ·
          </span>
          <span>Free-tier deployment</span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <MapeRing />
      </div>
    </section>
  );
}

// Animated MAPE-K ring — five labelled stages around a slowly orbiting
// accent dot. Pure SVG + CSS, ~3KB rendered.
function MapeRing(): ReactNode {
  const stages = ["Detect", "Analyze", "Plan", "Execute", "Evaluate"] as const;
  const radius = 130;
  const center = 170;
  return (
    <div className="aegis-drift relative h-[340px] w-[340px]">
      <svg
        viewBox="0 0 340 340"
        className="h-full w-full"
        role="img"
        aria-label="MAPE-K control loop diagram"
      >
        <defs>
          <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--aegis-accent)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--aegis-accent-strong)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="1"
        />
        <circle
          cx={center}
          cy={center}
          r={radius - 16}
          fill="none"
          stroke="var(--aegis-stroke)"
          strokeDasharray="2 6"
          strokeWidth="1"
        />
        <g className="aegis-orbit" style={{ transformOrigin: `${center}px ${center}px` }}>
          <circle
            cx={center + radius}
            cy={center}
            r="6"
            fill="var(--aegis-accent)"
            opacity="0.95"
          />
          <circle
            cx={center + radius}
            cy={center}
            r="14"
            fill="var(--aegis-accent)"
            opacity="0.18"
          />
        </g>
        {stages.map((stage, idx) => {
          const angle = (idx * 360) / stages.length - 90;
          const rad = (angle * Math.PI) / 180;
          const x = center + Math.cos(rad) * (radius + 26);
          const y = center + Math.sin(rad) * (radius + 26);
          return (
            <text
              key={stage}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="var(--aegis-font-mono)"
              fontSize="11"
              fill="var(--aegis-fg-secondary)"
              letterSpacing="0.08em"
            >
              {stage.toUpperCase()}
            </text>
          );
        })}
        <text
          x={center}
          y={center - 10}
          textAnchor="middle"
          fontFamily="var(--aegis-font-sans)"
          fontSize="14"
          fontWeight="600"
          fill="var(--aegis-fg-primary)"
        >
          MAPE-K
        </text>
        <text
          x={center}
          y={center + 12}
          textAnchor="middle"
          fontFamily="var(--aegis-font-mono)"
          fontSize="10"
          fill="var(--aegis-fg-tertiary)"
          letterSpacing="0.1em"
        >
          KNOWLEDGE
        </text>
      </svg>
    </div>
  );
}

// ─── 2. Problem ───────────────────────────────────────────────────────

function Problem(): ReactNode {
  const incidents = [
    {
      year: "2019",
      title: "Apple Card · Goldman Sachs",
      stat: "20×",
      caption: "credit-limit disparity by gender on joint-filing applicants",
      detail:
        "NYDFS investigation 2021. Root cause: features acting as proxies for income, whose joint distribution had shifted vs. the policy reference window. The model never knew gender — but its drift did.",
    },
    {
      year: "2024",
      title: "ZDNet automated denial",
      stat: "75%",
      caption: "denials reversed on appeal in a state-pension automated review",
      detail:
        "Operators couldn't trace why specific applicants were denied because the underlying model offered no causal explanation. Aegis exists because operators need the WHY, not just the WHAT.",
    },
    {
      year: "Daily",
      title: "Silent drift, everywhere",
      stat: "0.31",
      caption: "PSI on credit-v1 income proxy this morning · floor 0.20",
      detail:
        "By the time a fairness regression shows up in headline accuracy, hundreds of decisions have been made on the drifted distribution. The MAPE-K loop catches the drift before it touches a single applicant.",
    },
  ];
  return (
    <section
      id="problem"
      className="relative z-10 mx-auto max-w-aegis-content border-t border-aegis-stroke px-6 py-24 lg:py-32"
    >
      <div className="mb-14 max-w-3xl">
        <p className="aegis-mono-label">The problem</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-aegis-tight text-aegis-fg md:text-5xl">
          ML in production fails in ways audits can't catch.
        </h2>
        <p className="mt-5 text-aegis-md text-aegis-fg-2 leading-relaxed">
          Traditional MLOps tells you the model's accuracy. It doesn't tell you why a fairness
          signal flipped at 02:30, which feature drifted, what the right remediation is, or which
          operator to ask. Three industry failures show what that gap costs.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {incidents.map((i) => (
          <article
            key={i.year}
            className="aegis-card flex flex-col gap-4 p-6 transition-colors hover:border-aegis-stroke-strong"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
                {i.year}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-aegis-mono text-sev-high">
                Incident
              </span>
            </div>
            <p className="text-5xl font-semibold tracking-aegis-tight text-aegis-fg">{i.stat}</p>
            <p className="text-aegis-sm text-aegis-fg-2">{i.caption}</p>
            <hr className="my-1 border-aegis-stroke" />
            <p className="text-aegis-base font-semibold text-aegis-fg">{i.title}</p>
            <p className="text-aegis-sm text-aegis-fg-2 leading-relaxed">{i.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ─── 3. The MAPE-K loop ───────────────────────────────────────────────

function Loop(): ReactNode {
  const stages = [
    {
      tag: "M",
      name: "Monitor",
      detail:
        "PSI + KS detectors run every 5 min on Vercel Cron. Tinybird stores hot metrics. Anomalies open a GovernanceDecision in `detected` state.",
    },
    {
      tag: "A",
      name: "Analyse",
      detail:
        "DoWhy GCM (Budhathoki AISTATS 2021) decomposes the metric shift across the model's causal DAG. Σφᵢ ≈ Δ — locked as a CI gate.",
    },
    {
      tag: "P",
      name: "Plan",
      detail:
        "CB-Knapsacks contextual bandit (Slivkins JMLR 2024) picks Pareto-optimal action over (utility, safety, cost, latency). Regret bound R(T) ≤ C·√(T·log T)·k tested.",
    },
    {
      tag: "E",
      name: "Execute",
      detail:
        "Reweigh / Retrain / Feature-drop / Recalibrate / Reject-option / Escalate — picked from the action set with priors threaded from causal attribution.",
    },
    {
      tag: "K",
      name: "Knowledge",
      detail:
        "Every transition writes a Merkle-chained, HMAC-signed audit row. Daily snapshots anchor to a public GitHub commit so tampering is externally detectable.",
    },
  ];
  return (
    <section
      id="loop"
      className="relative z-10 mx-auto max-w-aegis-content border-t border-aegis-stroke px-6 py-24 lg:py-32"
    >
      <div className="mb-14 max-w-3xl">
        <p className="aegis-mono-label">How it works</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-aegis-tight text-aegis-fg md:text-5xl">
          A control loop, not a dashboard.
        </h2>
        <p className="mt-5 text-aegis-md text-aegis-fg-2 leading-relaxed">
          IBM's MAPE-K reference architecture (Kephart & Chess 2003) gave us a name for autonomic
          systems. Aegis is what happens when you actually ship one for ML — every box has working
          code, real datasets, peer- reviewed citations, and a CI gate that fails the build if the
          math drifts.
        </p>
      </div>
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stages.map((s, idx) => (
          <li
            key={s.tag}
            className="aegis-card flex flex-col gap-3 p-5"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-aegis-accent">{s.tag}</span>
              <span className="text-aegis-base font-semibold text-aegis-fg">{s.name}</span>
            </div>
            <p className="text-aegis-xs text-aegis-fg-2 leading-relaxed">{s.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── 4. Research ──────────────────────────────────────────────────────

function Research(): ReactNode {
  const contributions = [
    {
      title: "Causal-driven action selection for ML governance",
      lead: "Novel contribution #1",
      detail:
        "We map causal Shapley root-cause kinds (feature-distribution / label-shift / concept-drift / proxy-drift) onto a remediation action space, then thread the recommended action as a Bayesian prior into a CB-Knapsacks bandit. Phase 6 + Phase 7 of the codebase is the implementation.",
      papers: [
        "Budhathoki et al. — Why Did the Distribution Change? (AISTATS 2021)",
        "Edakunni — Distribution-Shapley (2024)",
        "Slivkins, Sankararaman & Foster — Bandits with Knapsacks (JMLR 2024)",
      ],
    },
    {
      title: "Merkle-chained, externally-anchored audit log",
      lead: "Novel contribution #2",
      detail:
        "Every state transition produces a row whose hash includes the previous row's hash + an HMAC signature over canonical JSON. Daily, the head hash is committed to a public GitHub repository. Tampering is detectable by anyone — verifiable without trusting Aegis.",
      papers: [
        "EU AI Act Article 12 (record-keeping for high-risk systems)",
        "NIST AI RMF · MEASURE-2.7 (auditability)",
      ],
    },
  ];
  return (
    <section
      id="research"
      className="relative z-10 mx-auto max-w-aegis-content border-t border-aegis-stroke px-6 py-24 lg:py-32"
    >
      <div className="mb-14 max-w-3xl">
        <p className="aegis-mono-label">Research</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-aegis-tight text-aegis-fg md:text-5xl">
          Two contributions, both shipping in code.
        </h2>
        <p className="mt-5 text-aegis-md text-aegis-fg-2 leading-relaxed">
          Aegis is a working system. Its novel claims live as Python modules with property tests
          that fail the build if the math drifts.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {contributions.map((c) => (
          <article key={c.title} className="aegis-card flex flex-col gap-4 p-7">
            <p className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-accent">
              {c.lead}
            </p>
            <h3 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">
              {c.title}
            </h3>
            <p className="text-aegis-sm text-aegis-fg-2 leading-relaxed">{c.detail}</p>
            <ul className="mt-2 flex flex-col gap-1.5 border-t border-aegis-stroke pt-3">
              {c.papers.map((p) => (
                <li key={p} className="font-mono text-[11px] text-aegis-fg-3 leading-relaxed">
                  · {p}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

// ─── 5. Models ────────────────────────────────────────────────────────

function Models(): ReactNode {
  const models = [
    {
      id: "credit-v1",
      family: "Tabular · XGBoost",
      domain: "Credit underwriting",
      dataset: "HMDA Public LAR 2018",
      severity: "HIGH" as const,
      headline: "DP_gender · 0.71 / floor 0.80",
      version: "1.4.0",
    },
    {
      id: "toxicity-v1",
      family: "Text · DistilBERT",
      domain: "Comment moderation",
      dataset: "Civil Comments (Jigsaw)",
      severity: "MEDIUM" as const,
      headline: "F1 · 0.92 · ECE 0.07",
      version: "0.9.2",
    },
    {
      id: "readmission-v1",
      family: "Tabular · XGBoost",
      domain: "Hospital readmission risk",
      dataset: "Diabetes 130-US (UCI)",
      severity: "HIGH" as const,
      headline: "AUC 0.84 · DP_age 0.81",
      version: "1.0.1",
    },
  ];
  const sevColor: Record<"HIGH" | "MEDIUM" | "LOW", string> = {
    HIGH: "border-sev-high/30 bg-sev-high/10 text-sev-high",
    MEDIUM: "border-sev-medium/30 bg-sev-medium/10 text-sev-medium",
    LOW: "border-sev-low/30 bg-sev-low/10 text-sev-low",
  };
  return (
    <section
      id="models"
      className="relative z-10 mx-auto max-w-aegis-content border-t border-aegis-stroke px-6 py-24 lg:py-32"
    >
      <div className="mb-14 max-w-3xl">
        <p className="aegis-mono-label">Three real models</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-aegis-tight text-aegis-fg md:text-5xl">
          Not toy data. Public datasets, real failures.
        </h2>
        <p className="mt-5 text-aegis-md text-aegis-fg-2 leading-relaxed">
          Aegis monitors a deliberate cross-section: tabular fairness (credit), text safety
          (toxicity), and clinical risk (readmission). Each model ships with a model card,
          datasheet, and a real fairness incident that the loop catches end-to-end.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {models.map((m) => (
          <article
            key={m.id}
            className="aegis-card flex flex-col gap-4 p-6 transition-all hover:-translate-y-1 hover:border-aegis-stroke-strong"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
                {m.family}
              </span>
              <span
                className={`rounded-aegis-control border px-2 py-0.5 font-mono text-[10px] uppercase tracking-aegis-mono ${sevColor[m.severity]}`}
              >
                {m.severity}
              </span>
            </div>
            <h3 className="text-aegis-xl font-semibold text-aegis-fg">{m.id}</h3>
            <p className="text-aegis-sm text-aegis-fg-2">{m.domain}</p>
            <hr className="border-aegis-stroke" />
            <dl className="space-y-2 font-mono text-[11px] text-aegis-fg-3">
              <div className="flex justify-between">
                <dt>dataset</dt>
                <dd className="text-aegis-fg-2">{m.dataset}</dd>
              </div>
              <div className="flex justify-between">
                <dt>version</dt>
                <dd className="text-aegis-fg-2">{m.version}</dd>
              </div>
              <div className="flex justify-between">
                <dt>headline</dt>
                <dd className="text-aegis-fg-2">{m.headline}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

// ─── 6. Stack ─────────────────────────────────────────────────────────

function Stack(): ReactNode {
  const layers = [
    {
      role: "Compute",
      items: ["Vercel Functions Python (Fluid)", "Hugging Face Spaces (DistilBERT)"],
    },
    {
      role: "Data",
      items: ["Neon Postgres", "Tinybird (hot metrics)", "Vercel Blob (snapshots)"],
    },
    {
      role: "AI",
      items: ["Groq · llama-3.3-70b-versatile", "Sentence-Transformers (drift)"],
    },
    {
      role: "Observability",
      items: ["Server-Sent Events bus", "Merkle-chained audit log"],
    },
    {
      role: "Auth",
      items: ["Clerk (sign-in + RBAC)", "HMAC inter-service"],
    },
    {
      role: "Frontend",
      items: ["Next.js 16 App Router", "Editorial Dark · Tailwind"],
    },
  ];
  return (
    <section
      id="stack"
      className="relative z-10 mx-auto max-w-aegis-content border-t border-aegis-stroke px-6 py-24 lg:py-32"
    >
      <div className="mb-14 max-w-3xl">
        <p className="aegis-mono-label">Stack</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-aegis-tight text-aegis-fg md:text-5xl">
          Built entirely on free tiers.
        </h2>
        <p className="mt-5 text-aegis-md text-aegis-fg-2 leading-relaxed">
          Not because the project couldn't afford otherwise — because the point of an ML governance
          platform is that it should be deployable by anyone. Every line of infrastructure stays
          inside hobby/dev tier quotas.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {layers.map((l) => (
          <div key={l.role} className="aegis-card flex flex-col gap-3 p-5">
            <p className="aegis-mono-label">{l.role}</p>
            <ul className="flex flex-col gap-1.5">
              {l.items.map((item) => (
                <li key={item} className="font-mono text-[12px] text-aegis-fg-2 leading-relaxed">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 7. Compliance ────────────────────────────────────────────────────

function Compliance(): ReactNode {
  const frameworks = [
    {
      name: "EU AI Act",
      clauses: ["Art. 9 risk", "Art. 12 records", "Art. 13 transparency", "Art. 14 oversight"],
    },
    {
      name: "NIST AI RMF",
      clauses: ["MAP", "MEASURE", "MANAGE", "GOVERN"],
    },
    {
      name: "ECOA / Reg-B",
      clauses: ["§1002.4 — adverse-action notices"],
    },
    {
      name: "HIPAA",
      clauses: ["Privacy Rule", "Security Rule"],
    },
    {
      name: "FCRA",
      clauses: ["§604/§607 accuracy"],
    },
  ];
  return (
    <section
      id="compliance"
      className="relative z-10 mx-auto max-w-aegis-content border-t border-aegis-stroke px-6 py-24 lg:py-32"
    >
      <div className="mb-14 max-w-3xl">
        <p className="aegis-mono-label">Compliance</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-aegis-tight text-aegis-fg md:text-5xl">
          Mapped to the frameworks operators actually face.
        </h2>
        <p className="mt-5 text-aegis-md text-aegis-fg-2 leading-relaxed">
          Each clause maps to a panel in the dashboard with live evidence — drift signals for risk
          management, audit chain for record-keeping, grounded chat assistant for transparency,
          approval queue for human oversight.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {frameworks.map((f) => (
          <div key={f.name} className="aegis-card flex min-w-[230px] flex-col gap-2 p-5">
            <p className="text-aegis-base font-semibold text-aegis-fg">{f.name}</p>
            <ul className="flex flex-wrap gap-1.5">
              {f.clauses.map((c) => (
                <li
                  key={c}
                  className="rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-aegis-mono text-aegis-fg-2"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 8. CTA ───────────────────────────────────────────────────────────

function CTA(): ReactNode {
  return (
    <section className="relative z-10 mx-auto max-w-aegis-content border-t border-aegis-stroke px-6 py-24 lg:py-32">
      <div className="aegis-card relative overflow-hidden p-12 text-center lg:p-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at center top, rgba(127,180,255,0.18) 0%, transparent 60%)",
          }}
        />
        <div className="relative flex flex-col items-center gap-6">
          <p className="aegis-mono-label">See it run</p>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-aegis-tight text-aegis-fg md:text-5xl">
            Replay the Apple Card 2019 incident.
            <br />
            Watch Aegis self-heal in 7.5 seconds.
          </h2>
          <p className="max-w-xl text-aegis-md text-aegis-fg-2">
            One click. No signup. The dashboard streams every MAPE-K stage as the choreography
            unfolds.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/fleet"
              className="aegis-cta inline-flex items-center gap-2 rounded-aegis-control px-6 py-3.5 text-aegis-base font-semibold text-aegis-bg shadow-lg transition-transform hover:scale-[1.02]"
            >
              <SparkleIcon />
              Open the dashboard
              <span aria-hidden>→</span>
            </a>
            <a
              href="https://github.com/syedwam7q/gov-ml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-aegis-control border border-aegis-stroke-strong bg-aegis-surface-2 px-6 py-3.5 text-aegis-base text-aegis-fg-2 transition-colors hover:bg-aegis-surface-3 hover:text-aegis-fg"
            >
              Read the source
              <span aria-hidden>↗</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 9. Footer ────────────────────────────────────────────────────────

function Footer(): ReactNode {
  return (
    <footer className="relative z-10 border-t border-aegis-stroke">
      <div className="mx-auto flex max-w-aegis-content flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <BrandMark className="text-aegis-accent" />
          <div>
            <p className="font-mono text-[12px] uppercase tracking-aegis-mono text-aegis-fg-2">
              AEGIS
            </p>
            <p className="text-aegis-xs text-aegis-fg-3">
              Autonomous self-healing ML governance · 2026
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-aegis-mono text-aegis-fg-3">
          <a href="/fleet" className="hover:text-aegis-fg">
            Dashboard
          </a>
          <a
            href="https://github.com/syedwam7q/gov-ml"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-aegis-fg"
          >
            GitHub ↗
          </a>
          <a
            href="https://github.com/syedwam7q/gov-ml/blob/main/presentation.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-aegis-fg"
          >
            Paper ↗
          </a>
          <span className="text-aegis-fg-disabled">·</span>
          <span>Built by syedwam7q · MIT</span>
        </div>
      </div>
    </footer>
  );
}
