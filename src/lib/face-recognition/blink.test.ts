import { describe, expect, it } from "vitest";

import { advanceBlink, createBlinkState, type BlinkState } from "./blink";
import { FACE_RECOGNITION_CONFIG, type BlinkConfig } from "./config";

const config: BlinkConfig = FACE_RECOGNITION_CONFIG.blink;
const OPEN = 0.3;
const CLOSED = 0.12;

function run(ears: number[], { start = 0, step = 60, settings = config } = {}): BlinkState {
  let state = createBlinkState(start);
  ears.forEach((ear, index) => { state = advanceBlink(state, ear, start + (index + 1) * step, settings); });
  return state;
}

const repeat = (ear: number, count: number) => Array.from({ length: count }, () => ear);

describe("blink challenge", () => {
  it("passes an open → closed → open sequence", () => {
    const state = run([...repeat(OPEN, config.minOpenFramesBefore), ...repeat(CLOSED, config.minClosedFrames), ...repeat(OPEN, config.minOpenFramesAfter)]);
    expect(state.phase).toBe("passed");
  });

  it("does not pass while the eyes stay open", () => {
    expect(run(repeat(OPEN, 40)).phase).toBe("open");
  });

  it("does not pass on ordinary landmark jitter around the open level", () => {
    const jitter = Array.from({ length: 60 }, (_, index) => OPEN * (index % 2 === 0 ? 0.95 : 1.05));
    expect(run(jitter).phase).toBe("open");
  });

  it("does not pass when the eyes are closed at the start", () => {
    // Closed first, then opening, is not a blink: the eyes must be seen open and then close.
    expect(run([...repeat(CLOSED, 5), ...repeat(OPEN, 5)]).phase).not.toBe("passed");
    expect(run(repeat(CLOSED, 30)).phase).not.toBe("passed");
  });

  it("needs a full blink after eyes that started closed have opened", () => {
    const state = run([...repeat(CLOSED, 4), ...repeat(OPEN, 10), ...repeat(CLOSED, config.minClosedFrames), ...repeat(OPEN, config.minOpenFramesAfter)]);
    expect(state.phase).toBe("passed");
  });

  it("detects a blink for narrow eyes whose open EAR is below typical fixed thresholds", () => {
    // Open ≈ 0.21 and the landmarks only dip to ≈ 0.16 during the blink.
    const state = run([...repeat(0.21, config.minOpenFramesBefore), 0.16, ...repeat(0.21, config.minOpenFramesAfter)]);
    expect(state.phase).toBe("passed");
  });

  it("detects a shallow blink for wide eyes", () => {
    const state = run([...repeat(0.36, config.minOpenFramesBefore), 0.28, ...repeat(0.35, config.minOpenFramesAfter)]);
    expect(state.phase).toBe("passed");
  });

  it("follows a slowly drifting open-eye level", () => {
    // Leaning in raises EAR gradually; the blink is judged against the new level (0.2 would not
    // count as closed against the starting level of ≈ 0.224).
    const drift = Array.from({ length: 20 }, (_, index) => 0.22 + index * 0.004);
    const state = run([...drift, 0.2, 0.3]);
    expect(state.phase).toBe("passed");
  });

  it("ignores a closure shorter than the configured minimum closed frames", () => {
    const strict = { ...config, minClosedFrames: 3 };
    expect(run([...repeat(OPEN, strict.minOpenFramesBefore), ...repeat(CLOSED, 2), ...repeat(OPEN, 5)], { settings: strict }).phase).toBe("open");
  });

  it("does not count a half-closed (ambiguous) frame as reopening", () => {
    const state = run([...repeat(OPEN, config.minOpenFramesBefore), CLOSED, OPEN * 0.87, OPEN * 0.87]);
    expect(state.phase).toBe("closed");
  });

  it("times out without a blink", () => {
    expect(run(repeat(OPEN, 10), { step: config.timeoutMs / 5 }).phase).toBe("timed_out");
  });

  it("stays terminal after passing", () => {
    const passed = { ...createBlinkState(0), phase: "passed" as const };
    expect(advanceBlink(passed, CLOSED, 10, config)).toBe(passed);
  });
});
