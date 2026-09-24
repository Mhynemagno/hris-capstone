"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { CAMERA_ERROR_MESSAGES, useCamera } from "@/hooks/use-camera";
import { useRecordFaceAttendance } from "@/hooks/use-face-recognition";
import { FACE_RECOGNITION_CONFIG } from "@/lib/face-recognition/config";
import { detectFacesWithDescriptors, detectFacesWithLandmarks, loadFaceModels, MODELS_FAILED_MESSAGE, type FaceApi } from "@/lib/face-recognition/face-api";
import { assessFraming, averageEyeAspectRatio, FRAMING_MESSAGES } from "@/lib/face-recognition/geometry";
import { createScannerReducer, initialScannerState } from "@/lib/face-recognition/scanner-machine";
import { FaceRecognitionRequestError } from "@/queries/face-recognition";

const config = FACE_RECOGNITION_CONFIG;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs the kiosk: camera + models → face search → blink challenge → one descriptor → one
 * idempotent attendance request → result → cooldown. Only one async step runs at a time;
 * every effect cancels its timers and ignores late results when the state changes or the
 * component unmounts.
 */
export function useFaceAttendanceScanner() {
  const reducer = useMemo(() => createScannerReducer(config), []);
  const [state, dispatch] = useReducer(reducer, initialScannerState);
  const camera = useCamera();
  const record = useRecordFaceAttendance();
  const descriptorRef = useRef<number[] | null>(null);
  const { start: startCamera, stop: stopCamera, status: cameraStatus, videoRef } = camera;
  const recordAttendance = record.mutateAsync;
  const faceapiRef = useRef<FaceApi | null>(null);

  // INITIALIZING: start the camera and load the models (cached after the first load) together.
  useEffect(() => {
    if (state.status !== "initializing") return;
    let cancelled = false;
    void Promise.all([startCamera(), loadFaceModels().catch(() => null)]).then(([cameraError, loaded]) => {
      if (cancelled) return;
      if (cameraError) return dispatch({ type: "INIT_FAILED", kind: cameraError, message: CAMERA_ERROR_MESSAGES[cameraError] });
      if (!loaded) {
        stopCamera();
        return dispatch({ type: "INIT_FAILED", kind: "models_failed", message: MODELS_FAILED_MESSAGE });
      }
      faceapiRef.current = loaded;
      dispatch({ type: "INIT_SUCCEEDED" });
    });
    return () => { cancelled = true; };
  }, [state.status, startCamera, stopCamera]);

  // A camera that stops outside initialization (page hidden, device unplugged) ends the session.
  useEffect(() => {
    const running = state.status !== "initializing" && !(state.status === "error" && state.fatal);
    if (running && cameraStatus === "idle") dispatch({ type: "CAMERA_LOST", message: "The camera was turned off. Restart the scanner to continue." });
  }, [state, cameraStatus]);

  // SEARCHING and LIVENESS: throttled detection with no overlapping calls.
  const status = state.status;
  useEffect(() => {
    const faceapi = faceapiRef.current;
    if ((status !== "searching" && status !== "liveness") || !faceapi) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interval = status === "liveness" ? config.blink.intervalMs : config.searchIntervalMs;

    const tick = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const faces = await detectFacesWithLandmarks(faceapi, video);
          if (cancelled) return;
          if (status === "searching") {
            const framing = assessFraming(faces.map((face) => face.box), { width: video.videoWidth, height: video.videoHeight }, config.framing);
            dispatch(framing.ok ? { type: "FRAME_ACCEPTED", now: performance.now() } : { type: "FRAME_REJECTED", guidance: FRAMING_MESSAGES[framing.issue] });
          } else if (faces.length !== 1) {
            dispatch({ type: "FACE_LOST", guidance: FRAMING_MESSAGES[faces.length === 0 ? "no_face" : "multiple_faces"] });
          } else {
            dispatch({ type: "LIVENESS_FRAME", ear: averageEyeAspectRatio(faces[0].leftEye, faces[0].rightEye), now: performance.now() });
          }
        } catch {
          if (cancelled) return;
        }
      }
      if (!cancelled) timer = setTimeout(() => void tick(), interval);
    };
    timer = setTimeout(() => void tick(), interval);
    // Watchdog: the blink challenge ends on time even if no frame can be analysed.
    const watchdog = status === "liveness" ? setTimeout(() => dispatch({ type: "LIVENESS_EXPIRED" }), config.blink.timeoutMs) : undefined;
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(watchdog); };
  }, [status, videoRef]);

  // VERIFYING: one descriptor, only after the blink passed, from exactly one face.
  useEffect(() => {
    const faceapi = faceapiRef.current;
    if (status !== "verifying" || !faceapi) return;
    let cancelled = false;
    void (async () => {
      const video = videoRef.current;
      try {
        const faces = video ? await detectFacesWithDescriptors(faceapi, video) : [];
        if (cancelled) return;
        if (faces.length !== 1) {
          dispatch({ type: "DESCRIPTOR_FAILED", guidance: FRAMING_MESSAGES[faces.length === 0 ? "no_face" : "multiple_faces"] });
          return;
        }
        descriptorRef.current = Array.from(faces[0].descriptor);
        dispatch({ type: "DESCRIPTOR_READY", scanId: crypto.randomUUID() });
      } catch {
        if (!cancelled) dispatch({ type: "DESCRIPTOR_FAILED", guidance: "The face could not be read. Hold still and try again." });
      }
    })();
    return () => { cancelled = true; };
  }, [status, videoRef]);

  // RECORDING: one scan ID per attempt; network retries reuse it so the server deduplicates.
  const scanId = state.status === "recording" ? state.scanId : null;
  useEffect(() => {
    if (!scanId) return;
    const descriptor = descriptorRef.current;
    descriptorRef.current = null;
    let cancelled = false;
    void (async () => {
      if (!descriptor) {
        dispatch({ type: "RECORD_FAILED", message: "The face could not be read. Try again.", retryable: false });
        return;
      }
      for (let attempt = 0; ; attempt += 1) {
        try {
          const result = await recordAttendance({ scanId, descriptor });
          if (cancelled) return;
          dispatch({ type: "RECORD_SUCCEEDED", result });
          return;
        } catch (cause) {
          if (cancelled) return;
          const retryable = !(cause instanceof FaceRecognitionRequestError) || cause.retryable;
          if (retryable && attempt < config.kiosk.maxNetworkRetries) {
            await wait(config.kiosk.networkRetryDelayMs);
            if (cancelled) return;
            continue;
          }
          dispatch({ type: "RECORD_FAILED", message: cause instanceof Error ? cause.message : "Attendance could not be recorded.", retryable });
          return;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [scanId, recordAttendance]);

  // SUCCESS / ERROR display, then COOLDOWN with recognition stopped.
  const nonFatalError = state.status === "error" && !state.fatal;
  useEffect(() => {
    if (status !== "success" && !nonFatalError && status !== "cooldown") return;
    const delay = status === "success" ? config.kiosk.successDisplayMs : status === "cooldown" ? config.kiosk.cooldownMs : config.kiosk.errorDisplayMs;
    const timer = setTimeout(() => dispatch({ type: status === "cooldown" ? "COOLDOWN_ELAPSED" : "DISPLAY_ELAPSED" }), delay);
    return () => clearTimeout(timer);
  }, [status, nonFatalError]);

  const start = useCallback(() => dispatch({ type: "START" }), []);
  const pause = useCallback(() => dispatch({ type: "STOP" }), []);
  const retry = useCallback(() => dispatch({ type: "RETRY" }), []);

  return { state, videoRef, start, pause, retry };
}
