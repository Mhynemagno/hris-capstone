import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { dashboardSummarySchema, reportResponseSchema, reportingFilters as parseReportingFilters, type ReportFilters } from "@/schemas/reporting";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function reportingFilters(input: unknown) {
  return parseReportingFilters(input);
}

function dashboardArgs(filters: Pick<ReportFilters, "startsOn" | "endsOn">) {
  return { target_starts_on: filters.startsOn, target_ends_on: filters.endsOn };
}

function reportArgs(filters: ReportFilters) {
  return { target_report_key: filters.reportKey, ...dashboardArgs(filters), target_department_id: filters.departmentId ?? null, target_status: filters.status ?? null, target_page: filters.page, target_page_size: filters.pageSize };
}

export async function getHrDashboard(input: unknown) {
  const filters = reportingFilters({ reportKey: "deployments", ...((input ?? {}) as object) });
  const { data, error } = await createBrowserSupabaseClient().rpc("get_hr_dashboard_summary", dashboardArgs(filters));
  throwIfError(error);
  return dashboardSummarySchema.parse(data);
}

export async function getManagementDashboard(input: unknown) {
  const filters = reportingFilters({ reportKey: "deployments", ...((input ?? {}) as object) });
  const { data, error } = await createBrowserSupabaseClient().rpc("get_management_dashboard_summary", dashboardArgs(filters));
  throwIfError(error);
  return dashboardSummarySchema.parse(data);
}

export async function getHrReport(input: unknown) {
  const filters = reportingFilters(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("get_hr_report", reportArgs(filters));
  throwIfError(error);
  return reportResponseSchema.parse(data);
}

export async function getManagementReport(input: unknown) {
  const filters = reportingFilters(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("get_management_report", reportArgs(filters));
  throwIfError(error);
  return reportResponseSchema.parse(data);
}
