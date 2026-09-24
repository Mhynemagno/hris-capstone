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
    intervalMs: 60,
    /** Eye aspect ratio at or above which an eye counts as open. */
    earOpenThreshold: 0.24,
    /** Eye aspect ratio at or below which an eye counts as closed. */
    earClosedThreshold: 0.19,
    /** Also count as closed when EAR drops below this fraction of the person's open-eye baseline. */
    closedBaselineRatio: 0.72,
    /** Consecutive open frames needed before a blink can start (eyes closed at the start never pass). */
    minOpenFramesBefore: 3,
    /** Consecutive closed frames needed for a blink. Detection runs at roughly 6-10 fps, so a normal 100-150 ms blink is often a single frame. */
    minClosedFrames: 1,
    /** Consecutive open frames needed after the eyes close. */
    minOpenFramesAfter: 2,
    /** The challenge fails if no blink is completed in this time. */
    timeoutMs: 8000,
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

/** Distances and EAR values are shown only in development builds. */
export const SHOW_FACE_DIAGNOSTICS = process.env.NODE_ENV === "development";
