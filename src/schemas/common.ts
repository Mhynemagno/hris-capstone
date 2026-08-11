import { z } from "zod";

import { APP_ROLES } from "@/lib/types/roles";

export const appRoleSchema = z.enum(APP_ROLES);
export const uuidSchema = z.uuid();
export const isoDateSchema = z.iso.date();
export const employeeNumberSchema = z
  .string()
  .trim()
  .regex(/^EMP-\d{4}-\d{3,}$/, "Use the format EMP-YYYY-###.");
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
