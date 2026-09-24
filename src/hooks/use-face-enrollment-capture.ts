"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CAMERA_ERROR_MESSAGES, useCamera } from "@/hooks/use-camera";
import { useEnrollEmployeeFace } from "@/hooks/use-face-recognition";
import { FACE_RECOGNITION_CONFIG } from "@/lib/face-recognition/config";
import { detectFacesWithDescriptors, loadFaceModels, MODELS_FAILED_MESSAGE, type FaceApi } from "@/lib/face-recognition/face-api";
import { aggregateDescriptors, assessFraming, FRAMING_MESSAGES } from "@/lib/face-recognition/geometry";

const config = FACE_RECOGNITION_CONFIG;

export type EnrollmentCaptureState =
  | { phase: "idle" }
  | { phase: "initializing" }
  | { phase: "capturing"; samples: number; guidance: string | null }
  | { phase: "submitting" }
  | { phase: "success"; status: "enrolled" | "re_registered" }
  | { phase: "error"; message: string };

type Target = { employeeId: string; consentConfirmed: true };

/**
 * Captures several single-face samples for the employee the HR user selected, averages them,
 * and submits one descriptor. An existing registration is replaced only when the database
 * accepts the new one; cancelling or failing leaves it untouched. Samples live only in memory.
 */
export function useFaceEnrollmentCapture() {
  const [state, setState] = useState<EnrollmentCaptureState>({ phase: "idle" });
  const camera = useCamera();
  const enroll = useEnrollEmployeeFace();
  const samplesRef = useRef<Float32Array[]>([]);
  const targetRef = useRef<Target | null>(null);
  const faceapiRef = useRef<FaceApi | null>(null);
  const { start: startCamera, stop: stopCamera, videoRef } = camera;
  const enrollFace = enroll.mutateAsync;
  const phase = state.phase;

  const fail = useCallback((message: string) => {
    samplesRef.current = [];
    stopCamera();
    setState({ phase: "error", message });
  }, [stopCamera]);

  const begin = useCallback((target: Target) => {
    targetRef.current = target;
    samplesRef.current = [];
    setState({ phase: "initializing" });
  }, []);

  const cancel = useCallback(() => {
    samplesRef.current = [];
    targetRef.current = null;
    stopCamera();
    setState({ phase: "idle" });
  }, [stopCamera]);

  // Start the camera and load the models together.
  useEffect(() => {
    if (phase !== "initializing") return;
    let cancelled = false;
    void Promise.all([startCamera(), loadFaceModels().catch(() => null)]).then(([cameraError, loaded]) => {
      if (cancelled) return;
      if (cameraError) return fail(CAMERA_ERROR_MESSAGES[cameraError]);
      if (!loaded) return fail(MODELS_FAILED_MESSAGE);
      faceapiRef.current = loaded;
      setState({ phase: "capturing", samples: 0, guidance: null });
    });
    return () => { cancelled = true; };
  }, [phase, startCamera, fail]);

  // Sample capture: one detection per interval, never overlapping.
  useEffect(() => {
    const faceapi = faceapiRef.current;
    if (phase !== "capturing" || !faceapi) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const video = videoRef.current;
      if (!video?.srcObject) return fail("The camera was turned off. Start the registration again.");
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const faces = await detectFacesWithDescriptors(faceapi, video);
          if (cancelled) return;
          const framing = assessFraming(faces.map((face) => face.box), { width: video.videoWidth, height: video.videoHeight }, config.framing);
          if (!framing.ok) {
            setState({ phase: "capturing", samples: samplesRef.current.length, guidance: FRAMING_MESSAGES[framing.issue] });
          } else {
            samplesRef.current.push(faces[0].descriptor);
            if (samplesRef.current.length >= config.enrollment.requiredSamples) return setState({ phase: "submitting" });
            setState({ phase: "capturing", samples: samplesRef.current.length, guidance: null });
          }
        } catch {
          if (cancelled) return;
        }
      }
      if (!cancelled) timer = setTimeout(() => void tick(), config.enrollment.sampleIntervalMs);
    };
    timer = setTimeout(() => void tick(), config.enrollment.sampleIntervalMs);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase, videoRef, fail]);

  // Submission: aggregate, validate consistency, then exactly one enrollment request.
  useEffect(() => {
    if (phase !== "submitting") return;
    const target = targetRef.current;
    const samples = samplesRef.current;
    samplesRef.current = [];
    let cancelled = false;
    void (async () => {
      if (!target) return fail("Select an employee before registering a face.");
      const aggregate = aggregateDescriptors(samples, config.enrollment.requiredSamples, config.enrollment.maxSampleDistance);
      if (!aggregate.ok) return fail("The captured samples did not match each other. Make sure only the selected employee is in view, keep still, and try again.");
      try {
        const result = await enrollFace({ employeeId: target.employeeId, descriptor: aggregate.descriptor, sampleCount: samples.length, consentConfirmed: target.consentConfirmed });
        if (cancelled) return;
        stopCamera();
        setState({ phase: "success", status: result.status });
      } catch (cause) {
        if (!cancelled) fail(cause instanceof Error ? cause.message : "The face registration could not be saved.");
      }
    })();
    return () => { cancelled = true; };
  }, [phase, enrollFace, fail, stopCamera]);

  return { state, videoRef, begin, cancel };
}
