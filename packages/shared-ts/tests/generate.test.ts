/**
 * Lock the @aegis/shared-ts wire-type surface.
 *
 * This package exports the **atomic** types every Aegis service shares:
 * five `StrEnum`s and the `AuditRow` shape. The dashboard's UI-composite
 * types (ModelKPI, GovernanceDecision, ActivityEvent, ...) live in
 * `apps/dashboard/app/_lib/types.ts` because they bundle Tinybird
 * rollups and UI-only enrichments.
 *
 * If a name is removed or renamed below, the dashboard's typecheck fails
 * minutes later — that's the schema-is-law guarantee.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SOURCE = readFileSync(resolve(HERE, "..", "src", "index.ts"), "utf8");

const REQUIRED_EXPORTS = [
  "Severity",
  "DecisionState",
  "RiskClass",
  "Role",
  "ModelFamily",
  "AuditRow",
] as const;

describe("@aegis/shared-ts atomic surface", () => {
  for (const name of REQUIRED_EXPORTS) {
    test(`exports ${name}`, () => {
      // Match either `export interface Foo` or `export type Foo`.
      const pattern = new RegExp(`export\\s+(?:interface|type)\\s+${name}\\b`);
      expect(SOURCE).toMatch(pattern);
    });
  }

  test("declares the auto-generated banner", () => {
    expect(SOURCE).toMatch(/AUTO-GENERATED FILE — do not edit\./);
  });

  test("AuditRow has the eight expected fields", () => {
    const expected = [
      "sequence_n",
      "ts",
      "actor",
      "action",
      "payload",
      "prev_hash",
      "row_hash",
      "signature",
    ];
    for (const field of expected) {
      expect(SOURCE).toMatch(new RegExp(`readonly ${field}:`));
    }
  });

  test("Severity enum carries the four canonical levels", () => {
    expect(SOURCE).toMatch(/Severity = "LOW" \| "MEDIUM" \| "HIGH" \| "CRITICAL"/);
  });

  test("DecisionState enum carries all six lifecycle states", () => {
    for (const state of [
      "detected",
      "analyzed",
      "planned",
      "awaiting_approval",
      "executing",
      "evaluated",
    ]) {
      expect(SOURCE).toContain(`"${state}"`);
    }
  });
});
