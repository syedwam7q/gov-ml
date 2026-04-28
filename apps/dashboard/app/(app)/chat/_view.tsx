"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Kbd, SparkleIcon } from "@aegis/ui";

interface SeededTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
  /** Tool calls referenced inline by the assistant turn. */
  readonly tools?: readonly { readonly name: string; readonly result: string }[];
}

const SEED_TRANSCRIPT: readonly SeededTurn[] = [
  {
    role: "user",
    content: "Why did credit-v1 trigger the high-severity fairness signal at 2:30am?",
  },
  {
    role: "assistant",
    content:
      "credit-v1 raised a HIGH severity at 02:32 UTC because demographic_parity_ratio for the female applicant cohort dropped to 0.71 — below the policy floor of 0.80.\n\nThe causal-attribution service traces 62% of the drop to a shift in `applicant_income_thousands`: the female-applicant income distribution moved outside the training support (PSI = 0.31, alarm at 0.20). A secondary 21% comes from a feature interaction between income and credit_history — the same pattern flagged in the 2019 Apple-Card investigation, where joint-filing applicants surface disparate allocation despite shared finances.",
    tools: [
      {
        name: "get_decision",
        result: "decision_id=dec-001 · severity=HIGH · state=evaluated",
      },
      {
        name: "explain_drift_signal",
        result:
          "credit-v1 / demographic_parity_ratio · top cause = dataset_drift.applicant_income_thousands (62%)",
      },
    ],
  },
  {
    role: "user",
    content: "What action did we take and is the metric back inside the floor?",
  },
  {
    role: "assistant",
    content:
      "Operator ana.salah@aegis.dev approved a rollback to credit-v1 / 1.4.0 at 03:45 UTC. The executor completed the rollback in 4m 38s. Post-action demographic_parity_ratio = 0.92, comfortably back above the 0.80 floor. A retrain with stratified income sampling is enqueued to ship the long-term fix once it stabilises.",
    tools: [
      {
        name: "get_decision",
        result: "decision_id=dec-001 · post_action_metric=0.92 · reward.safety=0.92",
      },
      {
        name: "get_audit_chain",
        result: "8 rows · last sequence_n=8 · chain verified",
      },
    ],
  },
];

const PROMPT_LIBRARY: readonly {
  readonly category: string;
  readonly prompts: readonly string[];
}[] = [
  {
    category: "FLEET STATE",
    prompts: [
      "Summarise the fleet's open incidents.",
      "Which model has the worst-trending fairness metric this week?",
      "Show me every CRITICAL severity in the last 7 days.",
    ],
  },
  {
    category: "DECISIONS",
    prompts: [
      "Why did credit-v1 trigger today's high-severity signal?",
      "List approvals waiting on me.",
      "What action did the executor run for dec-001 and why?",
    ],
  },
  {
    category: "AUDIT + COMPLIANCE",
    prompts: [
      "Verify the last 100 audit rows.",
      "Which EU AI Act clauses are still partial?",
      "Surface evidence for ECOA Reg-B § 1002.4.",
    ],
  },
];

