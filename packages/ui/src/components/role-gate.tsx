"use client";

import type { ReactNode } from "react";

import type { RailRole } from "./left-rail";
import { useRole } from "./role-context";

const ROLE_RANK: Record<RailRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

export interface RoleGateProps {
  /** Minimum role required to render `children`. */
  readonly minRole: RailRole;
  /** Override the role from context (useful in stories / tests). */
  readonly role?: RailRole;
  /** What to render when the current role is below the threshold. Defaults to nothing. */
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}

/**
 * RoleGate — RBAC-aware conditional render. Hides children unless the
 * current viewer's role is at or above `minRole`.
 *
 *   <RoleGate minRole="admin">
 *     <EmergencyStopToggle />
 *   </RoleGate>
 *
 * The role comes from `RoleProvider` context — wire that to Clerk
 * (`user.publicMetadata.role`) at the (app) layout level.
 */
export function RoleGate({ minRole, role, fallback = null, children }: RoleGateProps): ReactNode {
  const contextRole = useRole();
  const effective = role ?? contextRole;
  if (ROLE_RANK[effective] < ROLE_RANK[minRole]) {
    return fallback;
  }
  return children;
}
