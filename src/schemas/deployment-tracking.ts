import { z } from "zod";

import { isoDateSchema, paginationSchema, uuidSchema } from "./common";

export const deploymentStatusSchema = z.enum(["planned", "active", "completed", "cancelled"]);
const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null).optional().default(null);

export const deploymentInputSchema = z.object({
  employeeId: uuidSchema,
  location: optionalText(200),
  unit: optionalText(200),
  project: optionalText(200),
  assignmentRole: z.string().trim().min(1, "Assignment role is required.").max(200),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable().optional().transform((value) => value ?? null),
  status: deploymentStatusSchema,
  notes: optionalText(2000),
}).superRefine((value, context) => {
  if (!value.location && !value.unit && !value.project) context.addIssue({ code: "custom", path: ["location"], message: "Provide a location, unit, or project." });
  if (value.endsOn && value.endsOn < value.startsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after start date." });
  if (value.status === "completed" && !value.endsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "An end date is required for a completed deployment." });
});

export const deploymentUpdateSchema = deploymentInputSchema.extend({
  id: uuidSchema,
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export const deploymentFiltersSchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().positive().transform((value) => Math.min(value, 100)).default(25),
  status: deploymentStatusSchema.optional(),
  employeeId: uuidSchema.optional(),
  startsOn: isoDateSchema.optional(),
  endsOn: isoDateSchema.optional(),
}).superRefine((value, context) => {
  if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after start date." });
});

export type DeploymentInput = z.infer<typeof deploymentInputSchema>;
export type DeploymentUpdateInput = z.infer<typeof deploymentUpdateSchema>;
export type DeploymentFilters = z.infer<typeof deploymentFiltersSchema>;
