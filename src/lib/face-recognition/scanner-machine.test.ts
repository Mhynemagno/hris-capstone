import { describe, expect, it } from "vitest";

import type { FaceAttendanceResult } from "@/schemas/face-recognition";

import { FACE_RECOGNITION_CONFIG } from "./config";
import { createScannerReducer, initialScannerState, isDetecting, type ScannerEvent, type ScannerState } from "./scanner-machine";

const reduce = createScannerReducer(FACE_RECOGNITION_CONFIG);
const play = (events: ScannerEvent[], from: ScannerState = initialScannerState) => events.reduce(reduce, from);

const result = (outcome: FaceAttendanceResult["outcome"], message: string | null = null): FaceAttendanceResult => ({
  scanId: "8a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  outcome,
  message,
  distance: outcome === "not_recognized" ? 0.71 : 0.31,
  employee: outcome === "not_recognized" ? null : { id: "3f1e2d3c-4b5a-4968-8776-655443322110", employeeNumber: "PAT-001", firstName: "Ana", lastName: "One" },
  log: null,
  recordedAt: "2026-09-25T00:00:00Z",
});

const stable = Array.from({ length: FACE_RECOGNITION_CONFIG.stableFramesBeforeLiveness }, (_, index): ScannerEvent => ({ type: "FRAME_ACCEPTED", now: index }));
const blink = [0.3, 0.3, 0.3, 0.1, 0.1, 0.3, 0.3].map((ear, index): ScannerEvent => ({ type: "LIVENESS_FRAME", ear, now: 100 + index * 60 }));
const toVerifying: ScannerEvent[] = [{ type: "INIT_SUCCEEDED" }, { type: "START" }, ...stable, ...blink];

