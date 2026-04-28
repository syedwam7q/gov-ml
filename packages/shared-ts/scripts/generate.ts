/**
 * Generates `src/index.ts` from `aegis_shared` (Python).
 *
 * Scope of this package: the **atomic** wire-type surface the dashboard
 * shares with the control plane — five `StrEnum`s (Severity, DecisionState,
 * RiskClass, Role, ModelFamily) plus the `AuditRow` shape. UI-composite
 * types (ModelKPI, GovernanceDecision, ActivityEvent, ...) live in the
 * dashboard at `apps/dashboard/app/_lib/types.ts` because they bundle
 * Tinybird-derived rollups and UI-only enrichments — not pure DB rows.
 *
 * Why so small? `json-schema-to-typescript` produces noisy output when
 * fed Pydantic's full schema (per-property aux aliases, duplicate enums).
 * Generating only the atomic types keeps `src/index.ts` 30 lines of
 * clean TS that the human can read at a glance.
 *
 * The list of names is locked from the Python side in
 * `packages/shared-py/tests/test_schemas_complete.py` (which lists every
 * Pydantic export) and from the TS side in
 * `packages/shared-ts/tests/generate.test.ts` (which lists what shared-ts
 * promises). The dashboard depends on the TS list only.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(PKG_DIR, "..", "..");
const OUT = resolve(PKG_DIR, "src", "index.ts");

const PY_EXPORT = `
import json
from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity
from aegis_shared.audit import AuditRow

# AuditRow has six string fields plus a few primitives — read its schema for
# the canonical field list. We deliberately don't try to materialize it here;
# Pydantic's schema gives us the source-of-truth field set.
audit_schema = AuditRow.model_json_schema()
audit_props = list(audit_schema.get("properties", {}).keys())
audit_required = list(audit_schema.get("required", []))

print(json.dumps({
    "enums": {
        "DecisionState": [v.value for v in DecisionState],
        "ModelFamily":   [v.value for v in ModelFamily],
        "RiskClass":     [v.value for v in RiskClass],
        "Role":          [v.value for v in Role],
        "Severity":      [v.value for v in Severity],
    },
    "audit_row": {
        "properties": audit_props,
        "required":   audit_required,
    },
}))
`;

interface PyExport {
  readonly enums: Record<string, readonly string[]>;
  readonly audit_row: {
    readonly properties: readonly string[];
    readonly required: readonly string[];
  };
}

function exportSchemas(): PyExport {
  // execFileSync — no shell, no injection surface, fixed argv.
  const out = execFileSync("uv", ["run", "python", "-c", PY_EXPORT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return JSON.parse(out) as PyExport;
}

/** Lock the AuditRow shape — fail fast if Pydantic adds / drops a field. */
const EXPECTED_AUDIT_ROW_FIELDS = [
  "sequence_n",
  "ts",
  "actor",
  "action",
  "payload",
  "prev_hash",
  "row_hash",
  "signature",
] as const;

function main(): void {
  const { enums, audit_row } = exportSchemas();

  const actual = audit_row.properties.slice().sort();
  const expected = [...EXPECTED_AUDIT_ROW_FIELDS].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `AuditRow shape drift detected.\n` +
        `  Expected: ${JSON.stringify(expected)}\n` +
        `  Actual:   ${JSON.stringify(actual)}\n` +
        `Update EXPECTED_AUDIT_ROW_FIELDS in scripts/generate.ts after intentional schema changes.`,
    );
  }

  const banner =
    "/* eslint-disable */\n" +
    "// AUTO-GENERATED FILE — do not edit.\n" +
    "// Source of truth: packages/shared-py/src/aegis_shared/\n" +
    "// Regenerate with: pnpm --filter @aegis/shared-ts generate\n";

  const enumLines = Object.entries(enums)
    .map(
      ([name, values]) =>
        `export type ${name} = ${values.map((v) => JSON.stringify(v)).join(" | ")};`,
    )
    .join("\n");

  // AuditRow shape — hand-rolled from the lock list above. Pydantic's runtime
  // contract guarantees the shape matches; the field-set check above guards
  // against silent drift.
  const auditRow = `/**
 * One row in the immutable, Merkle-chained audit log.
 *
 * Mirrors \`aegis_shared.audit.AuditRow\` exactly. Drift between Python
 * and TypeScript is detected at codegen time (see EXPECTED_AUDIT_ROW_FIELDS).
 */
export interface AuditRow {
  /** Strictly increasing sequence number, starting at 1. */
  readonly sequence_n: number;
  /** ISO-8601 timestamp string. */
  readonly ts: string;
  /** \`system:<service>\` or \`user:<clerk_id>\`. */
  readonly actor: string;
  /** Action verb — \`detect\`, \`analyze\`, \`plan\`, \`approval\`, \`execute\`, \`evaluate\`, ... */
  readonly action: string;
  /** Free-form payload — canonical JSON serialization is what the chain hashes. */
  readonly payload: Record<string, unknown>;
  /** 64 hex chars; \`"0".repeat(64)\` for the genesis row. */
  readonly prev_hash: string;
  /** 64 hex chars — SHA-256 of (prev_hash || canonical_payload || ts || actor || action || sequence_n). */
  readonly row_hash: string;
  /** 64 hex chars — HMAC-SHA256 of row_hash with the platform secret. */
  readonly signature: string;
}`;

  const out = `${banner}\n${enumLines}\n\n${auditRow}\n`;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out, "utf8");
  console.log("✓ wrote", OUT);
}

main();
