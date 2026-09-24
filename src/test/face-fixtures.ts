import type { Point } from "@/lib/face-recognition/geometry";

/** Six eye landmarks whose eye aspect ratio is exactly `ear`. */
export function eyeWithEar(ear: number, offsetX = 0): Point[] {
  const half = ear / 2;
  return [
    { x: offsetX, y: 0 },
    { x: offsetX + 0.33, y: -half },
    { x: offsetX + 0.66, y: -half },
    { x: offsetX + 1, y: 0 },
    { x: offsetX + 0.66, y: half },
    { x: offsetX + 0.33, y: half },
  ];
}

/** Synthetic 128-value descriptor (not derived from any real face). */
export function syntheticDescriptor(value: number) {
  return new Float32Array(128).fill(value);
}
