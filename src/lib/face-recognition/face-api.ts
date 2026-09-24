import { FACE_RECOGNITION_CONFIG } from "./config";
import type { Box, Point } from "./geometry";

// The bundled ESM build includes its own TensorFlow.js; the package "main" entry is the Node
// build and must not reach the browser bundle.
type FaceApi = typeof import("@vladmandic/face-api/dist/face-api.esm.js");

let loading: Promise<FaceApi> | null = null;

export const MODELS_FAILED_MESSAGE = "The face recognition models could not be loaded. Check the connection and try again.";

/**
 * Loads the library and the three models (detector, 68-point landmarks, recognition) once per
 * page. A failed load is not cached, so the user can retry.
 */
export function loadFaceModels(baseUrl: string = FACE_RECOGNITION_CONFIG.modelBaseUrl): Promise<FaceApi> {
  loading ??= (async () => {
    const faceapi = await import("@vladmandic/face-api/dist/face-api.esm.js");
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl),
    ]);
    return faceapi;
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

export type DetectedFace = { box: Box; leftEye: Point[]; rightEye: Point[] };
export type DescribedFace = DetectedFace & { descriptor: Float32Array };

function detectorOptions(faceapi: FaceApi) {
  return new faceapi.TinyFaceDetectorOptions({ inputSize: FACE_RECOGNITION_CONFIG.detector.inputSize, scoreThreshold: FACE_RECOGNITION_CONFIG.detector.scoreThreshold });
}

function toDetectedFace(result: { detection: { box: Box }; landmarks: { getLeftEye(): Point[]; getRightEye(): Point[] } }): DetectedFace {
  const { x, y, width, height } = result.detection.box;
  return { box: { x, y, width, height }, leftEye: result.landmarks.getLeftEye(), rightEye: result.landmarks.getRightEye() };
}

/** Face boxes plus eye landmarks. Cheap enough for the blink challenge; computes no descriptor. */
export async function detectFacesWithLandmarks(faceapi: FaceApi, video: HTMLVideoElement): Promise<DetectedFace[]> {
  const results = await faceapi.detectAllFaces(video, detectorOptions(faceapi)).withFaceLandmarks();
  return results.map(toDetectedFace);
}

/** Every visible face with its 128-value descriptor. Callers require exactly one. */
export async function detectFacesWithDescriptors(faceapi: FaceApi, video: HTMLVideoElement): Promise<DescribedFace[]> {
  const results = await faceapi.detectAllFaces(video, detectorOptions(faceapi)).withFaceLandmarks().withFaceDescriptors();
  return results.map((result) => ({ ...toDetectedFace(result), descriptor: result.descriptor }));
}

export type { FaceApi };
