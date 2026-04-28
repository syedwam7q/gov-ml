import type { ReactNode } from "react";

import { EmptyState } from "@aegis/ui";

interface PageStubProps {
  /** Route label, e.g. "Fleet". */
  readonly label: string;
  /** Two-line description shown under the label. */
  readonly description: string;
  /** Phase that will replace this stub (e.g. "phase 4d"). */
  readonly arrivingIn: string;
  /** Pictogram from `@aegis/ui` icons. */
  readonly icon?: ReactNode;
}

/**
 * PageStub — the "this page lands in phase X" placeholder used by every
 * route until its real implementation arrives. Renders a calm EmptyState
 * inside the (app) chrome so navigation, command palette, and shortcuts
 * all behave correctly during Phase 4b.
 */
export function PageStub({ label, description, arrivingIn, icon }: PageStubProps): ReactNode {
  return (
    <section className="mx-auto flex w-full max-w-aegis-content flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="aegis-mono-label">{label.toUpperCase()}</p>
        <h1 className="text-aegis-2xl font-semibold tracking-aegis-tight text-aegis-fg">{label}</h1>
        <p className="max-w-2xl text-aegis-sm text-aegis-fg-2">{description}</p>
      </header>
      <EmptyState
        icon={icon}
        title={`COMING · ${arrivingIn.toUpperCase()}`}
        description="The chrome, command palette (⌘J), and assistant drawer (⌘K) are live now. The page body fills in once the underlying service surfaces are in place."
      />
    </section>
  );
}
