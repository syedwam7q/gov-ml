/* eslint-disable */
// AUTO-GENERATED FILE — do not edit.
// Source of truth: packages/shared-py/src/aegis_shared/
// Regenerate with: pnpm --filter @aegis/shared-ts generate

export type SequenceN = number;
export type Ts = string;
export type Actor = string;
export type Action = string;
export type PrevHash = string;
export type RowHash = string;
export type Signature = string;

/**
 * One row in the immutable, Merkle-chained audit log.
 */
export interface AuditRow {
  sequence_n: SequenceN;
  ts: Ts;
  actor: Actor;
  action: Action;
  payload: Payload;
  prev_hash: PrevHash;
  row_hash: RowHash;
  signature: Signature;
}
export interface Payload {
  [k: string]: unknown;
}

