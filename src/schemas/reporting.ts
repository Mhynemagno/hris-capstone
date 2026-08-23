import { z } from "zod";

import { isoDateSchema } from "./common";

export const REPORT_KEYS = [
  "applicant-tracking",
  "hiring-decisions",
  "employee-performance",
  "deployments",
  "attendance-leave",
  "promotion-training-needs",
] as const;

export const reportKeySchema = z.enum(REPORT_KEYS);

function defaultRange() {
  const endsOn = new Date();
  const startsOn = new Date(endsOn);
  startsOn.setDate(startsOn.getDate() - 29);
  return {
    startsOn: startsOn.toISOString().slice(0, 10),
    endsOn: endsOn.toISOString().slice(0, 10),
  };
}

export const reportFiltersSchema = z
  .object({
    reportKey: reportKeySchema,
    startsOn: isoDateSchema.optional(),
    endsOn: isoDateSchema.optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    status: z.string().trim().min(1).max(64).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .transform((value) => ({ ...defaultRange(), ...value }))
  .superRefine((value, context) => {
    if (value.startsOn > value.endsOn) {
      context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must not precede start date." });
    }
  });

const reportCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const reportColumnSchema = z.object({ key: z.string().trim().min(1).max(64), label: z.string().trim().min(1).max(120) });
export const reportResponseSchema = z.object({
  reportKey: reportKeySchema,
  title: z.string().trim().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  columns: z.array(reportColumnSchema).min(1),
  rows: z.array(z.record(z.string(), reportCellSchema)),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
}).superRefine((value, context) => {
  const columnKeys = new Set(value.columns.map((column) => column.key));
  value.rows.forEach((row, rowIndex) => Object.keys(row).forEach((key) => {
    if (!columnKeys.has(key)) context.addIssue({ code: "custom", path: ["rows", rowIndex, key], message: "Report row contains an undeclared column." });
  }));
});

export const breakdownItemSchema = z.object({ label: z.string(), count: z.number().int().nonnegative() });
export const dashboardSummarySchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  range: z.object({ startsOn: isoDateSchema, endsOn: isoDateSchema }),
  metrics: z.record(z.string(), z.number().int().nonnegative()),
  breakdowns: z.record(z.string(), z.array(breakdownItemSchema)),
});

export type ReportFilters = z.output<typeof reportFiltersSchema>;
export type ReportResponse = z.output<typeof reportResponseSchema>;
export type DashboardSummary = z.output<typeof dashboardSummarySchema>;

export function reportingFilters(input: unknown) {
  return reportFiltersSchema.parse(input);
}