describe("scanner state machine", () => {
  it("walks the full happy path to cooldown and back to searching", () => {
    const verifying = play(toVerifying);
    expect(verifying.status).toBe("verifying");
    const recording = reduce(verifying, { type: "DESCRIPTOR_READY", scanId: "scan-1" });
    expect(recording).toEqual({ status: "recording", scanId: "scan-1" });
    const success = reduce(recording, { type: "RECORD_SUCCEEDED", result: result("time_in") });
    expect(success.status).toBe("success");
    const cooldown = reduce(success, { type: "DISPLAY_ELAPSED" });
    expect(cooldown.status).toBe("cooldown");
    expect(isDetecting(cooldown)).toBe(false);
    expect(reduce(cooldown, { type: "COOLDOWN_ELAPSED" }).status).toBe("searching");
  });

  it("requires several consecutive stable frames before the blink challenge", () => {
    const state = play([{ type: "INIT_SUCCEEDED" }, { type: "START" }, stable[0], { type: "FRAME_REJECTED", guidance: "Move closer to the camera." }, stable[0]]);
    expect(state).toMatchObject({ status: "searching", stableFrames: 1 });
  });

  it("never reaches the descriptor step before the blink passes", () => {
    const state = play([{ type: "INIT_SUCCEEDED" }, { type: "START" }, ...stable, { type: "DESCRIPTOR_READY", scanId: "early" }]);
    expect(state.status).toBe("liveness");
  });

  it("returns to searching when the face is lost during the blink challenge", () => {
    const state = play([{ type: "INIT_SUCCEEDED" }, { type: "START" }, ...stable, { type: "FACE_LOST", guidance: "More than one face is visible." }]);
    expect(state).toMatchObject({ status: "searching", guidance: "More than one face is visible." });
  });

  it("fails the blink challenge on timeout", () => {
    const state = play([{ type: "INIT_SUCCEEDED" }, { type: "START" }, ...stable, { type: "LIVENESS_FRAME", ear: 0.3, now: FACE_RECOGNITION_CONFIG.blink.timeoutMs + 10 }]);
    expect(state).toMatchObject({ status: "error", kind: "liveness_timeout", fatal: false });
  });

  it("shows 'Face not recognized' for an unknown face", () => {
    const state = play([...toVerifying, { type: "DESCRIPTOR_READY", scanId: "s" }, { type: "RECORD_SUCCEEDED", result: result("not_recognized") }]);
    expect(state).toMatchObject({ status: "error", kind: "not_recognized", message: "Face not recognized.", distance: 0.71 });
  });

  it("shows the attendance rule message when the server rejects the scan", () => {
    const state = play([...toVerifying, { type: "DESCRIPTOR_READY", scanId: "s" }, { type: "RECORD_SUCCEEDED", result: result("already_recorded", "Time in is already recorded.") }]);
    expect(state).toMatchObject({ status: "error", kind: "rule_rejected", message: "Time in is already recorded." });
  });

  it("reports network failures and moves on to cooldown", () => {
    const state = play([...toVerifying, { type: "DESCRIPTOR_READY", scanId: "s" }, { type: "RECORD_FAILED", message: "Unable to reach the attendance service.", retryable: true }]);
    expect(state).toMatchObject({ status: "error", kind: "network" });
    expect(reduce(state, { type: "DISPLAY_ELAPSED" }).status).toBe("cooldown");
  });

  it("labels a database rejection separately from a connection problem", () => {
    const state = play([...toVerifying, { type: "DESCRIPTOR_READY", scanId: "s" }, { type: "RECORD_FAILED", message: "HR access is required.", retryable: false }]);
    expect(state).toMatchObject({ status: "error", kind: "service", message: "HR access is required." });
  });

  it("ends the blink challenge from the watchdog even without frames", () => {
    const state = play([{ type: "INIT_SUCCEEDED" }, { type: "START" }, ...stable, { type: "LIVENESS_EXPIRED" }]);
    expect(state).toMatchObject({ status: "error", kind: "liveness_timeout" });
    expect(reduce(play([{ type: "INIT_SUCCEEDED" }, { type: "START" }]), { type: "LIVENESS_EXPIRED" }).status).toBe("searching");
  });

  it("ignores late events that do not belong to the current state", () => {
    const searching = play([{ type: "INIT_SUCCEEDED" }, { type: "START" }]);
    expect(reduce(searching, { type: "RECORD_SUCCEEDED", result: result("time_in") })).toBe(searching);
    expect(reduce(searching, { type: "COOLDOWN_ELAPSED" })).toBe(searching);
    const recording = play([...toVerifying, { type: "DESCRIPTOR_READY", scanId: "s" }]);
    expect(reduce(recording, { type: "DESCRIPTOR_READY", scanId: "second" })).toBe(recording);
  });

  it("keeps fatal camera and model errors until retried", () => {
    const failed = reduce(initialScannerState, { type: "INIT_FAILED", kind: "camera_denied", message: "Camera access was denied." });
    expect(failed).toMatchObject({ status: "error", fatal: true });
    expect(reduce(failed, { type: "DISPLAY_ELAPSED" })).toBe(failed);
    expect(reduce(failed, { type: "STOP" })).toBe(failed);
    expect(reduce(failed, { type: "RETRY" }).status).toBe("initializing");
  });

  it("stops with a fatal error when the camera is lost while running", () => {
    for (const state of [play([{ type: "INIT_SUCCEEDED" }]), play([{ type: "INIT_SUCCEEDED" }, { type: "START" }]), play([{ type: "INIT_SUCCEEDED" }, { type: "START" }, ...stable])]) {
      expect(reduce(state, { type: "CAMERA_LOST", message: "The camera was turned off." })).toMatchObject({ status: "error", kind: "camera_unavailable", fatal: true });
    }
    expect(reduce(initialScannerState, { type: "CAMERA_LOST", message: "x" })).toBe(initialScannerState);
  });

  it("pauses to ready from a running state", () => {
    const liveness = play([{ type: "INIT_SUCCEEDED" }, { type: "START" }, ...stable]);
    expect(reduce(liveness, { type: "STOP" }).status).toBe("ready");
  });
});
