/**
 * Generates `src/index.ts` from JSON Schemas exported by aegis-shared (Python).
 *
 * Approach: invoke `uv run python -c "..."` (via `execFileSync`, no shell)
 * to import every Pydantic schema, call `model_json_schema()` on each, and
 * run `compile` from json-schema-to-typescript over the result. Five
 * `StrEnum` types from `aegis_shared.types` are emitted as string-literal
 * unions so downstream code gets compile-time exhaustiveness checks.
 *
 * The list below is the canonical wire-type surface — the same list is
 * locked from the Python side in `tests/test_schemas_complete.py` and
 * from the TS side in `tests/generate.test.ts`. Drift between any two
 * lists is a hard test failure.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "json-schema-to-typescript";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(PKG_DIR, "..", "..");
const OUT = resolve(PKG_DIR, "src", "index.ts");

/**
 * Inline Python that imports every schema and prints a JSON Schema dict.
 *
 * Order matters for codegen: emit referenced models BEFORE the models
 * that reference them so `json-schema-to-typescript` resolves `$ref`s
 * cleanly. We also emit the StrEnum types as standalone string-literal
 * unions — Pydantic does not include them in `$defs` for top-level
 * fields typed as the enum directly.
 */
const PY_EXPORT = `
import json
from aegis_shared import schemas as s
from aegis_shared.types import DecisionState, ModelFamily, RiskClass, Role, Severity

# Order: enums first, then leaf models, then composites that reference them.
ordered = [
    ("AuditRow", s.AuditRow),
    ("KPIPoint", s.KPIPoint),
    ("CausalRootCause", s.CausalRootCause),
    ("Model", s.Model),
    ("ModelVersion", s.ModelVersion),
    ("DriftSignal", s.DriftSignal),
    ("Policy", s.Policy),
    ("Approval", s.Approval),
    ("CandidateAction", s.CandidateAction),
    ("CausalAttribution", s.CausalAttribution),
    ("ModelKPI", s.ModelKPI),
    ("ActivityEvent", s.ActivityEvent),
    ("AuditPage", s.AuditPage),
    ("ChainVerificationResult", s.ChainVerificationResult),
    ("Dataset", s.Dataset),
    ("ComplianceMapping", s.ComplianceMapping),
    ("GovernanceDecision", s.GovernanceDecision),
]

out: dict[str, dict] = {name: model.model_json_schema() for name, model in ordered}

# Standalone enum unions — emitted as JSON Schema "enum" so codegen
# produces \`export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";\`
out["DecisionState"] = {"title": "DecisionState", "type": "string",
                        "enum": [v.value for v in DecisionState]}
out["ModelFamily"]   = {"title": "ModelFamily",   "type": "string",
                        "enum": [v.value for v in ModelFamily]}
out["RiskClass"]     = {"title": "RiskClass",     "type": "string",
                        "enum": [v.value for v in RiskClass]}
out["Role"]          = {"title": "Role",          "type": "string",
                        "enum": [v.value for v in Role]}
out["Severity"]      = {"title": "Severity",      "type": "string",
                        "enum": [v.value for v in Severity]}

print(json.dumps(out))
`;

function exportSchemas(): Record<string, unknown> {
  // execFileSync — no shell, no injection surface, fixed argv.
  const out = execFileSync("uv", ["run", "python", "-c", PY_EXPORT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return JSON.parse(out) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const schemas = exportSchemas();
  const banner =
    "/* eslint-disable */\n" +
    "// AUTO-GENERATED FILE — do not edit.\n" +
    "// Source of truth: packages/shared-py/src/aegis_shared/schemas.py\n" +
    "// Regenerate with: pnpm --filter @aegis/shared-ts generate\n";

  let out = banner + "\n";
  for (const [name, schema] of Object.entries(schemas)) {
    const ts = await compile(schema as Parameters<typeof compile>[0], name, {
      bannerComment: "",
      style: { semi: true, singleQuote: false, printWidth: 100 },
      additionalProperties: false,
      enableConstEnums: false,
    });
    out += ts + "\n";
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out, "utf8");
  console.log("✓ wrote", OUT);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
