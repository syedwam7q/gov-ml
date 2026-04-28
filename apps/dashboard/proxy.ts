import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextMiddleware } from "next/server";
import { NextResponse } from "next/server";

/**
 * Aegis auth proxy (Next 16 — formerly `middleware.ts`).
 *
 * Production: every route is private except the public ones below.
 * Clerk handles redirect-to-/login when the visitor lacks a session.
 *
 * Local development: when no Clerk keys are present we fall back to a
 * no-op so contributors can boot the dashboard with zero setup. The
 * bypass only activates when both the publishable key AND the secret
 * key are missing — a partial config means a misconfigured deploy and
 * we let Clerk surface the error loudly.
 *
 * Spec §9.2 / §10.1.
 */

const isPublic = createRouteMatcher([
  // The marketing landing page is the public front door.
  "/",
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding(.*)",
  "/api/health",
  // Server-to-server proxies — Clerk session cookies don't apply.
  // The control plane and assistant authenticate inter-service calls
  // via HMAC, not Clerk; the dashboard's SSE consumer also needs
  // anonymous access to /api/cp/stream so the demo theater + activity
  // feed can subscribe.
  "/api/cp/(.*)",
  "/api/assistant/(.*)",
  "/_next/(.*)",
  "/favicon.ico",
  "/.well-known/(.*)",
]);

const hasClerkKeys =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && Boolean(process.env.CLERK_SECRET_KEY);

const noOpProxy: NextMiddleware = () => NextResponse.next();

const proxy = hasClerkKeys
  ? clerkMiddleware(async (auth, req) => {
      if (isPublic(req)) return;
      await auth.protect();
    })
  : noOpProxy;

export default proxy;

/**
 * Match every route except Next's internal asset pipeline. The pattern
 * mirrors Clerk's recommended config so static files, build artefacts,
 * and well-known endpoints skip the middleware entirely. The `_next`
 * and `favicon.ico` exclusions are belt-and-braces — the public-route
 * matcher above also lets them through.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)).*)",
    "/(api|trpc)(.*)",
  ],
};
