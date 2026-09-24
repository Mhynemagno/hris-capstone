import { describe, expect, it } from "vitest";

import { advanceBlink, createBlinkState, type BlinkState } from "./blink";
import { FACE_RECOGNITION_CONFIG } from "./config";

const config = FACE_RECOGNITION_CONFIG.blink;
const OPEN = 0.3;
const CLOSED = 0.12;

function run(ears: number[], { start = 0, step = 60 } = {}): BlinkState {
  let state = createBlinkState(start);
  ears.forEach((ear, index) => { state = advanceBlink(state, ear, start + (index + 1) * step, config); });
  return state;
}

const repeat = (ear: number, count: number) => Array.from({ length: count }, () => ear);

describe("blink challenge", () => {
  it("passes an open → closed → open sequence over multiple frames", () => {
    const state = run([...repeat(OPEN, config.minOpenFramesBefore), ...repeat(CLOSED, config.minClosedFrames), ...repeat(OPEN, config.minOpenFramesAfter)]);
    expect(state.phase).toBe("passed");
  });

  it("does not pass while the eyes stay open", () => {
    expect(run(repeat(OPEN, 40)).phase).toBe("open");
  });

  it("does not pass when the eyes are closed at the start", () => {
    // Closed first, then opening once, is not a blink: the eyes must be seen open first.
    expect(run([...repeat(CLOSED, 5), ...repeat(OPEN, config.minOpenFramesAfter)]).phase).not.toBe("passed");
    expect(run(repeat(CLOSED, 30)).phase).toBe("awaiting_open");
  });

  it("needs a full blink after eyes that started closed have opened", () => {
    const state = run([...repeat(CLOSED, 4), ...repeat(OPEN, config.minOpenFramesBefore), ...repeat(CLOSED, config.minClosedFrames), ...repeat(OPEN, config.minOpenFramesAfter)]);
    expect(state.phase).toBe("passed");
  });

  it("ignores a closure shorter than the configured minimum closed frames", () => {
    const strict = { ...config, minClosedFrames: 3 };
    let state = createBlinkState(0);
    [...repeat(OPEN, strict.minOpenFramesBefore), ...repeat(CLOSED, 2), ...repeat(OPEN, 5)].forEach((ear, index) => { state = advanceBlink(state, ear, (index + 1) * 60, strict); });
    expect(state.phase).toBe("open");
  });

  it("does not count a half-closed (ambiguous) frame as reopening", () => {
    const state = run([...repeat(OPEN, config.minOpenFramesBefore), ...repeat(CLOSED, config.minClosedFrames), 0.22, 0.22]);
    expect(state.phase).toBe("closed");
  });

  it("adapts the closed cut-off to the person's open-eye baseline", () => {
    // Baseline 0.4 → anything at or below 0.288 counts as closed, even above the absolute 0.19.
    const state = run([...repeat(0.4, config.minOpenFramesBefore), ...repeat(0.26, config.minClosedFrames), ...repeat(0.4, config.minOpenFramesAfter)]);
    expect(state.phase).toBe("passed");
  });

  it("times out without a blink", () => {
    expect(run(repeat(OPEN, 10), { step: config.timeoutMs / 5 }).phase).toBe("timed_out");
  });

  it("stays terminal after passing", () => {
    const passed = { ...createBlinkState(0), phase: "passed" as const };
    expect(advanceBlink(passed, CLOSED, 10, config)).toBe(passed);
  });
});
