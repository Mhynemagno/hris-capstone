import { describe, expect, it } from "vitest";

import { faceAttendanceScanSchema, faceDescriptorSchema, faceEnrollmentSchema } from "./face-recognition";

const descriptor = Array.from({ length: 128 }, () => 0.1);
const employeeId = "3f1e2d3c-4b5a-4968-8776-655443322110";

describe("face recognition schemas", () => {
  it("accepts a 128-value finite descriptor", () => {
    expect(faceDescriptorSchema.parse(descriptor)).toHaveLength(128);
  });

  it.each([
    ["too short", descriptor.slice(1)],
    ["NaN", [...descriptor.slice(1), Number.NaN]],
    ["infinite", [...descriptor.slice(1), Number.POSITIVE_INFINITY]],
    ["out of range", [...descriptor.slice(1), 5]],
  ])("rejects a %s descriptor", (_, value) => {
    expect(faceDescriptorSchema.safeParse(value).success).toBe(false);
  });

  it("requires confirmed consent and a valid sample count for enrollment", () => {
    expect(faceEnrollmentSchema.safeParse({ employeeId, descriptor, sampleCount: 5, consentConfirmed: true }).success).toBe(true);
    expect(faceEnrollmentSchema.safeParse({ employeeId, descriptor, sampleCount: 5, consentConfirmed: false }).success).toBe(false);
    expect(faceEnrollmentSchema.safeParse({ employeeId, descriptor, sampleCount: 2, consentConfirmed: true }).success).toBe(false);
    expect(faceEnrollmentSchema.safeParse({ employeeId: "not-a-uuid", descriptor, sampleCount: 5, consentConfirmed: true }).success).toBe(false);
  });

  it("does not accept a claimed identity in a recognition scan", () => {
    expect(faceAttendanceScanSchema.safeParse({ scanId: employeeId, descriptor, employeeId }).success).toBe(false);
  });
});
