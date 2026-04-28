"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { CloseIcon, Kbd, SparkleIcon } from "@aegis/ui";

interface AssistantDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * AssistantDrawer — the Cmd+K right-slide-in panel for the Aegis
 * Governance Assistant. Spec §11.3 / §10.2.
 *
 * Phase 4b ships the UI shell only — the chat transcript, Groq
 * streaming, and tool-call rendering wire in Phase 8 once the
 * `services/assistant` backend exists. The drawer is intentionally
 * minimal here: a header with the assistant name, a body with a
 * short orientation message, and the closed-form input. When the
 * backend lands the body is replaced by a `<MessageList>` and the
 * input by a `<ChatComposer>` — neither breaks this shell.
 */
export function AssistantDrawer({ open, onClose }: AssistantDrawerProps): ReactNode {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => closeBtnRef.current?.focus());

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

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
            <p className="text-aegis-base font-semibold text-aegis-fg">Governance Assistant</p>
          </div>
          <div className="flex items-center gap-2">
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

        <div className="flex-1 overflow-y-auto px-5 py-6 text-aegis-sm text-aegis-fg-2">
          <p className="aegis-mono-label mb-3">SCOPE</p>
          <p className="leading-aegis-normal">
            The assistant answers questions about your fleet — drift trends, fairness signals,
            decision lifecycles, audit chains, and pending approvals. Every answer is grounded on a
            tool call against the control plane, so you always see the evidence behind a claim.
          </p>
          <p className="aegis-mono-label mb-3 mt-6">EXAMPLES</p>
          <ul className="space-y-1.5">
            <li className="aegis-card px-3 py-2">Why did credit-v1 trigger a high severity?</li>
            <li className="aegis-card px-3 py-2">List approvals waiting on me.</li>
            <li className="aegis-card px-3 py-2">Verify the last 100 audit rows.</li>
          </ul>
          <p className="mt-6 aegis-mono text-aegis-xs text-aegis-fg-3">backend wiring · phase 8</p>
        </div>

        <footer className="border-t border-aegis-stroke px-5 py-3">
          <div className="flex items-center gap-2 rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-3 py-2.5">
            <input
              type="text"
              disabled
              placeholder="Ask the assistant…  (coming in phase 8)"
              className="flex-1 bg-transparent text-aegis-sm text-aegis-fg placeholder:text-aegis-fg-3 focus:outline-none"
              aria-label="Ask the assistant"
            />
            <Kbd>↵</Kbd>
          </div>
        </footer>
      </aside>
    </div>
  );
}
