"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getHrDashboard, getHrReport, getManagementDashboard, getManagementReport, reportingFilters } from "@/queries/reporting";
import type { ReportFilters } from "@/schemas/reporting";

type ReportingRole = "hr_personnel" | "management";

export function useHrDashboard(input: Partial<Pick<ReportFilters, "startsOn" | "endsOn">> = {}) {
  const filters = reportingFilters({ reportKey: "deployments", ...input });
  return useQuery({ queryKey: queryKeys.reporting.dashboard("hr_personnel", filters), queryFn: () => getHrDashboard(filters), staleTime: 60_000 });
}

export function useManagementDashboard(input: Partial<Pick<ReportFilters, "startsOn" | "endsOn">> = {}) {
  const filters = reportingFilters({ reportKey: "deployments", ...input });
  return useQuery({ queryKey: queryKeys.reporting.dashboard("management", filters), queryFn: () => getManagementDashboard(filters), staleTime: 60_000 });
}

export function useReport(input: Partial<ReportFilters> & Pick<ReportFilters, "reportKey">, role: ReportingRole) {
  const filters = reportingFilters(input);
  return useQuery({ queryKey: queryKeys.reporting.report(role, filters), queryFn: () => role === "hr_personnel" ? getHrReport(filters) : getManagementReport(filters), staleTime: 60_000 });
}
