import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MasterlistRow } from "@/lib/reporting/masterlist";
import { dashboardSummarySchema, hrDashboardOverviewSchema, reportResponseSchema, reportingFilters as parseReportingFilters, type ReportFilters } from "@/schemas/reporting";

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

/** Fetches every report page for a CSV export or printed report. */
export async function getFullReport(input: unknown, role: "hr_personnel" | "management") {
  const filters = reportingFilters(input);
  const getReport = role === "hr_personnel" ? getHrReport : getManagementReport;
  const first = await getReport({ ...filters, page: 1, pageSize: 100 });
  const rows = [...first.rows];

  for (let page = 2; rows.length < first.totalCount && page <= 100; page += 1) {
    const next = await getReport({ ...filters, page, pageSize: 100 });
    if (!next.rows.length) break;
    rows.push(...next.rows);
  }

  return { ...first, rows, page: 1 };
}

export async function getHrDashboardOverview() {
  const { data, error } = await createBrowserSupabaseClient().rpc("get_hr_dashboard_overview");
  throwIfError(error);
  return hrDashboardOverviewSchema.parse(data);
}

/** Active personnel for the Export Station Masterlist button (Capstone UI reports.html). */
export async function listStationMasterlist(): Promise<MasterlistRow[]> {
  const { data, error } = await createBrowserSupabaseClient()
    .from("employees")
    .select("employee_number, first_name, middle_name, last_name, employment_status, ranks(code), departments(name)")
    .eq("employment_status", "active")
    .order("last_name")
    .order("first_name");
  throwIfError(error);
  type Row = { employee_number: string; first_name: string; middle_name: string | null; last_name: string; employment_status: string; ranks: { code: string } | { code: string }[] | null; departments: { name: string } | { name: string }[] | null };
  const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] ?? null : value);
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    badge: row.employee_number,
    rank: one(row.ranks)?.code ?? null,
    name: `${row.last_name}, ${[row.first_name, row.middle_name].filter(Boolean).join(" ")}`,
    unit: one(row.departments)?.name ?? null,
    status: row.employment_status,
  }));
}
