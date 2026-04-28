/* eslint-disable */
// AUTO-GENERATED FILE — do not edit.
// Source of truth: packages/shared-py/src/aegis_shared/
// Regenerate with: pnpm --filter @aegis/shared-ts generate

export type DecisionState = "detected" | "analyzed" | "planned" | "awaiting_approval" | "executing" | "evaluated";
export type ModelFamily = "tabular" | "text";
export type RiskClass = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Role = "viewer" | "operator" | "admin";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * One row in the immutable, Merkle-chained audit log.
 *
 * Mirrors `aegis_shared.audit.AuditRow` exactly. Drift between Python
 * and TypeScript is detected at codegen time (see EXPECTED_AUDIT_ROW_FIELDS).
 */
export interface AuditRow {
  /** Strictly increasing sequence number, starting at 1. */
  readonly sequence_n: number;
  /** ISO-8601 timestamp string. */
  readonly ts: string;
  /** `system:<service>` or `user:<clerk_id>`. */
  readonly actor: string;
  /** Action verb — `detect`, `analyze`, `plan`, `approval`, `execute`, `evaluate`, ... */
  readonly action: string;
  /** Free-form payload — canonical JSON serialization is what the chain hashes. */
  readonly payload: Record<string, unknown>;
  /** 64 hex chars; `"0".repeat(64)` for the genesis row. */
  readonly prev_hash: string;
  /** 64 hex chars — SHA-256 of (prev_hash || canonical_payload || ts || actor || action || sequence_n). */
  readonly row_hash: string;
  /** 64 hex chars — HMAC-SHA256 of row_hash with the platform secret. */
  readonly signature: string;
}
