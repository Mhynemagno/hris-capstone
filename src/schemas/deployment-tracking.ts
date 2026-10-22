import { z } from "zod";

import { isoDateSchema, paginationSchema, uuidSchema } from "./common";

export const DEPLOYMENT_STATUSES = ["scheduled", "ongoing", "completed", "cancelled"] as const;
export const DEPLOYMENT_TYPES = ["Public Assembly", "Special Event", "Election Security", "Disaster Response"] as const;
export const EVENT_OPERATIONS = ["Rally", "Fiesta / Major Event", "Election Period", "Flood / Emergency", "Government Event"] as const;
export const DEPLOYMENT_TASKS = ["Deployed", "Reserve/Standby"] as const;

/** Event choices are restricted by the selected deployment type rather than shown as one unrelated list. */
export const DEPLOYMENT_TYPE_EVENTS = {
  "Public Assembly": ["Rally"],
  "Special Event": ["Fiesta / Major Event", "Government Event"],
  "Election Security": ["Election Period"],
  "Disaster Response": ["Flood / Emergency"],
} as const satisfies Record<(typeof DEPLOYMENT_TYPES)[number], ReadonlyArray<(typeof EVENT_OPERATIONS)[number]>>;

export const deploymentStatusSchema = z.enum(DEPLOYMENT_STATUSES);
export const deploymentTaskSchema = z.enum(DEPLOYMENT_TASKS);
/** The deployed employee may only ask for these; HR approves or rejects, and can only cancel. */
export const DEPLOYMENT_PROPOSED_STATUSES = ["ongoing", "completed"] as const;
// Accepts null as well as text so already-parsed input (the form parses, then the query) validates again.
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional().transform((value) => value || null);

export function eventMatchesDeploymentType(deploymentType: string | null | undefined, eventOperation: string | null | undefined) {
  if (!deploymentType || !eventOperation || !(deploymentType in DEPLOYMENT_TYPE_EVENTS)) return false;
  return (DEPLOYMENT_TYPE_EVENTS[deploymentType as (typeof DEPLOYMENT_TYPES)[number]] as readonly string[]).includes(eventOperation);
}

/** Details HR can change on one employee's deployment. The status is never edited here. */
export const deploymentInputSchema = z.object({
  location: z.string({ error: "Location is required." }).trim().min(1, "Location is required.").max(200),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable().optional().transform((value) => value ?? null),
  deploymentType: z.enum(DEPLOYMENT_TYPES, { error: "Select a deployment type." }),
  eventOperation: z.enum(EVENT_OPERATIONS, { error: "Select an event / operation." }),
  task: deploymentTaskSchema,
}).superRefine((value, context) => {
  if (value.endsOn && value.endsOn < value.startsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after start date." });
  if (!eventMatchesDeploymentType(value.deploymentType, value.eventOperation)) {
    context.addIssue({ code: "custom", path: ["eventOperation"], message: "Select an event or operation for this deployment type." });
  }
});

/** A header shared by one or more employee assignments created in the same deployment action. */
export const deploymentGroupInputSchema = z.object({
  location: z.string({ error: "Location is required." }).trim().min(1, "Location is required.").max(200),
  unit: optionalText(200),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable().optional().transform((value) => value ?? null),
  deploymentType: z.enum(DEPLOYMENT_TYPES, { error: "Select a deployment type." }),
  eventOperation: z.enum(EVENT_OPERATIONS, { error: "Select an event / operation." }),
  assignments: z.array(z.object({ employeeId: uuidSchema, task: deploymentTaskSchema })).min(1, "Choose at least one employee.").max(200),
}).superRefine((value, context) => {
  if (value.endsOn && value.endsOn < value.startsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after start date." });
  const employeeIds = value.assignments.map((assignment) => assignment.employeeId);
  if (new Set(employeeIds).size !== employeeIds.length) context.addIssue({ code: "custom", path: ["assignments"], message: "Each employee can only be selected once." });
  if (!eventMatchesDeploymentType(value.deploymentType, value.eventOperation)) {
    context.addIssue({ code: "custom", path: ["eventOperation"], message: "Select an event or operation for this deployment type." });
  }
});

export const deploymentUpdateSchema = deploymentInputSchema.and(z.object({
  id: uuidSchema,
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}));

export const deploymentCancelSchema = z.object({ id: uuidSchema, expectedUpdatedAt: z.string().datetime({ offset: true }) });

export const deploymentStatusProposalSchema = z.object({
  deploymentId: uuidSchema,
  status: z.enum(DEPLOYMENT_PROPOSED_STATUSES, { error: "Choose Ongoing or Completed." }),
});

export const deploymentStatusReviewSchema = z.object({ id: uuidSchema, approve: z.boolean() });

export const deploymentFiltersSchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().positive().transform((value) => Math.min(value, 100)).default(25),
  status: deploymentStatusSchema.optional(),
  deploymentType: z.enum(DEPLOYMENT_TYPES).optional(),
  employeeId: uuidSchema.optional(),
  search: z.string().trim().max(200).transform((value) => value || undefined).optional(),
  /** Only deployments of personnel who are still active (the HR dashboard leaves retired personnel out). */
  activeEmployeesOnly: z.boolean().optional(),
  startsOn: isoDateSchema.optional(),
  endsOn: isoDateSchema.optional(),
}).superRefine((value, context) => {
  if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after start date." });
});

export type DeploymentInput = z.infer<typeof deploymentInputSchema>;
export type DeploymentGroupInput = z.infer<typeof deploymentGroupInputSchema>;
export type DeploymentUpdateInput = z.infer<typeof deploymentUpdateSchema>;
export type DeploymentStatusProposal = z.infer<typeof deploymentStatusProposalSchema>;
export type DeploymentFilters = z.infer<typeof deploymentFiltersSchema>;
