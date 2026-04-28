"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Kbd, SparkleIcon } from "@aegis/ui";

import { useChatStream } from "../../_lib/chat-stream";
import type { ChatTurn } from "../../_lib/types";

const PROMPT_LIBRARY: readonly {
  readonly category: string;
  readonly prompts: readonly string[];
}[] = [
  {
    category: "FLEET STATE",
    prompts: [
      "What models are we monitoring right now?",
      "Show me the headline fairness metric for credit-v1 over the last 24h.",
      "Are there any open incidents on the fleet?",
    ],
  },
  {
    category: "DECISIONS",
    prompts: [
      "What's pending in the approval queue?",
      "Why was REWEIGH chosen for the most recent credit-v1 incident?",
      "Walk me through the audit chain for the most recent decision.",
    ],
  },
  {
    category: "ATTRIBUTION",
    prompts: [
      "What's driving the demographic_parity_gender drift on credit-v1?",
      "Which root causes show up most often across the fleet?",
      "Was the recommended action accepted by the planner?",
    ],
  },
];

const STARTER_HINT = `Ask anything about the fleet — every claim is grounded on a tool call against the live control plane.

Try one of the prompts on the right, or type your own.`;

export function ChatView(): ReactNode {
  const { turns, status, send } = useChatStream();
  const [draft, setDraft] = useState("");
  const transcriptRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  const onSubmit = (): void => {
    const text = draft.trim();
    if (!text || status === "streaming") return;
    void send(text);
    setDraft("");
  };

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
            llama 3.3 70B versatile · 7 grounded tools · {statusLabel(status)}
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
          <ol ref={transcriptRef} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
            {turns.length === 0 && (
              <li className="aegis-card max-w-2xl px-4 py-3 text-aegis-sm text-aegis-fg-2 whitespace-pre-line">
                {STARTER_HINT}
              </li>
            )}
            {turns.map((turn, idx) => (
              <Turn
                key={idx}
                turn={turn}
                streaming={status === "streaming" && idx === turns.length - 1}
              />
            ))}
          </ol>

          <Composer
            draft={draft}
            onChange={setDraft}
            onSubmit={onSubmit}
            disabled={status === "streaming"}
          />
        </div>

        <aside className="hidden border-l border-aegis-stroke bg-aegis-surface-1 px-5 py-6 lg:flex lg:flex-col lg:gap-6 overflow-y-auto">
          <div className="space-y-2">
            <p className="aegis-mono-label">SCOPE</p>
            <p className="text-aegis-xs text-aegis-fg-2 leading-aegis-snug">
              Drift signals, decisions, audit rows, approvals, Pareto fronts, and causal
              attribution. Out-of-scope queries are politely refused — the assistant cannot
              speculate about state it cannot verify with a tool call.
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

function statusLabel(status: ReturnType<typeof useChatStream>["status"]): string {
  if (status === "streaming") return "streaming…";
  if (status === "unavailable") return "unavailable · GROQ_API_KEY unset";
  if (status === "error") return "error";
  return "ready";
}

function Turn({
  turn,
  streaming,
}: {
  readonly turn: ChatTurn;
  readonly streaming: boolean;
}): ReactNode {
  const isAssistant = turn.role === "assistant";
  return (
    <li
      className={`flex flex-col gap-2 aegis-fade-in ${isAssistant ? "items-start" : "items-end"}`}
    >
      <div
        className={`max-w-2xl rounded-aegis-card border px-4 py-3 ${
          isAssistant
            ? "border-aegis-stroke bg-aegis-surface-1 text-aegis-fg"
            : "border-aegis-accent/30 bg-aegis-accent-soft text-aegis-fg"
        }`}
      >
        <p className="aegis-mono-label mb-2">{isAssistant ? "ASSISTANT" : "YOU"}</p>
        <p className="text-aegis-sm leading-aegis-normal whitespace-pre-line">
          {turn.content || <span className="text-aegis-fg-3">{streaming ? "thinking…" : ""}</span>}
        </p>
      </div>
      {isAssistant && turn.tool_calls && turn.tool_calls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {turn.tool_calls.map((tool, idx) => (
            <span
              key={`${tool.name}-${idx}`}
              className={`inline-flex items-center gap-2 rounded-aegis-control border px-2 py-1 aegis-mono text-[10.5px] ${
                tool.error
                  ? "border-sev-high/30 bg-sev-high-soft text-sev-high"
                  : "border-aegis-stroke bg-aegis-surface-2 text-aegis-fg-2"
              }`}
            >
              <span className={tool.error ? "text-sev-high" : "text-aegis-accent"}>tool</span>
              <span>{tool.name}</span>
              <span className="text-aegis-fg-3">·</span>
              <span className="text-aegis-fg-3 max-w-[28ch] truncate">
                {tool.error ?? tool.result_summary}
              </span>
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
  onSubmit,
  disabled,
}: {
  readonly draft: string;
  readonly onChange: (v: string) => void;
  readonly onSubmit: () => void;
  readonly disabled: boolean;
}): ReactNode {
  return (
    <div className="border-t border-aegis-stroke px-6 py-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex items-end gap-3 rounded-aegis-card border border-aegis-stroke bg-aegis-surface-1 px-3 py-2.5 transition-colors focus-within:border-aegis-accent"
      >
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={1}
          placeholder="Ask the assistant…  (⏎ to send, ⇧⏎ for newline)"
          aria-label="Message the assistant"
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-aegis-sm text-aegis-fg placeholder:text-aegis-fg-3 focus:outline-none disabled:opacity-50"
        />
        <Kbd>↵</Kbd>
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className="inline-flex h-8 items-center gap-2 rounded-aegis-control border border-aegis-accent/40 bg-aegis-accent-soft px-3 text-aegis-sm text-aegis-accent disabled:opacity-50"
        >
          send
        </button>
      </form>
    </div>
  );
}
