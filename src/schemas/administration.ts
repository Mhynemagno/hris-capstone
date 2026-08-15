import { z } from "zod";

import { appRoleSchema, paginationSchema, uuidSchema } from "./common";
import { namePartsSchema, withFullName } from "./name";

const optionalTrimmedText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || undefined).optional();

const optionalFilterText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || undefined).optional();

const administrationPageSchema = paginationSchema.extend({
  pageSize: z.literal(20).default(20),
});

export const internalInvitationSchema = z.object({
  email: z.email(),
  ...namePartsSchema.shape,
  role: z.enum(["system_administrator", "hr_personnel", "employee", "management"]),
}).transform(withFullName);

export const managedUserUpdateSchema = z.object({
  userId: uuidSchema,
  role: appRoleSchema,
  isActive: z.boolean(),
});
export const managedUserDeleteSchema = z.object({ userId: uuidSchema });

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(160),
  isActive: z.boolean().default(true),
});

export const positionSchema = z.object({
  departmentId: z.union([z.coerce.number().int().positive(), z.null()]).default(null),
  title: z.string().trim().min(2).max(160),
  code: optionalTrimmedText(32),
  description: optionalTrimmedText(1000),
  isActive: z.boolean().default(true),
});

export const organizationSettingsSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  supportEmail: z.email(),
  defaultTimezone: z.string().trim().min(1).max(64),
});

export const administrationFiltersSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  role: appRoleSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
  entityType: z.string().trim().max(80).optional(),
  action: z.string().trim().max(80).optional(),
});

export const managedUserFiltersSchema = administrationPageSchema.extend({
  search: optionalFilterText(120),
  role: appRoleSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const referenceDataFiltersSchema = administrationPageSchema.extend({
  search: optionalFilterText(120),
  status: z.enum(["active", "inactive"]).optional(),
});

export const auditLogFiltersSchema = administrationPageSchema.extend({
  search: optionalFilterText(120),
  entityType: optionalFilterText(80),
  action: optionalFilterText(80),
});

export type ManagedUserUpdateInput = z.infer<typeof managedUserUpdateSchema>;
export type ManagedUserDeleteInput = z.infer<typeof managedUserDeleteSchema>;
export type InternalInvitationInput = z.infer<typeof internalInvitationSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type PositionInput = z.infer<typeof positionSchema>;
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
export type AdministrationFilters = z.infer<typeof administrationFiltersSchema>;
export type ManagedUserFilters = z.infer<typeof managedUserFiltersSchema>;
export type ReferenceDataFilters = z.infer<typeof referenceDataFiltersSchema>;
export type AuditLogFilters = z.infer<typeof auditLogFiltersSchema>;
