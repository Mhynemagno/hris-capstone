import { z } from "zod";

import { isoDateSchema, paginationSchema, uuidSchema } from "./common";

export const DEPLOYMENT_STATUSES = ["scheduled", "ongoing", "completed", "cancelled"] as const;
export const DEPLOYMENT_TYPES = ["Public Assembly", "Special Event", "Election Security", "Disaster Response"] as const;
export const EVENT_OPERATIONS = ["Rally", "Fiesta / Major Event", "Election Period", "Flood / Emergency", "Government Event"] as const;

export const deploymentStatusSchema = z.enum(DEPLOYMENT_STATUSES);
// Accepts null as well as text so already-parsed input (the form parses, then the query) validates again.
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional().transform((value) => value || null);

export const deploymentInputSchema = z.object({
  employeeId: uuidSchema,
  location: z.string({ error: "Location is required." }).trim().min(1, "Location is required.").max(200),
  unit: optionalText(200),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable().optional().transform((value) => value ?? null),
  status: deploymentStatusSchema,
  deploymentType: z.enum(DEPLOYMENT_TYPES, { error: "Select a deployment type." }),
  eventOperation: z.enum(EVENT_OPERATIONS, { error: "Select an event / operation." }),
  notes: z.string({ error: "Remarks are required." }).trim().min(1, "Remarks are required.").max(2000),
}).superRefine((value, context) => {
  if (value.endsOn && value.endsOn < value.startsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after start date." });
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
