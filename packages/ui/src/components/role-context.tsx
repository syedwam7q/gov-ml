"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { RailRole } from "./left-rail";

const RoleContext = createContext<RailRole>("viewer");

export interface RoleProviderProps {
  /** The current viewer's role. */
  readonly value: RailRole;
  readonly children: ReactNode;
}

/**
 * RoleProvider — supplies the active viewer's role to every component
 * that needs RBAC awareness (`RoleGate`, navigation badges, conditional
 * actions). Wrap the (app) layout with this; in production the value
 * comes from Clerk's `user.publicMetadata.role`.
 */
export function RoleProvider({ value, children }: RoleProviderProps): ReactNode {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

/** Returns the current viewer's role from context. */
export function useRole(): RailRole {
  return useContext(RoleContext);
}
