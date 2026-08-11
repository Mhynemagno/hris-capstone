import { z } from "zod";

import { isoDateSchema, uuidSchema } from "./common";

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || undefined).optional();

const optionalDate = isoDateSchema.optional();
const employmentStatuses = ["active", "on_leave", "inactive", "separated"] as const;

const hasValidDateRange = (startKey: string, endKey: string) => (value: Record<string, unknown>) => {
  const start = value[startKey];
  const end = value[endKey];
  return !start || !end || String(end) >= String(start);
};

export const employeeSchema = z
  .object({
    profileId: uuidSchema.optional(),
    employeeNumber: z.string().trim().toUpperCase().min(3).max(32),
    firstName: z.string().trim().min(1).max(80),
    middleName: optionalText(80),
    lastName: z.string().trim().min(1).max(80),
    personalEmail: z.string().trim().toLowerCase().pipe(z.email()),
    phone: optionalText(32),
    address: optionalText(500),
    emergencyContactName: optionalText(160),
    emergencyContactPhone: optionalText(32),
    departmentId: z.coerce.number().int().positive().optional(),
    positionId: z.coerce.number().int().positive().optional(),
    employmentStatus: z.enum(employmentStatuses).default("active"),
    employmentStartedOn: isoDateSchema,
    employmentEndedOn: optionalDate,
  })
  .refine(hasValidDateRange("employmentStartedOn", "employmentEndedOn"), {
    message: "Employment end date cannot be before the start date.",
    path: ["employmentEndedOn"],
  });

export const serviceHistorySchema = z
  .object({
    id: uuidSchema.optional(),
    employeeId: uuidSchema,
    departmentId: z.coerce.number().int().positive().optional(),
    positionId: z.coerce.number().int().positive().optional(),
    employmentTitle: optionalText(160),
    startedOn: isoDateSchema,
    endedOn: optionalDate,
    notes: optionalText(2000),
  })
  .refine(hasValidDateRange("startedOn", "endedOn"), {
    message: "End date cannot be before the start date.",
    path: ["endedOn"],
  });

export const qualificationSchema = z.object({
  id: uuidSchema.optional(),
  employeeId: uuidSchema,
  name: z.string().trim().min(2).max(160),
  institution: z.string().trim().min(2).max(160),
  qualificationLevel: optionalText(80),
  fieldOfStudy: optionalText(160),
  awardedOn: isoDateSchema,
  notes: optionalText(2000),
});

export const certificationSchema = z
  .object({
    id: uuidSchema.optional(),
    employeeId: uuidSchema,
    name: z.string().trim().min(2).max(160),
    issuer: z.string().trim().min(2).max(160),
    credentialId: optionalText(160),
    issuedOn: isoDateSchema,
    expiresOn: optionalDate,
    notes: optionalText(2000),
  })
  .refine(hasValidDateRange("issuedOn", "expiresOn"), {
    message: "Expiry date cannot be before the issued date.",
    path: ["expiresOn"],
  });

export const trainingRecordSchema = z
  .object({
    id: uuidSchema.optional(),
    employeeId: uuidSchema,
    courseName: z.string().trim().min(2).max(160),
    provider: z.string().trim().min(2).max(160),
    completedOn: isoDateSchema,
    expiresOn: optionalDate,
    hours: z.coerce.number().min(0).max(9999.99).optional(),
    notes: optionalText(2000),
  })
  .refine(hasValidDateRange("completedOn", "expiresOn"), {
    message: "Expiry date cannot be before the completion date.",
    path: ["expiresOn"],
  });

export const employeeDirectoryFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().transform((value) => Math.min(value, 100)).default(25),
  search: z.string().trim().max(120).transform((value) => value || undefined).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  positionId: z.coerce.number().int().positive().optional(),
  employmentStatus: z.enum(employmentStatuses).optional(),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
export type ServiceHistoryInput = z.infer<typeof serviceHistorySchema>;
export type QualificationInput = z.infer<typeof qualificationSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;
export type TrainingRecordInput = z.infer<typeof trainingRecordSchema>;
export type EmployeeDirectoryFilters = z.infer<typeof employeeDirectoryFiltersSchema>;
