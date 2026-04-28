import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("merges conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-base")).toBe("text-base");
  });

  it("dedupes equivalent classes", () => {
    expect(cn("p-2", "p-2")).toBe("p-2");
  });

  it("keeps Aegis font-size and text-color side-by-side", () => {
    // Default tailwind-merge collapses both as `text-*`. Our extended
    // merger separates `text-aegis-{size}` from `text-aegis-{color}`.
    expect(cn("text-aegis-sm", "text-aegis-fg-2")).toBe("text-aegis-sm text-aegis-fg-2");
    expect(cn("text-aegis-base", "text-aegis-fg")).toBe("text-aegis-base text-aegis-fg");
  });

  it("still resolves conflicts within the Aegis font-size group", () => {
    expect(cn("text-aegis-sm", "text-aegis-base")).toBe("text-aegis-base");
  });
});
