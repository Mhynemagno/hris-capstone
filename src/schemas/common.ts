import { z } from "zod";

// Installs plain-language validation messages for every schema that imports this module.
import "./error-messages";

import { APP_ROLES } from "@/lib/types/roles";

export const appRoleSchema = z.enum(APP_ROLES);
export const uuidSchema = z.uuid();
export const isoDateSchema = z.iso.date();
/** Badge number, as stored on personnel records: 3-32 characters, uppercase. */
export const employeeNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, "Badge number must be at least 3 characters.")
  .max(32, "Badge number must be at most 32 characters.");
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
