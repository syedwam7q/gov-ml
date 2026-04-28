/**
 * SSE proxy for the control-plane event bus.
 *
 * Why not a `next.config.mjs` rewrite: Next.js dev server's rewrite
 * pipeline buffers proxied response bodies (it pipes through Node's
 * default `http.ServerResponse`, which gathers chunks before flushing
 * if Content-Length isn't known). EventSource on the browser expects
 * chunks live — `onopen` fires on headers, but `onmessage` only fires
 * on flushed `data:` lines. Symptoms: dot says "live" but `onmessage`
 * never fires, count stays at 0/7.
 *
 * This Route Handler bypasses that by passing the upstream `body`
 * ReadableStream straight through, with explicit `text/event-stream`
 * headers and `X-Accel-Buffering: no` so any reverse proxy (nginx,
 * Vercel edge) won't buffer either. `force-dynamic` + `runtime: "nodejs"`
 * ensures Next doesn't try to cache or render this in any other way.
 */

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

function controlPlaneUrl(): string {
  const env = process.env;
  return (env.AEGIS_CONTROL_PLANE_DEV_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function GET(req: NextRequest): Promise<Response> {
  const upstream = `${controlPlaneUrl()}/api/cp/stream`;
  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
      // Forward the abort signal so closing the browser tab cleans up
      // the FastAPI subscriber promptly instead of waiting for the
      // 15-second heartbeat timeout to detect the disconnect.
      signal: req.signal,
    });
  } catch (err) {
    return new Response(`upstream unreachable: ${String(err)}`, {
      status: 502,
    });
  }

  if (!res.ok || !res.body) {
    return new Response(`upstream returned ${res.status}`, { status: 502 });
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
