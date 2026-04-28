import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface CausalDAGNode {
  /** Stable identifier — used for `key` and edge endpoints. */
  readonly id: string;
  /** Visible label — typically the feature or process name. */
  readonly label: string;
  /** Contribution share to the target metric (0..1). Drives bar fill width. */
  readonly contribution?: number;
  /** Optional supporting line shown beneath the label. */
  readonly hint?: string;
  /**
   * Layer index (0-based). Layer 0 renders on the left; the target
   * metric is the largest layer index. The component wraps nodes by
   * layer column so DAG depth is visually obvious.
   */
  readonly layer: number;
  /** Highlights the node as the dominant root cause. */
  readonly primary?: boolean;
}

export interface CausalDAGEdge {
  readonly from: string;
  readonly to: string;
  readonly strength?: number; // 0..1 — drives stroke opacity
}

export interface CausalDAGProps {
  readonly nodes: readonly CausalDAGNode[];
  readonly edges: readonly CausalDAGEdge[];
  readonly className?: string;
}

/**
 * CausalDAGViewer — a tiny static layered DAG viewer.
 *
 * Lays out nodes column-by-column based on their `layer` and connects
 * them with smooth bezier edges weighted by `strength`. Pure SVG so
 * it scales cleanly inside a tab and prints well on a compliance PDF.
 *
 * Spec §10.4 + §12.1 (causal root-cause attribution research extension).
 */
export function CausalDAG({ nodes, edges, className }: CausalDAGProps): ReactNode {
  const layers = Math.max(0, ...nodes.map((n) => n.layer));
  const grouped: CausalDAGNode[][] = Array.from({ length: layers + 1 }, () => []);
  for (const node of nodes) grouped[node.layer]?.push(node);

  const nodeWidth = 230;
  const nodeHeight = 78;
  const colGap = 60;
  const rowGap = 14;

  const colHeights = grouped.map(
    (col) => col.length * nodeHeight + Math.max(0, col.length - 1) * rowGap,
  );
  const totalHeight = Math.max(...colHeights, nodeHeight) + 24;
  const totalWidth = (layers + 1) * nodeWidth + layers * colGap + 16;

  const positions = new Map<string, { readonly x: number; readonly y: number }>();
  grouped.forEach((col, layerIdx) => {
    const colHeight = colHeights[layerIdx] ?? 0;
    const yOffset = (totalHeight - colHeight) / 2;
    col.forEach((node, rowIdx) => {
      positions.set(node.id, {
        x: 8 + layerIdx * (nodeWidth + colGap),
        y: yOffset + rowIdx * (nodeHeight + rowGap),
      });
    });
  });

  return (
    <figure
      aria-label="Causal DAG of root causes"
      className={cn("aegis-card overflow-x-auto p-5", className)}
    >
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        role="img"
        aria-label="causal directed acyclic graph"
        className="overflow-visible"
      >
        {/* Edges first so nodes paint on top */}
        {edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const fromX = from.x + nodeWidth;
          const fromY = from.y + nodeHeight / 2;
          const toX = to.x;
          const toY = to.y + nodeHeight / 2;
          const midX = (fromX + toX) / 2;
          const path = `M${fromX.toFixed(2)},${fromY.toFixed(2)} C${midX.toFixed(2)},${fromY.toFixed(2)} ${midX.toFixed(2)},${toY.toFixed(2)} ${toX.toFixed(2)},${toY.toFixed(2)}`;
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={path}
              fill="none"
              stroke="var(--aegis-fg-tertiary)"
              strokeWidth={1.5}
              opacity={(edge.strength ?? 0.5) * 0.9 + 0.1}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const contribution = node.contribution ?? 0;
          const fillOpacity = 0.06 + contribution * 0.5;
          const strokeColor = node.primary
            ? "var(--aegis-severity-high)"
            : "var(--aegis-stroke-strong)";
          return (
            <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                x={0}
                y={0}
                width={nodeWidth}
                height={nodeHeight}
                rx={6}
                ry={6}
                fill="var(--aegis-surface-2)"
                stroke={strokeColor}
                strokeWidth={node.primary ? 1.5 : 1}
              />
              {node.contribution !== undefined ? (
                <rect
                  x={0}
                  y={nodeHeight - 4}
                  width={nodeWidth * contribution}
                  height={4}
                  rx={0}
                  fill={node.primary ? "var(--aegis-severity-high)" : "var(--aegis-accent)"}
                  opacity={fillOpacity + 0.4}
                />
              ) : null}
              <text
                x={14}
                y={26}
                fill="var(--aegis-fg-primary)"
                style={{
                  fontSize: "11px",
                  fontFamily: "var(--aegis-font-sans)",
                  fontWeight: 600,
                }}
              >
                {node.label}
              </text>
              {node.contribution !== undefined ? (
                <text
                  x={14}
                  y={44}
                  fill={node.primary ? "var(--aegis-severity-high)" : "var(--aegis-accent-strong)"}
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--aegis-font-mono)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {(contribution * 100).toFixed(0)}% contribution
                </text>
              ) : null}
              {node.hint ? (
                <text
                  x={14}
                  y={node.contribution !== undefined ? 60 : 44}
                  fill="var(--aegis-fg-tertiary)"
                  style={{
                    fontSize: "10px",
                    fontFamily: "var(--aegis-font-mono)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {truncate(node.hint, 36)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
