"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CloseIcon, Kbd, SearchIcon, cn } from "@aegis/ui";

import { ROUTES } from "../../_lib/routes";

interface CommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * CommandPalette — the Cmd+J fast-nav surface. Spec §10.2.
 *
 * Renders a centered dialog with a search input and an action list.
 * Actions are derived from the route registry — adding a new route
 * automatically makes it searchable. Keyboard navigation:
 *
 *   • Up/Down to move
 *   • Enter to invoke
 *   • Esc to close
 *   • ⌘J to toggle (handled in `AppChromeShell`)
 *
 * Filter logic is a tiny prefix + substring match — sufficient for
 * the ~15 actions we ship; replace with `cmdk` if the action count
 * grows past 50.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps): ReactNode {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightIndex(0);
      const id = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ROUTES;
    return ROUTES.filter((item) => {
      const label = item.label.toLowerCase();
      const path = item.href.toLowerCase();
      return label.includes(q) || path.includes(q);
    });
  }, [query]);

  useEffect(() => {
    if (highlightIndex >= filtered.length) {
      setHighlightIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, highlightIndex]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((idx) => (filtered.length === 0 ? 0 : (idx + 1) % filtered.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((idx) =>
        filtered.length === 0 ? 0 : (idx - 1 + filtered.length) % filtered.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = filtered[highlightIndex];
      if (target) {
        router.push(target.href);
        onClose();
      }
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      onKeyDown={onKeyDown}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-aegis-bg/95 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl rounded-aegis-card border border-aegis-stroke-strong bg-aegis-surface-overlay shadow-2xl">
        <div className="flex items-center gap-3 border-b border-aegis-stroke px-4">
          <span className="text-aegis-fg-3" aria-hidden>
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search routes, decisions, models…"
            className="h-12 flex-1 bg-transparent text-aegis-base text-aegis-fg placeholder:text-aegis-fg-3 focus:outline-none"
            aria-label="Search"
          />
          <span className="hidden items-center gap-1 sm:flex" aria-hidden>
            <Kbd>Esc</Kbd>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-aegis-control text-aegis-fg-3 hover:text-aegis-fg sm:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <ul role="listbox" aria-label="Commands" className="max-h-[60vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-aegis-sm text-aegis-fg-3">No commands match.</li>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const active = idx === highlightIndex;
              return (
                <li key={item.key} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(item.href);
                      onClose();
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-aegis-sm transition-colors",
                      active
                        ? "bg-aegis-accent-soft text-aegis-fg"
                        : "text-aegis-fg-2 hover:bg-aegis-surface-3",
                    )}
                  >
                    <Icon
                      className={cn("shrink-0", active ? "text-aegis-accent" : "text-aegis-fg-3")}
                    />
                    <span className="truncate">{item.label}</span>
                    <span className="ml-auto aegis-mono text-aegis-xs text-aegis-fg-3">
                      {item.href}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-aegis-stroke px-4 py-2 text-aegis-xs text-aegis-fg-3">
          <span className="aegis-mono uppercase tracking-aegis-mono">Cmd+J · Navigate</span>
          <span className="flex items-center gap-1.5" aria-hidden>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span>move</span>
            <Kbd>↵</Kbd>
            <span>open</span>
          </span>
        </div>
      </div>
    </div>
  );
}
