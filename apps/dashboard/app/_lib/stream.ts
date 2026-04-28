"use client";

import { useEffect, useState } from "react";

import type { ActivityEvent } from "./types";

/**
 * Typed EventSource wrapper for the dashboard's live activity feed.
 *
 * Subscribes to `/api/cp/stream` (FastAPI SSE endpoint, see
 * `services/control-plane/src/aegis_control_plane/routers/stream.py`).
 * Each `state_transition` / `decision_open` / `approval_decided` /
 * `metrics_degraded` payload is mapped onto the dashboard's
 * `ActivityEvent` shape and prepended to the in-memory feed.
 *
 * Heartbeat events from the server are silently ignored — they exist
 * only so reverse proxies don't close the connection on idle.
 *
 * Spec §10.2 (SSE-driven activity bell).
 */

interface StreamPayload {
  readonly id?: string;
  readonly decision_id?: string;
  readonly model_id?: string;
  readonly severity?: ActivityEvent["severity"];
  readonly kind?: ActivityEvent["kind"];
  readonly to_state?: string;
  readonly summary?: string;
  readonly title?: string;
}

interface StreamFrame {
  readonly type: string;
  readonly data: StreamPayload;
}

function frameToActivity(frame: StreamFrame): ActivityEvent | null {
  const d = frame.data;
  // Map server `type` to dashboard `kind` if the payload didn't set one.
  const kind: ActivityEvent["kind"] =
    d.kind ??
    (frame.type === "state_transition"
      ? "decision_advanced"
      : frame.type === "decision_open"
        ? "decision_opened"
        : frame.type === "approval_decided"
          ? "approval_decided"
          : "decision_advanced");
  // Build with conditional spread so optional fields stay absent under
  // `exactOptionalPropertyTypes`.
  const event: ActivityEvent = {
    id: d.id ?? `${frame.type}-${Date.now()}`,
    ts: new Date().toISOString(),
    kind,
    summary: d.summary ?? d.title ?? frame.type,
    actor: "system",
    ...(d.model_id ? { model_id: d.model_id } : {}),
    ...(d.decision_id ? { decision_id: d.decision_id } : {}),
    ...(d.severity ? { severity: d.severity } : {}),
  };
  return event;
}

export type StreamConnection = "pending" | "live" | "disconnected";

export interface StreamState {
  readonly events: readonly ActivityEvent[];
  readonly connection: StreamConnection;
}

/**
 * `useActivityStream` — opens one SSE connection, threads new events
 * into a rolling window of up to `limit` items.
 *
 * `initial` seeds the feed (typically from `/api/cp/activity`) so the
 * UI never renders empty while the SSE warms up.
 */
export function useActivityStream(initial: readonly ActivityEvent[] = [], limit = 50): StreamState {
  const [events, setEvents] = useState<readonly ActivityEvent[]>(initial);
  const [connection, setConnection] = useState<StreamConnection>("pending");

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return undefined;
    }
    const src = new EventSource("/api/cp/stream");

    src.onopen = (): void => setConnection("live");
    src.onerror = (): void => setConnection("disconnected");

    const onMessage = (raw: MessageEvent<string>): void => {
      try {
        const frame = JSON.parse(raw.data) as StreamFrame;
        const activity = frameToActivity(frame);
        if (!activity) return;
        setEvents((prev) => [activity, ...prev].slice(0, limit));
      } catch {
        // Heartbeats arrive as `event: heartbeat` — already filtered out by
        // the listener key below; any malformed frame is silently dropped.
      }
    };

    src.addEventListener("message", onMessage);
    return (): void => {
      src.removeEventListener("message", onMessage);
      src.close();
      setConnection("disconnected");
    };
  }, [limit]);

  return { events, connection };
}
