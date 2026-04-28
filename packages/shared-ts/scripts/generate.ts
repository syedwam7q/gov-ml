/**
 * Generates `src/index.ts` from JSON Schemas exported by aegis-shared (Python).
 *
 * Approach: invoke `uv run python -c "..."` (via `execFileSync`, no shell)
 * to import each Pydantic model and call `Model.model_json_schema()`,
 * then run `compile` from json-schema-to-typescript over each schema.
 *
 * For Phase 0 the only exported schema is `AuditRow`; subsequent phases
 * will add more (drift signal, decision, etc.). The script emits a banner
 * so the generated file is never hand-edited.
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

const PY_EXPORT = `
import json
from aegis_shared.audit import AuditRow

schemas = {"AuditRow": AuditRow.model_json_schema()}
print(json.dumps(schemas, indent=2))
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
    "// Source of truth: packages/shared-py/src/aegis_shared/\n" +
    "// Regenerate with: pnpm --filter @aegis/shared-ts generate\n";

  let out = banner + "\n";
  for (const [name, schema] of Object.entries(schemas)) {
    const ts = await compile(schema as Parameters<typeof compile>[0], name, {
      bannerComment: "",
      style: { semi: true, singleQuote: false, printWidth: 100 },
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
