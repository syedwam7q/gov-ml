"use client";

/**
 * `useChatStream` — a typed consumer for the assistant's SSE endpoint.
 *
 * Posts the conversation to `/api/assistant/chat/stream` and reads the
 * Server-Sent Events back token-by-token (ish — the loop yields one
 * frame per scene: tool_call_start, tool_call_end, final_text, ...).
 *
 * Spec §11.3 — the dashboard's full-screen `/chat` page and the Cmd+K
 * drawer both depend on this hook; the surface that owns it controls
 * the scope (`{}` for /chat, `{ decision_id }` for the scoped drawer).
 */

import { useCallback, useState } from "react";

import type { ChatTurn, ToolCall } from "./types";

type StreamFrame =
  | {
      readonly kind: "tool_call_start";
      readonly tool_name: string;
      readonly tool_args: Record<string, unknown>;
    }
  | {
      readonly kind: "tool_call_end";
      readonly tool_name: string;
      readonly tool_args: Record<string, unknown>;
      readonly tool_result_summary: string | null;
      readonly tool_result_payload: unknown;
      readonly tool_error: string | null;
    }
  | { readonly kind: "final_text"; readonly text: string }
  | { readonly kind: "iteration_cap_hit" }
  | { readonly kind: "error"; readonly text: string };

export type ChatStatus = "idle" | "streaming" | "error" | "unavailable";

export interface ChatStreamHook {
  readonly turns: readonly ChatTurn[];
  readonly status: ChatStatus;
  readonly send: (userText: string, scope?: Record<string, unknown>) => Promise<void>;
  readonly reset: () => void;
}

function parseFrames(buffer: string): {
  readonly frames: readonly StreamFrame[];
  readonly tail: string;
} {
  const out: StreamFrame[] = [];
  const events = buffer.split("\n\n");
  const tail = events.pop() ?? "";
  for (const ev of events) {
    const dataLine = ev.split("\n").find((l) => l.startsWith("data: "));
    if (!dataLine) continue;
    try {
      out.push(JSON.parse(dataLine.slice(6)) as StreamFrame);
    } catch {
      // malformed frame — drop
    }
  }
  return { frames: out, tail };
}

export function useChatStream(): ChatStreamHook {
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");

  const reset = useCallback((): void => {
    setTurns([]);
    setStatus("idle");
  }, []);

  const send = useCallback(
    async (userText: string, scope: Record<string, unknown> = {}): Promise<void> => {
      const trimmed = userText.trim();
      if (!trimmed) return;
      const userTurn: ChatTurn = { role: "user", content: trimmed };
      // Snapshot of the prior conversation. We send `prior + userTurn` to
      // the backend (system prompt is added server-side from `scope`).
      let prior: readonly ChatTurn[] = [];
      setTurns((prev) => {
        prior = prev;
        return [...prev, userTurn, { role: "assistant", content: "" }];
      });
      setStatus("streaming");

      const collectedToolCalls: ToolCall[] = [];
      let res: Response;
      try {
        res = await fetch("/api/assistant/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...prior, userTurn].map((t) => ({
              role: t.role,
              content: t.content,
            })),
            scope,
          }),
        });
      } catch {
        setStatus("error");
        setTurns((prev) =>
          replaceLastAssistant(prev, {
            role: "assistant",
            content: "Could not reach the assistant. Is the service running?",
          }),
        );
        return;
      }

      if (res.status === 503) {
        setStatus("unavailable");
        setTurns((prev) =>
          replaceLastAssistant(prev, {
            role: "assistant",
            content:
              "Governance Assistant is unavailable — set GROQ_API_KEY in the assistant service environment, then retry.",
          }),
        );
        return;
      }
      if (!res.ok || !res.body) {
        setStatus("error");
        setTurns((prev) =>
          replaceLastAssistant(prev, {
            role: "assistant",
            content: `Assistant returned ${res.status} ${res.statusText}.`,
          }),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const { frames, tail } = parseFrames(buf);
        buf = tail;
        for (const frame of frames) {
          if (frame.kind === "tool_call_end") {
            const tc: ToolCall = {
              name: frame.tool_name,
              arguments: frame.tool_args,
              result_summary: frame.tool_result_summary ?? "",
              ...(frame.tool_result_payload != null
                ? { result_payload: frame.tool_result_payload }
                : {}),
              ...(frame.tool_error != null ? { error: frame.tool_error } : {}),
            };
            collectedToolCalls.push(tc);
            setTurns((prev) =>
              replaceLastAssistant(prev, {
                role: "assistant",
                content: assistantText,
                tool_calls: [...collectedToolCalls],
              }),
            );
          } else if (frame.kind === "final_text") {
            assistantText = frame.text;
            setTurns((prev) =>
              replaceLastAssistant(prev, {
                role: "assistant",
                content: assistantText,
                tool_calls: [...collectedToolCalls],
              }),
            );
          } else if (frame.kind === "iteration_cap_hit") {
            assistantText =
              assistantText ||
              "Reached the tool-call iteration cap before producing a final answer.";
            setTurns((prev) =>
              replaceLastAssistant(prev, {
                role: "assistant",
                content: assistantText,
                tool_calls: [...collectedToolCalls],
              }),
            );
          } else if (frame.kind === "error") {
            assistantText = friendlyAssistantError(frame.text);
            setTurns((prev) =>
              replaceLastAssistant(prev, {
                role: "assistant",
                content: assistantText,
                tool_calls: [...collectedToolCalls],
              }),
            );
            setStatus(isUnavailableError(frame.text) ? "unavailable" : "error");
            return;
          }
          // tool_call_start frames are intentionally not surfaced as
          // separate turn entries — the dashboard renders the tool
          // chip when the tool_call_end frame lands. A future iteration
          // could show a "running…" spinner between start and end.
        }
      }
      setStatus("idle");
    },
    [],
  );

  return { turns, status, send, reset };
}