export function ChatView(): ReactNode {
  const [draft, setDraft] = useState("");

  return (
    <section className="flex h-[calc(100dvh-var(--aegis-nav-height))] flex-col">
      <header className="flex flex-col gap-2 border-b border-aegis-stroke px-6 py-4">
        <div className="flex items-baseline gap-3">
          <p className="aegis-mono-label flex items-center gap-2">
            <span className="text-aegis-accent">
              <SparkleIcon width={14} height={14} />
            </span>
            GOVERNANCE ASSISTANT
          </p>
          <span className="aegis-mono text-aegis-xs text-aegis-fg-3">
            llama 3.3 70B versatile · 7 grounded tools · backend wires phase 8
          </span>
        </div>
        <p className="max-w-3xl text-aegis-sm text-aegis-fg-2">
          Long-form workspace for the Aegis assistant. Every claim is grounded on a tool-call
          against the control plane — the assistant never hallucinates state. Use ⌘K elsewhere for
          the slide-in quick view; this surface keeps a persistent transcript.
        </p>
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
        <div className="flex min-h-0 flex-col">
          <ol className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
            {SEED_TRANSCRIPT.map((turn, idx) => (
              <Turn key={idx} turn={turn} />
            ))}
            <li className="aegis-card flex items-center gap-3 px-4 py-3 text-aegis-xs text-aegis-fg-3">
              <span className="h-2 w-2 rounded-full bg-aegis-accent" aria-hidden />
              <span>backend wires in Phase 8 · transcript above is a seeded preview</span>
            </li>
          </ol>

          <Composer draft={draft} onChange={setDraft} />
        </div>

        <aside className="hidden border-l border-aegis-stroke bg-aegis-surface-1 px-5 py-6 lg:flex lg:flex-col lg:gap-6 overflow-y-auto">
          <div className="space-y-2">
            <p className="aegis-mono-label">SCOPE</p>
            <p className="text-aegis-xs text-aegis-fg-2 leading-aegis-snug">
              Drift signals, decisions, audit rows, approvals, Pareto fronts, and compliance
              evidence. Out-of-scope queries are politely refused — the assistant cannot speculate
              about state it cannot verify.
            </p>
          </div>
          {PROMPT_LIBRARY.map((group) => (
            <div key={group.category} className="space-y-2">
              <p className="aegis-mono-label">{group.category}</p>
              <ul className="space-y-1.5">
                {group.prompts.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => setDraft(p)}
                      className="aegis-card w-full px-3 py-2 text-left text-aegis-xs text-aegis-fg-2 transition-colors duration-aegis-fast hover:border-aegis-stroke-strong hover:text-aegis-fg"
                    >
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}

function Turn({ turn }: { readonly turn: SeededTurn }): ReactNode {
  const isAssistant = turn.role === "assistant";
  return (
    <li className={`flex flex-col gap-2 ${isAssistant ? "items-start" : "items-end"}`}>
      <div
        className={`max-w-2xl rounded-aegis-card border px-4 py-3 ${
          isAssistant
            ? "border-aegis-stroke bg-aegis-surface-1 text-aegis-fg"
            : "border-aegis-accent/30 bg-aegis-accent-soft text-aegis-fg"
        }`}
      >
        <p className="aegis-mono-label mb-2">{isAssistant ? "ASSISTANT" : "YOU"}</p>
        <p className="text-aegis-sm leading-aegis-normal whitespace-pre-line">{turn.content}</p>
      </div>
      {isAssistant && turn.tools ? (
        <div className="flex flex-wrap gap-2">
          {turn.tools.map((tool) => (
            <span
              key={tool.name}
              className="inline-flex items-center gap-2 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-2 py-1 aegis-mono text-[10.5px] text-aegis-fg-2"
            >
              <span className="text-aegis-accent">tool</span>
              <span>{tool.name}</span>
              <span className="text-aegis-fg-3">·</span>
              <span className="text-aegis-fg-3">{tool.result}</span>
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function Composer({
  draft,
  onChange,
}: {
  readonly draft: string;
  readonly onChange: (v: string) => void;
}): ReactNode {
  return (
    <div className="border-t border-aegis-stroke px-6 py-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="flex items-end gap-3 rounded-aegis-card border border-aegis-stroke bg-aegis-surface-1 px-3 py-2.5 transition-colors focus-within:border-aegis-accent"
      >
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          rows={1}
          placeholder="Ask the assistant…  (backend lands Phase 8)"
          aria-label="Message the assistant"
          className="flex-1 resize-none bg-transparent text-aegis-sm text-aegis-fg placeholder:text-aegis-fg-3 focus:outline-none"
        />
        <Kbd>↵</Kbd>
        <button
          type="submit"
          disabled
          className="inline-flex h-8 items-center gap-2 rounded-aegis-control border border-aegis-accent/40 bg-aegis-accent-soft px-3 text-aegis-sm text-aegis-accent disabled:opacity-50"
        >
          send
        </button>
      </form>
    </div>
  );
}
