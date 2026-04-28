import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Auth gating for the Aegis dashboard.
 *
 * Public surface (anyone, no sign-in required):
 *   • /sign-in/*, /sign-up/*  — Clerk's hosted auth screens
 *   • /api/cp/*               — control-plane proxy (server-to-server SSE,
 *                               Clerk session cookies don't apply)
 *   • /api/assistant/*        — assistant proxy (same rationale)
 *   • /design/*               — internal design-system playground
 *
 * Everything else (the (app) route group — fleet, models, incidents,
 * audit, approvals, etc.) requires a Clerk session. Unauthenticated
 * requests are redirected to /sign-in.
 *
 * The middleware runs on every request that matches the `matcher`
 * config below — Next.js skips static files and the special
 * `_next/static` path automatically.
 */

const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/cp/(.*)",
  "/api/assistant/(.*)",
  "/design(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals + static files.
    "/((?!_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
    // Always run for /api routes so Clerk can attach session cookies
    // to server-to-server requests.
    "/(api|trpc)(.*)",
  ],
};
