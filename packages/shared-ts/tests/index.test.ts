import { describe, expect, it } from "vitest";

import type { AuditRow } from "../src/index.js";

describe("shared-ts generated contract", () => {
  it("exports AuditRow type with the expected shape", () => {
    const fake: AuditRow = {
      sequence_n: 1,
      ts: "2026-04-28T12:00:00Z",
      actor: "system:test",
      action: "test",
      payload: {},
      prev_hash: "0".repeat(64),
      row_hash: "f".repeat(64),
      signature: "a".repeat(64),
    };
    expect(fake.sequence_n).toBe(1);
    expect(fake.row_hash).toHaveLength(64);
  });
});
