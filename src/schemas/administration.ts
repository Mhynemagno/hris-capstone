import { z } from "zod";

import { appRoleSchema, paginationSchema, uuidSchema } from "./common";

const optionalTrimmedText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || undefined).optional();

export const managedUserUpdateSchema = z.object({
  userId: uuidSchema,
  role: appRoleSchema,
  isActive: z.boolean(),
});

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

export type ManagedUserUpdateInput = z.infer<typeof managedUserUpdateSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type PositionInput = z.infer<typeof positionSchema>;
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
export type AdministrationFilters = z.infer<typeof administrationFiltersSchema>;
