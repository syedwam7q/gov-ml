/**
 * Lock the codegen surface: every wire type the dashboard reads or writes
 * must appear in the generated `src/index.ts`. If a name disappears, this
 * test fails — and the dashboard's typecheck fails minutes later.
 *
 * Source of truth: `packages/shared-py/tests/test_schemas_complete.py`
 * (the Python side keeps the same list).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SOURCE = readFileSync(resolve(HERE, "..", "src", "index.ts"), "utf8");

const REQUIRED_WIRE_TYPES = [
  "Model",
  "ModelVersion",
  "GovernanceDecision",
  "Approval",
  "DriftSignal",
  "Policy",
  "CandidateAction",
  "CausalAttribution",
  "ModelKPI",
  "KPIPoint",
  "ActivityEvent",
  "AuditRow",
  "AuditPage",
  "ChainVerificationResult",
  "Dataset",
  "ComplianceMapping",
] as const;

describe("@aegis/shared-ts generated contract", () => {
  for (const name of REQUIRED_WIRE_TYPES) {
    test(`exports ${name}`, () => {
      // Match either `export interface Foo` or `export type Foo`.
      const pattern = new RegExp(`export\\s+(?:interface|type)\\s+${name}\\b`);
      expect(SOURCE).toMatch(pattern);
    });
  }

  test("declares the auto-generated banner", () => {
    expect(SOURCE).toMatch(/AUTO-GENERATED FILE — do not edit\./);
  });
});
