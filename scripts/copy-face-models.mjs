// Copies the face-api model weights used by face attendance from the installed, version-pinned
// @vladmandic/face-api package into public/ so they are served same-origin. The weights are
// generated build output and are not committed.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@vladmandic", "face-api", "model");
const target = join(root, "public", "models", "face-api");
const models = ["tiny_face_detector_model", "face_landmark_68_model", "face_recognition_model"];

// TensorFlow.js WebAssembly backend binaries, pinned to the version bundled in face-api (4.22.0).
// Browsers without WebGL use them instead of the CPU backend, which is ~20x slower.
const wasmSource = join(root, "node_modules", "@tensorflow", "tfjs-backend-wasm", "dist");
const wasmFiles = ["tfjs-backend-wasm.wasm", "tfjs-backend-wasm-simd.wasm", "tfjs-backend-wasm-threaded-simd.wasm"];

await mkdir(join(target, "wasm"), { recursive: true });
for (const model of models) {
  for (const file of [`${model}.bin`, `${model}-weights_manifest.json`]) {
    await copyFile(join(source, file), join(target, file));
  }
}
for (const file of wasmFiles) {
  await copyFile(join(wasmSource, file), join(target, "wasm", file));
}
console.log(`Copied ${models.length} face-api models and ${wasmFiles.length} WebAssembly binaries to public/models/face-api`);
