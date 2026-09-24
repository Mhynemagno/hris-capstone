import { z } from "zod";

import { uuidSchema } from "./common";

export const faceDescriptorSchema = z.array(z.number().finite().min(-2).max(2)).length(128, "A face descriptor must have 128 values.");

export const faceEnrollmentSchema = z.object({
  employeeId: uuidSchema,
  descriptor: faceDescriptorSchema,
  sampleCount: z.number().int().min(3).max(10),
  consentConfirmed: z.literal(true, { error: "Confirm the employee consented to face registration." }),
}).strict();

export const faceAttendanceScanSchema = z.object({
  scanId: uuidSchema,
  descriptor: faceDescriptorSchema,
}).strict();

export const faceAttendanceOutcomeSchema = z.enum(["time_in", "time_out", "already_recorded", "rejected", "not_recognized"]);

export const faceAttendanceResultSchema = z.object({
  scanId: uuidSchema,
  outcome: faceAttendanceOutcomeSchema,
  message: z.string().nullable(),
  distance: z.number().nullable(),
  employee: z.object({
    id: uuidSchema,
    employeeNumber: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }).nullable(),
  log: z.object({
    id: uuidSchema,
    attendanceDate: z.string(),
    timeIn: z.string().nullable(),
    timeOut: z.string().nullable(),
    status: z.enum(["present", "late", "absent", "incomplete"]),
  }).nullable(),
  recordedAt: z.string(),
});

export const faceEnrollmentSummarySchema = z.object({
  employee_id: uuidSchema,
  sample_count: z.number().int(),
  enrolled_at: z.string(),
  updated_at: z.string(),
});

export type FaceEnrollmentInput = z.infer<typeof faceEnrollmentSchema>;
export type FaceAttendanceScanInput = z.infer<typeof faceAttendanceScanSchema>;
export type FaceAttendanceResult = z.infer<typeof faceAttendanceResultSchema>;
export type FaceEnrollmentSummary = z.infer<typeof faceEnrollmentSummarySchema>;
