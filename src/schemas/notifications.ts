import { z } from "zod";

import { uuidSchema } from "./common";

const notificationTypeSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,63}$/, "Use lowercase snake case for the notification type.");

const notificationLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/\s/.test(value),
    "Use a safe internal link.",
  );

export const notificationCreateSchema = z.object({
  recipientUserId: uuidSchema,
  type: notificationTypeSchema,
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
  link: notificationLinkSchema.optional(),
});

export const notificationFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().transform((value) => Math.min(value, 100)).default(20),
});

export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
export type NotificationFilters = z.infer<typeof notificationFiltersSchema>;
