import type { BlinkConfig } from "./config";

/**
 * Blink challenge: the eyes must be seen open, then closed, then open again, each for several
 * consecutive frames, before the timeout. Eyes that are already closed when the challenge
 * starts never satisfy the first phase.
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
  /** Mean EAR of the initial open frames; used to adapt the closed cut-off per person. */
  baseline: number | null;
  baselineTotal: number;
  lastEar: number | null;
};

export function createBlinkState(now: number): BlinkState {
  return { phase: "awaiting_open", startedAt: now, openFrames: 0, closedFrames: 0, reopenFrames: 0, baseline: null, baselineTotal: 0, lastEar: null };
}

function isClosed(ear: number, state: BlinkState, config: BlinkConfig) {
  const cutoff = state.baseline === null ? config.earClosedThreshold : Math.max(config.earClosedThreshold, state.baseline * config.closedBaselineRatio);
  return ear <= cutoff;
}

function isOpen(ear: number, state: BlinkState, config: BlinkConfig) {
  return ear >= config.earOpenThreshold && !isClosed(ear, state, config);
}

/** Advances the challenge by one frame's mean eye aspect ratio. */
export function advanceBlink(state: BlinkState, ear: number, now: number, config: BlinkConfig): BlinkState {
  if (state.phase === "passed" || state.phase === "timed_out") return state;
  if (now - state.startedAt > config.timeoutMs) return { ...state, phase: "timed_out", lastEar: ear };

  const next: BlinkState = { ...state, lastEar: ear };
  switch (state.phase) {
    case "awaiting_open": {
      // Judged on the absolute threshold only: there is no baseline yet.
      if (ear >= config.earOpenThreshold) {
        next.openFrames = state.openFrames + 1;
        next.baselineTotal = state.baselineTotal + ear;
        if (next.openFrames >= config.minOpenFramesBefore) {
          next.phase = "open";
          next.baseline = next.baselineTotal / next.openFrames;
        }
      } else {
        next.openFrames = 0;
        next.baselineTotal = 0;
      }
      return next;
    }
    case "open": {
      if (isClosed(ear, state, config)) {
        next.phase = "closed";
        next.closedFrames = 1;
      }
      return next;
    }
    case "closed": {
      if (isClosed(ear, state, config)) {
        next.closedFrames = state.closedFrames + 1;
      } else if (isOpen(ear, state, config)) {
        if (state.closedFrames >= config.minClosedFrames) {
          next.phase = "reopening";
          next.reopenFrames = 1;
          if (next.reopenFrames >= config.minOpenFramesAfter) next.phase = "passed";
        } else {
          // Too short to count as a deliberate blink (likely landmark noise).
          next.phase = "open";
          next.closedFrames = 0;
        }
      }
      return next;
    }
    case "reopening": {
      if (isOpen(ear, state, config)) {
        next.reopenFrames = state.reopenFrames + 1;
        if (next.reopenFrames >= config.minOpenFramesAfter) next.phase = "passed";
      } else if (isClosed(ear, state, config)) {
        next.phase = "closed";
        next.closedFrames = 1;
        next.reopenFrames = 0;
      }
      return next;
    }
  }
}
