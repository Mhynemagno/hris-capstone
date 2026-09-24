"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { CAMERA_ERROR_MESSAGES, useCamera } from "@/hooks/use-camera";
import { useRecordFaceAttendance, type FaceScanMode } from "@/hooks/use-face-recognition";
import { FACE_RECOGNITION_CONFIG, LOW_LIGHT_BRIGHTNESS } from "@/lib/face-recognition/config";
import { detectFaces, detectFacesWithDescriptors, faceBrightness, getFaceBackend, loadFaceModels, MODELS_FAILED_MESSAGE, type FaceApi } from "@/lib/face-recognition/face-api";
import { assessFraming, FRAMING_MESSAGES } from "@/lib/face-recognition/geometry";
import { createScannerReducer, initialScannerState } from "@/lib/face-recognition/scanner-machine";
import { FaceRecognitionRequestError } from "@/queries/face-recognition";

const config = FACE_RECOGNITION_CONFIG;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs the kiosk: camera + models → face search → one descriptor → one
 * idempotent attendance request → result → cooldown. Only one async step runs at a time;
 * every effect cancels its timers and ignores late results when the state changes or the
 * component unmounts.
 */
export function useFaceAttendanceScanner(mode: FaceScanMode = "kiosk") {
  const reducer = useMemo(() => createScannerReducer(config), []);
  const [state, dispatch] = useReducer(reducer, initialScannerState);
  const camera = useCamera();
  const record = useRecordFaceAttendance(mode);
  const descriptorRef = useRef<number[] | null>(null);
  const { start: startCamera, stop: stopCamera, status: cameraStatus, videoRef } = camera;
  const recordAttendance = record.mutateAsync;
  const faceapiRef = useRef<FaceApi | null>(null);
  const [diagnostics, setDiagnostics] = useState<{ detectionMs: number | null; brightness: number | null }>({ detectionMs: null, brightness: null });

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

  // SEARCHING: throttled detection with no overlapping calls.
  const status = state.status;
  useEffect(() => {
    const faceapi = faceapiRef.current;
    if (status !== "searching" || !faceapi) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const started = performance.now();
          const faces = await detectFaces(faceapi, video);
          if (cancelled) return;
          const brightness = faces.length === 1 ? faceBrightness(video, faces[0].box) : null;
          setDiagnostics({ detectionMs: Math.round(performance.now() - started), brightness: brightness === null ? null : Math.round(brightness) });
          const framing = assessFraming(faces.map((face) => face.box), { width: video.videoWidth, height: video.videoHeight }, config.framing);
          dispatch(framing.ok ? { type: "FRAME_ACCEPTED", now: performance.now() } : { type: "FRAME_REJECTED", guidance: FRAMING_MESSAGES[framing.issue] });
        } catch {
          if (cancelled) return;
        }
      }
      if (!cancelled) timer = setTimeout(() => void tick(), config.searchIntervalMs);
    };
    timer = setTimeout(() => void tick(), config.searchIntervalMs);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [status, videoRef]);

  // VERIFYING: one descriptor, from exactly one face.
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

  const lowLight = diagnostics.brightness !== null && diagnostics.brightness < LOW_LIGHT_BRIGHTNESS && state.status === "searching";

  return { state, videoRef, start, pause, retry, lowLight, diagnostics: { ...diagnostics, backend: getFaceBackend() } };
}
