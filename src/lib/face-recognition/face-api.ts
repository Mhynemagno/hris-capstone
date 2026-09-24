import { FACE_RECOGNITION_CONFIG } from "./config";
import type { Box } from "./geometry";

// The bundled ESM build includes its own TensorFlow.js; the package "main" entry is the Node
// build and must not reach the browser bundle.
type FaceApi = typeof import("@vladmandic/face-api/dist/face-api.esm.js");

let loading: Promise<FaceApi> | null = null;

export const MODELS_FAILED_MESSAGE = "The face recognition models could not be loaded. Check the connection and try again.";

// The bundle exposes these at runtime but its type declarations omit them.
type TfBackendControl = { setBackend(name: string): Promise<boolean>; setWasmPaths(prefix: string): void; getBackend(): string };

export type FaceBackend = "webgl" | "wasm" | "cpu";

// WebGL is fastest where the GPU is available. Browsers without WebGL (GPU blocklisted,
// hardware acceleration off, remote desktops) use WebAssembly: measured at ~40-55 ms per
// face analysis versus ~0.8-1.9 s on the CPU backend. At CPU speed the camera samples about
// once a second, which makes the scanner feel unresponsive.
const BACKENDS: readonly FaceBackend[] = ["webgl", "wasm", "cpu"];

let activeBackend: FaceBackend | null = null;

/** The TensorFlow.js backend the face models run on, once loaded. */
export function getFaceBackend() {
  return activeBackend;
}

async function selectBackend(faceapi: FaceApi, baseUrl: string): Promise<void> {
  const tf = faceapi.tf as unknown as TfBackendControl;
  tf.setWasmPaths(`${baseUrl}/wasm/`);
  for (const backend of BACKENDS) {
    try {
      if (await tf.setBackend(backend)) {
        activeBackend = backend;
        return;
      }
    } catch {
      // Try the next backend.
    }
  }
  throw new Error("No TensorFlow.js backend could be initialized.");
}

/**
 * Loads the library and the three models (detector, 68-point landmarks, recognition) once per
 * page. A failed load is not cached, so the user can retry.
 */
export function loadFaceModels(baseUrl: string = FACE_RECOGNITION_CONFIG.modelBaseUrl): Promise<FaceApi> {
  loading ??= (async () => {
    const faceapi = await import("@vladmandic/face-api/dist/face-api.esm.js");
    await selectBackend(faceapi, baseUrl);
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

export type DetectedFace = { box: Box };
export type DescribedFace = DetectedFace & { descriptor: Float32Array };

function detectorOptions(faceapi: FaceApi) {
  return new faceapi.TinyFaceDetectorOptions({ inputSize: FACE_RECOGNITION_CONFIG.detector.inputSize, scoreThreshold: FACE_RECOGNITION_CONFIG.detector.scoreThreshold });
}

function toBox({ x, y, width, height }: Box): Box {
  return { x, y, width, height };
}

let brightnessCanvas: HTMLCanvasElement | null = null;

/** Mean brightness (0-255) of the face box in the current video frame, or null if unavailable. */
export function faceBrightness(video: HTMLVideoElement, box: Box): number | null {
  brightnessCanvas ??= document.createElement("canvas");
  const size = 24;
  brightnessCanvas.width = size;
  brightnessCanvas.height = size;
  const context = brightnessCanvas.getContext("2d", { willReadFrequently: true });
  if (!context || box.width <= 0 || box.height <= 0) return null;
  try {
    context.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    let total = 0;
    for (let index = 0; index < pixels.length; index += 4) total += 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    return total / (pixels.length / 4);
  } catch {
    return null;
  }
}

/** Face boxes only, for framing while searching; computes no landmarks or descriptor. */
export async function detectFaces(faceapi: FaceApi, video: HTMLVideoElement): Promise<DetectedFace[]> {
  const results = await faceapi.detectAllFaces(video, detectorOptions(faceapi));
  return results.map((result) => ({ box: toBox(result.box) }));
}

/** Every visible face with its 128-value descriptor. Callers require exactly one. */
export async function detectFacesWithDescriptors(faceapi: FaceApi, video: HTMLVideoElement): Promise<DescribedFace[]> {
  const results = await faceapi.detectAllFaces(video, detectorOptions(faceapi)).withFaceLandmarks().withFaceDescriptors();
  return results.map((result) => ({ box: toBox(result.detection.box), descriptor: result.descriptor }));
}

export type { FaceApi };
