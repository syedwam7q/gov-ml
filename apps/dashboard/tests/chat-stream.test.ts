import { describe, expect, it } from "vitest";

import { parseFrames } from "../app/_lib/chat-stream";

/**
 * Regression guards for the SSE parser in `useChatStream`. The
 * original parser split on `\n\n` only — sse_starlette (the Python
 * server backing /chat/stream) emits `\r\n\r\n` per the SSE spec
 * (HTML5 §9.2.6), so every frame was silently dropped in the browser
 * even though curl + Python smoke probes worked because their line
 * iterators normalised line endings. These tests lock the parser's
 * tolerance for all three permitted line terminators.
 */
describe("parseFrames", () => {
  it("parses a CRLF-delimited frame (sse_starlette default)", () => {
    const buffer = 'event: message\r\ndata: {"kind": "final_text", "text": "hi"}\r\n\r\n';
    const { frames, tail } = parseFrames(buffer);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ kind: "final_text", text: "hi" });
    expect(tail).toBe("");
  });

  it("parses an LF-delimited frame (some proxies normalise)", () => {
    const buffer = 'event: message\ndata: {"kind": "final_text", "text": "hi"}\n\n';
    const { frames } = parseFrames(buffer);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ kind: "final_text", text: "hi" });
  });

  it("parses two back-to-back CRLF frames in one buffer", () => {
    const buffer =
      'event: message\r\ndata: {"kind": "tool_call_start", "tool_name": "get_fleet_status", "tool_args": {}}\r\n\r\n' +
      'event: message\r\ndata: {"kind": "final_text", "text": "3 models live."}\r\n\r\n';
    const { frames, tail } = parseFrames(buffer);
    expect(frames).toHaveLength(2);
    expect(frames[0]?.kind).toBe("tool_call_start");
    expect(frames[1]?.kind).toBe("final_text");
    expect(tail).toBe("");
  });

  it("returns an incomplete trailing event in `tail` for the next read", () => {
    const buffer =
      'event: message\r\ndata: {"kind": "tool_call_start", "tool_name": "x", "tool_args": {}}\r\n\r\n' +
      'event: message\r\ndata: {"kind": "final_text", "text'; // truncated
    const { frames, tail } = parseFrames(buffer);
    expect(frames).toHaveLength(1);
    expect(tail).toContain('"final_text"');
  });

  it("accepts `data:` without the space (SSE spec permits both)", () => {
    const buffer = 'event: message\r\ndata:{"kind": "final_text", "text": "ok"}\r\n\r\n';
    const { frames } = parseFrames(buffer);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ kind: "final_text", text: "ok" });
  });

  it("ignores comment lines and event-name lines silently", () => {
    const buffer = ': ping\r\nevent: message\r\ndata: {"kind": "final_text", "text": "yo"}\r\n\r\n';
    const { frames } = parseFrames(buffer);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ kind: "final_text", text: "yo" });
  });

  it("drops malformed JSON without breaking subsequent frames", () => {
    const buffer =
      "event: message\r\ndata: not-json{\r\n\r\n" +
      'event: message\r\ndata: {"kind": "final_text", "text": "recovered"}\r\n\r\n';
    const { frames } = parseFrames(buffer);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ kind: "final_text", text: "recovered" });
  });
});
