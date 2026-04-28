"use client";

/**
 * AssistantDrawer — the Cmd+K right-slide-in panel for the Aegis
 * Governance Assistant. Spec §11.3.
 *
 * Phase 8 wiring: the drawer reads the current pathname, derives a
 * scope hint (`{ decision_id }` on `/incidents/<uuid>`,
 * `{ model_id }` on `/models/<id>`), and threads it through the
 * grounded chat stream. The system prompt picks up the scope so the
 * model prefers tool args matching the page the operator is on.
 */

import { CloseIcon, Kbd, SparkleIcon } from "@aegis/ui";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useChatStream } from "../../_lib/chat-stream";
import type { ChatTurn } from "../../_lib/types";

interface AssistantDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_DEC_RE = /^dec(?:-[0-9a-z-]+)?$/i;

function deriveScope(pathname: string): {
  readonly scope: Record<string, string>;
  readonly label: string;
} {
  const parts = pathname.split("/").filter(Boolean);
  // /incidents/<id>
  const incidentsIdx = parts.indexOf("incidents");
  const incidentId = parts[incidentsIdx + 1];
  if (incidentsIdx >= 0 && incidentId) {
    if (UUID_RE.test(incidentId) || SHORT_DEC_RE.test(incidentId) || incidentId.length >= 6) {
      return {
        scope: { decision_id: incidentId },
        label: `Scoped · decision ${incidentId.slice(0, 8)}…`,
      };
    }
  }
  // /models/<id>
  const modelsIdx = parts.indexOf("models");
  const modelId = parts[modelsIdx + 1];
  if (modelsIdx >= 0 && modelId) {
    return {
      scope: { model_id: modelId },
      label: `Scoped · model ${modelId}`,
    };
  }
  return { scope: {}, label: "Global · ask anything about the fleet" };
}

export function AssistantDrawer({ open, onClose }: AssistantDrawerProps): ReactNode {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const transcriptRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname() ?? "";
  const { scope, label } = useMemo(() => deriveScope(pathname), [pathname]);
  const { turns, status, send, reset } = useChatStream();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return (): void => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [open, turns]);

  const onSubmit = (): void => {
    const text = draft.trim();
    if (!text || status === "streaming") return;
    void send(text, scope);
    setDraft("");
  };

  return (
    <div
      role="dialog"
      aria-modal={open}
      aria-label="Governance assistant"
      aria-hidden={!open}
      className="pointer-events-none fixed inset-0 z-40"
    >
      <div
        aria-hidden
        className={`absolute inset-0 bg-aegis-bg/60 transition-opacity duration-aegis-base ease-aegis ${
          open ? "pointer-events-auto opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-aegis-stroke bg-aegis-surface-1 transition-transform duration-aegis-base ease-aegis ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-aegis-stroke px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-aegis-accent" aria-hidden>
              <SparkleIcon />
            </span>
            <div className="flex flex-col leading-none">
              <p className="text-aegis-base font-semibold text-aegis-fg">Governance Assistant</p>
              <p className="aegis-mono mt-1 text-[10px] uppercase tracking-aegis-mono text-aegis-fg-3">
                {label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              aria-label="Reset conversation"
              disabled={status === "streaming" || turns.length === 0}
              className="hidden font-mono text-[10px] uppercase tracking-aegis-mono text-aegis-fg-3 hover:text-aegis-fg disabled:opacity-40 sm:inline"
            >
              reset
            </button>
            <span className="hidden items-center gap-1 sm:flex" aria-hidden>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="inline-flex h-8 w-8 items-center justify-center rounded-aegis-control text-aegis-fg-2 hover:bg-aegis-surface-2 hover:text-aegis-fg"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <ol ref={transcriptRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
          {turns.length === 0 ? <DrawerStarter scopeLabel={label} /> : null}
          {turns.map((turn, idx) => (
            <DrawerTurn
              key={idx}
              turn={turn}
              streaming={status === "streaming" && idx === turns.length - 1}
            />
          ))}
        </ol>

        <footer className="border-t border-aegis-stroke px-5 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="flex items-end gap-2 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-3 py-2 transition-colors focus-within:border-aegis-accent"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              rows={1}
              placeholder={
                status === "unavailable"
                  ? "GROQ_API_KEY unset — set it and retry"
                  : "Ask the assistant…  ⏎ to send"
              }
              aria-label="Ask the assistant"
              disabled={status === "streaming"}
              className="flex-1 resize-none bg-transparent text-aegis-sm text-aegis-fg placeholder:text-aegis-fg-3 focus:outline-none disabled:opacity-50"
            />
            <Kbd>↵</Kbd>
          </form>
          <p className="mt-2 aegis-mono text-[10px] uppercase tracking-aegis-mono text-aegis-fg-3">
            {status === "streaming"
              ? "streaming…"
              : status === "unavailable"
                ? "service unavailable"
                : status === "error"
                  ? "error · retry"
                  : "ready"}
          </p>
        </footer>
      </aside>
    </div>
  );
}

function DrawerStarter({ scopeLabel }: { readonly scopeLabel: string }): ReactNode {
  return (
    <li className="aegis-card flex flex-col gap-2 px-4 py-3">
      <p className="aegis-mono-label">SCOPE</p>
      <p className="text-aegis-sm text-aegis-fg-2 leading-aegis-normal">{scopeLabel}</p>
      <p className="text-aegis-xs text-aegis-fg-3 leading-aegis-snug">
        Every claim is grounded on a tool call against the control plane. Out-of-scope queries are
        politely refused.
      </p>
    </li>
  );
}

function DrawerTurn({
  turn,
  streaming,
}: {
  readonly turn: ChatTurn;
  readonly streaming: boolean;
}): ReactNode {
  const isAssistant = turn.role === "assistant";
  return (
    <li
      className={`flex flex-col gap-1.5 aegis-fade-in ${isAssistant ? "items-start" : "items-end"}`}
    >
      <div
        className={`max-w-[100%] rounded-aegis-card border px-3 py-2 ${
          isAssistant
            ? "border-aegis-stroke bg-aegis-surface-1 text-aegis-fg"
            : "border-aegis-accent/30 bg-aegis-accent-soft text-aegis-fg"
        }`}
      >
        <p className="aegis-mono-label mb-1.5 text-[9px]">{isAssistant ? "ASSISTANT" : "YOU"}</p>
        <p className="text-aegis-sm leading-aegis-normal whitespace-pre-line">
          {turn.content || <span className="text-aegis-fg-3">{streaming ? "thinking…" : ""}</span>}
        </p>
      </div>
      {isAssistant && turn.tool_calls && turn.tool_calls.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {turn.tool_calls.map((tool, idx) => (
            <span
              key={`${tool.name}-${idx}`}
              className={`inline-flex items-center gap-1.5 rounded-aegis-control border px-2 py-0.5 aegis-mono text-[10px] ${
                tool.error
                  ? "border-sev-high/30 bg-sev-high-soft text-sev-high"
                  : "border-aegis-stroke bg-aegis-surface-2 text-aegis-fg-2"
              }`}
            >
              <span className={tool.error ? "text-sev-high" : "text-aegis-accent"}>tool</span>
              <span>{tool.name}</span>
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}
