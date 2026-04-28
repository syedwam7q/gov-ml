import { redirect } from "next/navigation";

/**
 * Root → /fleet redirect.
 *
 * Phase 4d wires this through Clerk middleware so unauthenticated visitors
 * land on `/login` instead. For now we redirect straight to the fleet view —
 * the chrome works regardless of auth state during development.
 */
export default function HomePage(): never {
  redirect("/fleet");
}
