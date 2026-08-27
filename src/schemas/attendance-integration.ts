import { z } from "zod";

import { isoDateSchema, paginationSchema, uuidSchema } from "./common";

export const attendanceStatusSchema = z.enum(["present", "late", "absent", "incomplete"]);
export const attendanceEventTypeSchema = z.enum(["attendance", "absence"]);

export const attendanceFiltersSchema = paginationSchema.extend({
  employeeId: uuidSchema.optional(),
  status: attendanceStatusSchema.optional(),
  startsOn: isoDateSchema.optional(),
  endsOn: isoDateSchema.optional(),
}).superRefine((value, context) => {
  if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
    context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after start date." });
  }
});

export const attendanceSettingsSchema = z.object({
  workdayStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM time."),
  lateGraceMinutes: z.coerce.number().int().min(0).max(120),
  templateVersion: z.string().trim().min(1).max(40),
  isEnabled: z.boolean(),
}).strict();

export const attendanceMappingSchema = z.object({
  employeeId: uuidSchema,
  externalEmployeeId: z.string().trim().min(1).max(64).transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z0-9][A-Z0-9._-]*$/, "Use a stable device employee ID.")),
  unmatchedEventId: uuidSchema.optional(),
});

export const attendanceImportFileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string(),
  size: z.number().int().positive().max(2 * 1024 * 1024),
}).superRefine((file, context) => {
  const isCsv = /\.csv$/i.test(file.name) && (file.type === "" || file.type === "text/csv" || file.type === "application/csv");
  const isXlsx = /\.xlsx$/i.test(file.name) && (file.type === "" || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  if (!isCsv && !isXlsx) context.addIssue({ code: "custom", path: ["type"], message: "Choose a CSV or XLSX file." });
});

export type AttendanceFilters = z.infer<typeof attendanceFiltersSchema>;
export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsSchema>;
export type AttendanceMappingInput = z.infer<typeof attendanceMappingSchema>;
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
