import type { FaceRecognitionConfig } from "./config";
import type { FaceAttendanceResult } from "@/schemas/face-recognition";

/**
 * Kiosk state machine. Exactly one state is active; events that do not apply to the current
 * state are ignored, so a late async result can never move the scanner backwards or overlap
 * two phases.
 *
 * INITIALIZING → READY → SEARCHING → VERIFYING → RECORDING → SUCCESS | ERROR → COOLDOWN → SEARCHING
 *
 * There is no liveness (blink) challenge: a clearly framed single face is read and matched
 * directly. A photo or screen held up to the camera is therefore not rejected; the scanner is
 * meant for supervised use, and the employee self-scan also requires the employee's own login.
 */
export type FatalErrorKind = "camera_denied" | "no_camera" | "camera_unavailable" | "models_failed";
export type ScanErrorKind = "not_recognized" | "rule_rejected" | "network" | "service";

export type ScannerState =
  | { status: "initializing" }
  | { status: "ready" }
  | { status: "searching"; stableFrames: number; guidance: string | null }
  | { status: "verifying" }
  | { status: "recording"; scanId: string }
  | { status: "success"; result: FaceAttendanceResult }
  | { status: "error"; kind: ScanErrorKind; message: string; fatal: false; distance?: number | null }
  | { status: "error"; kind: FatalErrorKind; message: string; fatal: true }
  | { status: "cooldown" };

export type ScannerEvent =
  | { type: "INIT_SUCCEEDED" }
  | { type: "INIT_FAILED"; kind: FatalErrorKind; message: string }
  | { type: "CAMERA_LOST"; message: string }
  | { type: "START" }
  | { type: "STOP" }
  | { type: "RETRY" }
  | { type: "FRAME_REJECTED"; guidance: string }
  | { type: "FRAME_ACCEPTED"; now: number }
  | { type: "DESCRIPTOR_READY"; scanId: string }
  | { type: "DESCRIPTOR_FAILED"; guidance: string }
  | { type: "RECORD_SUCCEEDED"; result: FaceAttendanceResult }
  | { type: "RECORD_FAILED"; message: string; retryable: boolean }
  | { type: "DISPLAY_ELAPSED" }
  | { type: "COOLDOWN_ELAPSED" };

export const initialScannerState: ScannerState = { status: "initializing" };

const searching = (guidance: string | null = null): ScannerState => ({ status: "searching", stableFrames: 0, guidance });

export function createScannerReducer(config: Pick<FaceRecognitionConfig, "stableFramesBeforeVerify">) {
  return function scannerReducer(state: ScannerState, event: ScannerEvent): ScannerState {
    const halted = state.status === "initializing" || (state.status === "error" && state.fatal);
    // Stopping always wins, except before the camera and models are ready.
    if (event.type === "STOP") return halted ? state : { status: "ready" };
    // A camera that stops (page hidden, device unplugged, permission revoked) ends any running state.
    if (event.type === "CAMERA_LOST") return halted ? state : { status: "error", kind: "camera_unavailable", message: event.message, fatal: true };

    switch (state.status) {
      case "initializing":
        if (event.type === "INIT_SUCCEEDED") return { status: "ready" };
        if (event.type === "INIT_FAILED") return { status: "error", kind: event.kind, message: event.message, fatal: true };
        return state;
      case "ready":
        return event.type === "START" ? searching() : state;
      case "searching":
        if (event.type === "FRAME_REJECTED") return { status: "searching", stableFrames: 0, guidance: event.guidance };
        if (event.type === "FRAME_ACCEPTED") {
          const stableFrames = state.stableFrames + 1;
          return stableFrames >= config.stableFramesBeforeVerify ? { status: "verifying" } : { status: "searching", stableFrames, guidance: null };
        }
        return state;
      case "verifying":
        if (event.type === "DESCRIPTOR_READY") return { status: "recording", scanId: event.scanId };
        if (event.type === "DESCRIPTOR_FAILED") return searching(event.guidance);
        return state;
      case "recording":
        if (event.type === "RECORD_SUCCEEDED") return resultState(event.result);
        if (event.type === "RECORD_FAILED") return { status: "error", kind: event.retryable ? "network" : "service", message: event.message, fatal: false };
        return state;
      case "success":
        return event.type === "DISPLAY_ELAPSED" ? { status: "cooldown" } : state;
      case "error":
        if (state.fatal) return event.type === "RETRY" ? { status: "initializing" } : state;
        return event.type === "DISPLAY_ELAPSED" ? { status: "cooldown" } : state;
      case "cooldown":
        return event.type === "COOLDOWN_ELAPSED" ? searching() : state;
    }
  };
}

function resultState(result: FaceAttendanceResult): ScannerState {
  switch (result.outcome) {
    case "time_in":
    case "time_out":
      return { status: "success", result };
    case "not_recognized":
      return { status: "error", kind: "not_recognized", message: "Face not recognized.", fatal: false, distance: result.distance };
    case "already_recorded":
    case "rejected":
      return { status: "error", kind: "rule_rejected", message: result.message ?? "Attendance could not be recorded.", fatal: false };
  }
}

/** True while the scanner should be sampling the camera. */
export function isDetecting(state: ScannerState) {
  return state.status === "searching";
}
