import { describe, expect, it } from "vitest";

import { eyeWithEar, syntheticDescriptor } from "@/test/face-fixtures";

import { FACE_RECOGNITION_CONFIG } from "./config";
import { aggregateDescriptors, assessFraming, averageEyeAspectRatio, euclideanDistance, eyeAspectRatio } from "./geometry";

const frame = { width: 640, height: 480 };
const centred = { x: 220, y: 140, width: 200, height: 200 };

describe("euclideanDistance", () => {
  it("measures descriptor distance", () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
    expect(euclideanDistance(syntheticDescriptor(0.1), syntheticDescriptor(0.1))).toBe(0);
  });

  it("rejects descriptors of different lengths", () => {
    expect(() => euclideanDistance([1], [1, 2])).toThrow();
  });
});

describe("eye aspect ratio", () => {
  it("computes EAR from six landmarks", () => {
    expect(eyeAspectRatio(eyeWithEar(0.3))).toBeCloseTo(0.3);
    expect(averageEyeAspectRatio(eyeWithEar(0.3), eyeWithEar(0.1, 3))).toBeCloseTo(0.2);
  });

  it("requires six landmarks", () => {
    expect(() => eyeAspectRatio(eyeWithEar(0.3).slice(0, 5))).toThrow();
  });
});

describe("assessFraming", () => {
  const config = FACE_RECOGNITION_CONFIG.framing;

  it("accepts exactly one centred, adequately sized face", () => {
    expect(assessFraming([centred], frame, config)).toEqual({ ok: true });
  });

  it.each([
    ["no_face", []],
    ["multiple_faces", [centred, { ...centred, x: 10 }]],
    ["too_far", [{ x: 300, y: 220, width: 60, height: 60 }]],
    ["too_close", [{ x: 10, y: 0, width: 620, height: 480 }]],
    ["off_center", [{ x: 0, y: 0, width: 200, height: 200 }]],
  ] as const)("reports %s", (issue, boxes) => {
    expect(assessFraming(boxes, frame, config)).toEqual({ ok: false, issue });
  });
});

describe("aggregateDescriptors", () => {
  it("averages consistent samples into one 128-value descriptor", () => {
    const result = aggregateDescriptors([syntheticDescriptor(0.1), syntheticDescriptor(0.12), syntheticDescriptor(0.14)], 3, 0.4);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.descriptor).toHaveLength(128);
      expect(result.descriptor[0]).toBeCloseTo(0.12);
    }
  });

  it("rejects too few samples", () => {
    expect(aggregateDescriptors([syntheticDescriptor(0.1)], 3, 0.4)).toEqual({ ok: false, reason: "not_enough_samples" });
  });

  it("rejects a sample set that mixes different faces", () => {
    const result = aggregateDescriptors([syntheticDescriptor(0.1), syntheticDescriptor(0.1), syntheticDescriptor(-0.1)], 3, 0.4);
    expect(result).toMatchObject({ ok: false, reason: "inconsistent_samples" });
  });
});
