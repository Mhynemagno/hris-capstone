import type { BlinkConfig } from "./config";

/**
 * Blink challenge: the eyes must be seen open, then closed, then open again before the timeout.
 *
 * "Closed" and "open" are judged relative to the person's own open-eye EAR (the baseline), not
 * against fixed numbers: open-eye EAR from the 68-point landmark model varies a lot between people,
 * glasses and camera angles, and the landmarks rarely close fully during a blink. A blink is an EAR
 * dip to `closedBaselineRatio` of the baseline followed by a recovery to `reopenBaselineRatio`.
 * Eyes that are already closed when the challenge starts give a low baseline that opening the eyes
 * never dips below, so they cannot pass without a real blink afterwards.
 *
 * This is a basic liveness cue for a supervised demonstration. It does not stop a replayed
 * video or a determined spoof and is not production-grade anti-spoofing.
 */
export type BlinkPhase = "awaiting_open" | "open" | "closed" | "reopening" | "passed" | "timed_out";

export type BlinkState = {
  phase: BlinkPhase;
  startedAt: number;
  openFrames: number;
  closedFrames: number;
  reopenFrames: number;
  /** Running estimate of the person's open-eye EAR; the closed and reopen cut-offs scale with it. */
  baseline: number | null;
  baselineTotal: number;
  lastEar: number | null;
};

export function createBlinkState(now: number): BlinkState {
  return { phase: "awaiting_open", startedAt: now, openFrames: 0, closedFrames: 0, reopenFrames: 0, baseline: null, baselineTotal: 0, lastEar: null };
}

function isClosed(ear: number, baseline: number, config: BlinkConfig) {
  return ear <= baseline * config.closedBaselineRatio;
}

function isOpen(ear: number, baseline: number, config: BlinkConfig) {
  return ear >= baseline * config.reopenBaselineRatio;
}

/** Advances the challenge by one frame's mean eye aspect ratio. */
export function advanceBlink(state: BlinkState, ear: number, now: number, config: BlinkConfig): BlinkState {
  if (state.phase === "passed" || state.phase === "timed_out") return state;
  if (now - state.startedAt > config.timeoutMs) return { ...state, phase: "timed_out", lastEar: ear };

  const next: BlinkState = { ...state, lastEar: ear };
  if (state.phase === "awaiting_open") {
    // Only a sanity floor here: it rejects degenerate landmarks, not narrow eyes.
    if (ear < config.minEar) return { ...next, openFrames: 0, baselineTotal: 0 };
    next.openFrames = state.openFrames + 1;
    next.baselineTotal = state.baselineTotal + ear;
    if (next.openFrames >= config.minOpenFramesBefore) {
      next.phase = "open";
      next.baseline = next.baselineTotal / next.openFrames;
    }
    return next;
  }

  const baseline = state.baseline ?? ear;
  switch (state.phase) {
    case "open": {
      if (isClosed(ear, baseline, config)) {
        next.phase = "closed";
        next.closedFrames = 1;
      } else if (isOpen(ear, baseline, config)) {
        // Follow slow drift (leaning in, small head turns) while the eyes are open.
        next.baseline = baseline + (ear - baseline) * config.baselineSmoothing;
      }
      return next;
    }
    case "closed": {
      if (isClosed(ear, baseline, config)) {
        next.closedFrames = state.closedFrames + 1;
      } else if (isOpen(ear, baseline, config)) {
        if (state.closedFrames >= config.minClosedFrames) {
          next.reopenFrames = 1;
          next.phase = next.reopenFrames >= config.minOpenFramesAfter ? "passed" : "reopening";
        } else {
          // Too short to count as a deliberate blink (likely landmark noise).
          next.phase = "open";
          next.closedFrames = 0;
        }
      }
      return next;
    }
    case "reopening": {
      if (isOpen(ear, baseline, config)) {
        next.reopenFrames = state.reopenFrames + 1;
        if (next.reopenFrames >= config.minOpenFramesAfter) next.phase = "passed";
      } else if (isClosed(ear, baseline, config)) {
        next.phase = "closed";
        next.closedFrames = 1;
        next.reopenFrames = 0;
      }
      return next;
    }
  }
}