function replaceLastAssistant(prev: readonly ChatTurn[], next: ChatTurn): readonly ChatTurn[] {
  if (prev.length === 0) return [next];
  const last = prev[prev.length - 1];
  if (last?.role !== "assistant") return [...prev, next];
  return [...prev.slice(0, -1), next];
}

/**
 * Translate raw Groq SDK error text into operator-friendly copy.
 * Groq's 401 messages contain the literal string "expired_api_key" or
 * "invalid_api_key"; we detect those and replace the noisy stack with
 * a one-liner that tells the operator exactly what to fix.
 */
function friendlyAssistantError(raw: string): string {
  if (/expired_api_key/i.test(raw)) {
    return "Governance Assistant unavailable — the GROQ_API_KEY has expired. Rotate the key in the assistant service environment, then retry.";
  }
  if (/invalid api key|invalid_api_key/i.test(raw)) {
    return "Governance Assistant unavailable — GROQ_API_KEY is invalid. Set a working key in the assistant service environment, then retry.";
  }
  if (/AuthenticationError|401/i.test(raw)) {
    return "Governance Assistant unavailable — Groq rejected the API key. Set a working key, then retry.";
  }
  if (/RateLimitError|429/i.test(raw)) {
    return "Governance Assistant rate-limited by Groq. Wait a moment and retry.";
  }
  if (/tool_use_failed|Failed to call a function/i.test(raw)) {
    return "The model returned a malformed tool call (a known Llama-3.1-8B quirk). Retry your question — the assistant routes the synthesis turn to the 70B model after the first tool call now.";
  }
  if (/BadRequestError|400/i.test(raw)) {
    return "Groq rejected the request (400). Try rephrasing your question; if it persists, the assistant logs will have detail.";
  }
  if (/ConnectError|ConnectionError|ECONNREFUSED|upstream unreachable/i.test(raw)) {
    return "Cannot reach a backend the assistant relies on. Make sure the control plane is running on port 8000 and retry.";
  }
  return raw;
}

function isUnavailableError(raw: string): boolean {
  return /api_key|AuthenticationError|401|GROQ_API_KEY|upstream unreachable|ECONNREFUSED/i.test(
    raw,
  );
}
