/**
 * SSE proxy for the Governance Assistant chat stream.
 *
 * Same rationale as `apps/dashboard/app/api/cp/stream/route.ts` — the
 * default Next.js dev rewrite buffers streamed POST responses, so the
 * browser's `fetch().body.getReader()` only sees the body after the
 * upstream closes. That looks like the assistant is "thinking" forever
 * because no `final_text` frame ever lands in the consumer.
 *
 * This route handler streams the upstream `body` straight back to the
 * browser as `text/event-stream`. The request body is forwarded too —
 * `duplex: "half"` lets us pipe the JSON post payload upstream while
 * still reading the streamed response.
 */

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

function assistantUrl(): string {
  const env = process.env;
  return (env.AEGIS_ASSISTANT_DEV_URL ?? "http://127.0.0.1:8005").replace(/\/$/, "");
}

export async function POST(req: NextRequest): Promise<Response> {
  const upstream = `${assistantUrl()}/chat/stream`;
  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: req.body,
      cache: "no-store",
      signal: req.signal,
      // Required when forwarding a streaming request body (Node fetch).
      // The TypeScript lib doesn't know about `duplex` yet — runtime
      // accepts it on Node's undici-based fetch.
      ...({ duplex: "half" } as Record<string, unknown>),
    });
  } catch (err) {
    return new Response(`upstream unreachable: ${String(err)}`, {
      status: 502,
    });
  }

  if (!res.body) {
    return new Response(`upstream returned no body (status ${res.status})`, {
      status: 502,
    });
  }

  // Pass through 503 (assistant unavailable) etc. so the dashboard's
  // useChatStream hook can map status codes to friendlier copy.
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
