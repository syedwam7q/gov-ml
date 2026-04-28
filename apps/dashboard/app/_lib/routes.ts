import {
  ApprovalsIcon,
  AuditIcon,
  ChatIcon,
  ComplianceIcon,
  DatasetsIcon,
  FleetIcon,
  IncidentsIcon,
  ModelsIcon,
  PoliciesIcon,
  SettingsIcon,
  type RailItem,
} from "@aegis/ui";

/**
 * Aegis route registry — single source of truth for the LeftRail and
 * the Cmd+J Command Palette. Spec §10.1.
 *
 * Add new top-level routes here. Pages, sub-tabs, and dynamic segments
 * (e.g. `/models/[id]`) are NOT in this list — they are reached by
 * clicking through from a top-level page or via a search action.
 */
export const ROUTES: readonly RailItem[] = [
  {
    key: "fleet",
    label: "Fleet",
    href: "/fleet",
    icon: FleetIcon,
  },
  {
    key: "models",
    label: "Models",
    href: "/models",
    icon: ModelsIcon,
  },
  {
    key: "incidents",
    label: "Incidents",
    href: "/incidents",
    icon: IncidentsIcon,
  },
  {
    key: "approvals",
    label: "Approvals",
    href: "/approvals",
    icon: ApprovalsIcon,
    minRole: "operator",
  },
  {
    key: "audit",
    label: "Audit",
    href: "/audit",
    icon: AuditIcon,
  },
  {
    key: "policies",
    label: "Policies",
    href: "/policies",
    icon: PoliciesIcon,
    minRole: "operator",
  },
  {
    key: "datasets",
    label: "Datasets",
    href: "/datasets",
    icon: DatasetsIcon,
  },
  {
    key: "compliance",
    label: "Compliance",
    href: "/compliance",
    icon: ComplianceIcon,
  },
  {
    key: "chat",
    label: "Chat",
    href: "/chat",
    icon: ChatIcon,
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    icon: SettingsIcon,
  },
] as const;

/** Returns the route entry whose href is the closest prefix-match for `pathname`. */
export function activeRouteKey(pathname: string): string | undefined {
  let bestMatch: RailItem | undefined;
  for (const route of ROUTES) {
    if (pathname === route.href || pathname.startsWith(`${route.href}/`)) {
      if (!bestMatch || route.href.length > bestMatch.href.length) {
        bestMatch = route;
      }
    }
  }
  return bestMatch?.key;
}

/** Returns the human-readable label for the given route key, if registered. */
export function routeLabel(key: string): string | undefined {
  return ROUTES.find((r) => r.key === key)?.label;
}
