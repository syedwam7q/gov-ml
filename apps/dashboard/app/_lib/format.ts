/**
 * Human-friendly formatting helpers shared by the dashboard.
 *
 * Kept tiny on purpose — the dashboard never reaches for `dayjs` /
 * `date-fns`; the four functions here cover every surface in spec §10.4
 * (mono labels, audit rows, sparkline tooltips).
 */

/** "47m ago" / "3h ago" / "2d ago" / "just now" — for activity rows + audit feed. */
export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((now - t) / 1000));
  if (seconds < 30) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/** Fixed-width HH:mm:ss in UTC. Used in the timeline scrubber + audit. */
export function clock(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Compact thousands separator — "128,402". */
export function compactInt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Percentage with the sign, e.g. "+4.2%" / "−12.7%". */
export function signedPct(value: number, digits = 1): string {
  const v = Number((value * 100).toFixed(digits));
  if (v === 0) return "0.0%";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;
}

/** 2-decimal fairness/calibration metric, e.g. "0.71". */
export function metricValue(n: number, digits = 2): string {
  return n.toFixed(digits);
}
