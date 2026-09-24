/**
 * Tunable values for browser-side face capture, liveness, and the kiosk flow.
 *
 * The identity match threshold is deliberately NOT here: matching runs inside the database so
 * descriptors never reach the browser. It lives in `private.face_recognition_settings`
 * (`match_threshold` 0.5, `ambiguity_margin` 0.04, `min_time_out_minutes` 2); see the
 * face-recognition attendance design doc.
 */
export const FACE_RECOGNITION_CONFIG = {
  /** Same-origin path of the model weights copied by scripts/copy-face-models.mjs. */
  modelBaseUrl: "/models/face-api",
  /** Model/version label stored with each enrollment. */
  descriptorModel: "face-api/face_recognition_model@1",

  detector: {
    /** TinyFaceDetector input size; must be divisible by 32. Larger is slower but finds smaller faces. */
    inputSize: 320,
    scoreThreshold: 0.5,
  },

  framing: {
    /** Face box width as a fraction of the video width. */
    minFaceWidthRatio: 0.2,
    maxFaceWidthRatio: 0.7,
    /** Maximum distance of the face centre from the frame centre, as a fraction of each dimension. */
    maxCenterOffsetRatio: 0.2,
  },

  /** Milliseconds between detections while searching for a face (recognition is never run per animation frame). */
  searchIntervalMs: 250,
  /** Consecutive well-framed frames required before the blink challenge starts. */
  stableFramesBeforeLiveness: 3,

  blink: {
    /** Milliseconds between landmark-only detections during the blink challenge. */
    intervalMs: 30,
    /** Sanity floor for an open-eye frame; only rejects degenerate landmarks, so narrow eyes still qualify. */
    minEar: 0.1,
    /** Eyes count as closed when EAR drops to this fraction of the person's open-eye baseline. */
    closedBaselineRatio: 0.82,
    /** Eyes count as open again when EAR recovers to this fraction of the baseline. */
    reopenBaselineRatio: 0.92,
    /** How quickly the baseline follows open-eye EAR (0-1), absorbing leaning in or small head turns. */
    baselineSmoothing: 0.2,
    /** Consecutive frames needed before a blink can start; their mean is the initial baseline. */
    minOpenFramesBefore: 3,
    /** Consecutive closed frames needed for a blink. Detection runs at roughly 6-10 fps, so a normal 100-150 ms blink is often a single frame. */
    minClosedFrames: 1,
    /** Consecutive open frames needed after the eyes close. */
    minOpenFramesAfter: 1,
    /** Consecutive no-face frames tolerated during the challenge; the detector often loses the face mid-blink. */
    maxMissedFrames: 5,
    /** The challenge fails if no blink is completed in this time. */
    timeoutMs: 12000,
  },

  enrollment: {
    /** Valid samples averaged into the stored descriptor. Must stay within the database's 3-10 range. */
    requiredSamples: 5,
    /** Milliseconds between sample captures, so samples come from different moments. */
    sampleIntervalMs: 500,
    /** Every sample must be within this Euclidean distance of the averaged descriptor. */
    maxSampleDistance: 0.4,
  },

  kiosk: {
    /** How long the recorded employee and time stay on screen. */
    successDisplayMs: 4000,
    /** How long an error such as "Face not recognized" stays on screen. */
    errorDisplayMs: 3500,
    /** Pause after a result before scanning resumes. */
    cooldownMs: 2500,
    /** Retries of the attendance request after a network failure, reusing the same scan ID. */
    maxNetworkRetries: 2,
    networkRetryDelayMs: 800,
  },
} as const;

export type FaceRecognitionConfig = typeof FACE_RECOGNITION_CONFIG;
/** Numeric settings (not the literal defaults) so callers can tune them. */
export type BlinkConfig = Record<keyof FaceRecognitionConfig["blink"], number>;
export type FramingConfig = Record<keyof FaceRecognitionConfig["framing"], number>;

/**
 * Below this mean face brightness (0-255) the eye landmarks get noisy and blinks are missed,
 * so the scanner suggests more light. A dim room measured ~81; a well-lit face is ~120-170.
 */
export const LOW_LIGHT_BRIGHTNESS = 90;

/**
 * Distances, EAR, backend, and detection time are shown in development builds, or in any
 * build when the page URL has `?diagnostics=1` (for troubleshooting a specific device).
 */
export const SHOW_FACE_DIAGNOSTICS = process.env.NODE_ENV === "development";

export function faceDiagnosticsEnabled() {
  if (SHOW_FACE_DIAGNOSTICS) return true;
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("diagnostics") === "1";
}
