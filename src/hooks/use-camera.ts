"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraErrorKind = "camera_denied" | "no_camera" | "camera_unavailable";
export type CameraStatus = "idle" | "starting" | "active" | "error";

export const CAMERA_ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  camera_denied: "Camera access was denied. Allow camera access in the browser's site settings, then try again.",
  no_camera: "No camera was found. Connect a camera and try again.",
  camera_unavailable: "The camera could not be started. Close other apps using it, use HTTPS, and try again.",
};

export function cameraErrorKind(error: unknown): CameraErrorKind {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "camera_denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no_camera";
  return "camera_unavailable";
}

/**
 * Owns one camera stream. Prefers the front-facing camera, never requests audio, and stops
 * every track when stopped, when the page is hidden, and on unmount.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraErrorKind | null>(null);

  const stop = useCallback(() => {
    requestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  /** Resolves to null once the preview is live, or to the reason it could not start. */
  const start = useCallback(async (): Promise<CameraErrorKind | null> => {
    stop();
    const request = requestRef.current;
    setError(null);
    setStatus("starting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("camera_unavailable");
      setStatus("error");
      return "camera_unavailable";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } } });
      // A later stop() or start() superseded this request: release the stream immediately.
      if (request !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return "camera_unavailable";
      }
      streamRef.current = stream;
      // An unplugged or revoked camera ends its track; treat that like a stop.
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", stop, { once: true }));
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      // The track may have ended (or stop() been called) while playback was starting.
      if (request !== requestRef.current) return "camera_unavailable";
      setStatus("active");
      return null;
    } catch (cause) {
      const kind = cameraErrorKind(cause);
      if (request !== requestRef.current) return kind;
      setError(kind);
      setStatus("error");
      return kind;
    }
  }, [stop]);

  useEffect(() => {
    const onHidden = () => { if (document.visibilityState === "hidden") stop(); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [stop]);

  return { videoRef, status, error, start, stop };
}
