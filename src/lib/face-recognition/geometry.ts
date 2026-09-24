import type { FramingConfig } from "./config";

export type Box = { x: number; y: number; width: number; height: number };

export const DESCRIPTOR_LENGTH = 128;

export function euclideanDistance(left: ArrayLike<number>, right: ArrayLike<number>) {
  if (left.length !== right.length) throw new Error("Descriptors must have the same length.");
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    sum += difference * difference;
  }
  return Math.sqrt(sum);
}

export type FramingIssue = "no_face" | "multiple_faces" | "too_far" | "too_close" | "off_center";
export type FramingResult = { ok: true } | { ok: false; issue: FramingIssue };

/** Requires exactly one face, reasonably sized and centred in the frame. */
export function assessFraming(boxes: readonly Box[], frame: { width: number; height: number }, config: FramingConfig): FramingResult {
  if (boxes.length === 0) return { ok: false, issue: "no_face" };
  if (boxes.length > 1) return { ok: false, issue: "multiple_faces" };
  const [box] = boxes;
  const widthRatio = box.width / frame.width;
  if (widthRatio < config.minFaceWidthRatio) return { ok: false, issue: "too_far" };
  if (widthRatio > config.maxFaceWidthRatio) return { ok: false, issue: "too_close" };
  const offsetX = Math.abs(box.x + box.width / 2 - frame.width / 2) / frame.width;
  const offsetY = Math.abs(box.y + box.height / 2 - frame.height / 2) / frame.height;
  if (offsetX > config.maxCenterOffsetRatio || offsetY > config.maxCenterOffsetRatio) return { ok: false, issue: "off_center" };
  return { ok: true };
}

export const FRAMING_MESSAGES: Record<FramingIssue, string> = {
  no_face: "No face detected. Look at the camera.",
  multiple_faces: "More than one face is visible. Only one person may scan at a time.",
  too_far: "Move closer to the camera.",
  too_close: "Move back a little.",
  off_center: "Centre your face in the frame.",
};

export type SampleAggregation =
  | { ok: true; descriptor: number[]; maxDistance: number }
  | { ok: false; reason: "not_enough_samples" | "inconsistent_samples"; maxDistance?: number };

/**
 * Averages enrollment samples into one descriptor and rejects the set if any sample is far from
 * the average, which indicates a different person, a bad frame, or heavy motion.
 */
export function aggregateDescriptors(samples: readonly ArrayLike<number>[], minSamples: number, maxSampleDistance: number): SampleAggregation {
  if (samples.length < minSamples) return { ok: false, reason: "not_enough_samples" };
  const mean = new Array<number>(DESCRIPTOR_LENGTH).fill(0);
  for (const sample of samples) {
    if (sample.length !== DESCRIPTOR_LENGTH) throw new Error("Face descriptors must have 128 values.");
    for (let index = 0; index < DESCRIPTOR_LENGTH; index += 1) mean[index] += sample[index] / samples.length;
  }
  const maxDistance = Math.max(...samples.map((sample) => euclideanDistance(sample, mean)));
  if (maxDistance > maxSampleDistance) return { ok: false, reason: "inconsistent_samples", maxDistance };
  return { ok: true, descriptor: mean, maxDistance };
}
