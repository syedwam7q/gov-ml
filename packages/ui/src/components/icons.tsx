import type { ReactNode, SVGProps } from "react";

/**
 * Aegis icon set — a tiny, hand-rolled SVG library.
 *
 * We don't pull in a third-party icon package because (1) every Editorial
 * Dark icon is 1.5px-stroke-only with the same visual weight, and (2) we
 * never want a 200-icon bundle for the ~12 icons we actually use. Each
 * icon below is a 24×24 viewBox stroked through `currentColor`, so any
 * Tailwind text-color utility tints it.
 *
 * Add new icons here only if a route or component genuinely needs one.
 * Spec §10.4 — design discipline.
 */

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function Svg({ children, ...props }: IconProps & { readonly children: ReactNode }): ReactNode {
  return (
    <svg {...baseProps} {...props}>
      {children}
    </svg>
  );
}

/** Fleet — a 3-cell network grid (the canonical "all-models" symbol). */
export function FleetIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Svg>
  );
}

/** Models — stacked layers (an ML "model" stack). */
export function ModelsIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </Svg>
  );
}

/** Incidents — a triangular caution mark with a pulse dot. */
export function IncidentsIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="17" r="0.4" fill="currentColor" />
    </Svg>
  );
}

/** Approvals — a check mark inside a rounded square. */
export function ApprovalsIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m8 12 3 3 5-6" />
    </Svg>
  );
}

/** Audit — chain links (the immutable hash chain). */
export function AuditIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  );
}

/** Policies — a shield outline. */
export function PoliciesIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </Svg>
  );
}

/** Datasets — cylinder. */
export function DatasetsIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
    </Svg>
  );
}

/** Compliance — clipboard with a check. */
export function ComplianceIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="m9 13 2.5 2.5L15 11" />
    </Svg>
  );
}

/** Chat — speech bubble with three dots. */
export function ChatIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M21 12a8 8 0 1 1-3.07-6.32L21 4l-1 5h-5" />
      <circle cx="9" cy="12" r="0.5" fill="currentColor" />
      <circle cx="13" cy="12" r="0.5" fill="currentColor" />
      <circle cx="17" cy="12" r="0.5" fill="currentColor" />
    </Svg>
  );
}

/** Settings — gear. */
export function SettingsIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Svg>
  );
}

/** Search — magnifying glass (used in the command palette trigger). */
export function SearchIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

/** Bell — activity notifications. */
export function BellIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

/** Clock — time-range selector. */
export function ClockIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

/** Sparkle — for the assistant trigger. */
export function SparkleIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M12 3 13.5 9 19 10.5 13.5 12 12 18 10.5 12 5 10.5 10.5 9Z" />
      <path d="M19 4v3" />
      <path d="M21 5.5h-3" />
    </Svg>
  );
}

/** Chevron right — used as a separator in breadcrumbs. */
export function ChevronRightIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <polyline points="9 6 15 12 9 18" />
    </Svg>
  );
}

/** Close X — used in dialogs and drawers. */
export function CloseIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

/** Power — the emergency-stop banner pictogram. */
export function PowerIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </Svg>
  );
}
