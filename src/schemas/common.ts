import { z } from "zod";

// Installs plain-language validation messages for every schema that imports this module.
import "./error-messages";

import { APP_ROLES } from "@/lib/types/roles";

export const appRoleSchema = z.enum(APP_ROLES);
export const uuidSchema = z.uuid();
export const isoDateSchema = z.iso.date();
/** PNP badge number: six digits written with a dash after the first digit, e.g. 1-23456. */
export const BADGE_NUMBER_PATTERN = /^\d-\d{5}$/;
export const employeeNumberSchema = z
  .string()
  .trim()
  .min(1, "Enter the badge number.")
  .regex(BADGE_NUMBER_PATTERN, "Badge number must be 6 digits in the format 0-00000.");
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
