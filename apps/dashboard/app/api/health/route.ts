import { NextResponse } from "next/server";

/**
 * GET /api/health — public liveness endpoint.
 *
 * Used by uptime monitors and the Vercel deploy preview check. Stays
 * intentionally minimal; richer telemetry lives in `/api/metrics`
 * (introduced when the Tinybird wiring lands in Phase 5).
 */
export function GET(): NextResponse {
  return NextResponse.json(
    {
      service: "aegis-dashboard",
      status: "ok",
      version: "0.1.0",
      now: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
