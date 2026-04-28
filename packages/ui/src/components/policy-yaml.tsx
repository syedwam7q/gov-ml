import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface PolicyYamlProps {
  readonly source: string;
  readonly className?: string;
}

/**
 * PolicyYaml — minimal, dependency-free YAML renderer with token tints.
 *
 * Recognises:
 *   • # comments  → fg-tertiary
 *   • key:        → accent
 *   • -  list bullet → fg-secondary
 *   • numeric / boolean / quoted-string values → distinct tints
 *
 * Spec §6.3 ("policy DSL surface, line-level diffability"). Monaco
 * upgrade lands in Phase 4e+ when in-browser editing is needed.
 */
export function PolicyYaml({ source, className }: PolicyYamlProps): ReactNode {
  const lines = source.split("\n");
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-aegis-control border border-aegis-stroke bg-aegis-surface-2 px-4 py-3 font-mono text-aegis-xs leading-aegis-snug",
        className,
      )}
    >
      {lines.map((line, idx) => (
        <span key={idx} className="block whitespace-pre">
          <span className="select-none mr-4 inline-block w-6 text-right text-aegis-fg-disabled tabular-nums">
            {idx + 1}
          </span>
          {tokenize(line)}
        </span>
      ))}
    </pre>
  );
}

const LINE_PATTERN = /^(\s*)(-?\s*)([^:#]+?)(:\s*)(.*?)(\s*#.*)?$/;

function tokenize(line: string): ReactNode {
  if (line.trim().startsWith("#")) {
    return <span className="text-aegis-fg-3">{line}</span>;
  }
  const matched = LINE_PATTERN.exec(line);
  if (!matched) {
    return <span className="text-aegis-fg-2">{line || " "}</span>;
  }
  const [, indent, dash, key, colon, rawValue, trailingComment] = matched;
  return (
    <>
      <span>{indent}</span>
      {dash ? <span className="text-aegis-fg-3">{dash}</span> : null}
      <span className="text-aegis-accent">{key}</span>
      <span className="text-aegis-fg-3">{colon}</span>
      {valueSpan(rawValue ?? "")}
      {trailingComment ? <span className="text-aegis-fg-3">{trailingComment}</span> : null}
    </>
  );
}

function valueSpan(raw: string): ReactNode {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return <span>{raw}</span>;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return <span className="text-status-ok">{raw}</span>;
  }
  if (trimmed === "true" || trimmed === "false") {
    return <span className="text-sev-medium">{raw}</span>;
  }
  if (/^["'].*["']$/.test(trimmed)) {
    return <span className="text-sev-low">{raw}</span>;
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return <span className="text-aegis-fg">{raw}</span>;
  }
  return <span className="text-aegis-fg">{raw}</span>;
}
