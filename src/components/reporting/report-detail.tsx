"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyTableState } from "@/components/ui/empty-table-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { useDepartmentOptions } from "@/hooks/use-administration";
import { useReport } from "@/hooks/use-reporting";
import { toReportCsv } from "@/lib/reporting/csv";
import { reportFiltersSchema, type ReportFilters } from "@/schemas/reporting";

type ReportKey = ReportFilters["reportKey"];
type StatusOption = { value: string; label: string; group?: string };

export const REPORT_TITLES: Record<ReportKey, string> = {
  "applicant-tracking": "Applicant tracking",
  "hiring-decisions": "Hiring decisions",
  "employee-performance": "Employee performance",
  deployments: "Deployments",
  "attendance-leave": "Attendance and leave",
  "promotion-training-needs": "Promotion and training needs",
};

const applicationStatuses = ["Submitted", "Under Review", "Shortlisted", "Interview", "Needs Revision", "Hired", "Not Selected"];

/**
 * The value each report's `target_status` is compared against in get_hr_report / get_management_report
 * (supabase/migrations/20260823220009_dashboards_and_reports.sql) and the matching table check constraints.
 */
export const REPORT_STATUS_FILTERS: Record<ReportKey, { label: string; options: StatusOption[] }> = {
  "applicant-tracking": {
    label: "Application status",
    options: applicationStatuses.map((value) => ({ value, label: value })),
  },
  "hiring-decisions": {
    label: "Decision",
    options: [
      { value: "Hired", label: "Hired" },
      { value: "Not Selected", label: "Not selected" },
    ],
  },
  "employee-performance": {
    label: "Employment status",
    options: [
      { value: "active", label: "Active" },
      { value: "on_leave", label: "On leave" },
    ],
  },
  deployments: {
    label: "Deployment status",
    options: [
      { value: "active", label: "Active" },
      { value: "rejected", label: "Rejected" },
    ],
  },
  "attendance-leave": {
    label: "Record status",
    options: [
      { value: "present", label: "Present", group: "Attendance" },
      { value: "late", label: "Late", group: "Attendance" },
      { value: "absent", label: "Absent", group: "Attendance" },
      { value: "incomplete", label: "Incomplete", group: "Attendance" },
      { value: "pending", label: "Pending", group: "Leave" },
      { value: "approved", label: "Approved", group: "Leave" },
      { value: "rejected", label: "Rejected", group: "Leave" },
      { value: "cancelled", label: "Cancelled", group: "Leave" },
    ],
  },
  "promotion-training-needs": {
    label: "Recommendation",
    options: [
      { value: "recommended", label: "Recommended" },
      { value: "deferred", label: "Deferred" },
      { value: "not_recommended", label: "Not recommended" },
    ],
  },
};

export type DraftFilters = { startsOn: string; endsOn: string; departmentId: string; status: string };
const emptyDraft: DraftFilters = { startsOn: "", endsOn: "", departmentId: "", status: "" };

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && !Number.isInteger(value)) return value.toFixed(2);
  return String(value);
}

function buildFilters(reportKey: ReportKey, draft: DraftFilters, page = 1) {
  const statusOptions = REPORT_STATUS_FILTERS[reportKey].options;
  return {
    reportKey,
    startsOn: draft.startsOn || undefined,
    endsOn: draft.endsOn || undefined,
    departmentId: draft.departmentId ? Number(draft.departmentId) : undefined,
    status: statusOptions.some((option) => option.value === draft.status) ? draft.status : undefined,
    page,
  };
}

/** Returns an inline message when the date range is invalid (start after end, or after today with no end). */
export function reportDateRangeError(reportKey: ReportKey, draft: DraftFilters) {
  if (reportFiltersSchema.safeParse(buildFilters(reportKey, draft)).success) return undefined;
  return draft.startsOn && !draft.endsOn
    ? "The start date is after today. Choose an end date on or after the start date."
    : "End date must be on or after the start date.";
}

export function ReportDetail({ role, reportKey }: { role: "hr_personnel" | "management"; reportKey: ReportKey }) {
  const [draft, setDraft] = useState<DraftFilters>(emptyDraft);
  // Only valid filters are applied: useReport parses them during render and the RPC rejects start > end.
  const [applied, setApplied] = useState(() => buildFilters(reportKey, emptyDraft));
  if (applied.reportKey !== reportKey) {
    // Status values differ per report; reset filters when navigating to another report.
    setDraft(emptyDraft);
    setApplied(buildFilters(reportKey, emptyDraft));
  }
  const query = useReport(applied.reportKey === reportKey ? applied : { reportKey }, role);

  const statusFilter = REPORT_STATUS_FILTERS[reportKey];
  const departments = useDepartmentOptions();
  const departmentOptions = (departments.data ?? []).filter(
    (department) => department.is_active || String(department.id) === draft.departmentId,
  );
  const dateError = reportDateRangeError(reportKey, draft);

  const updateDraft = (next: Partial<DraftFilters>) => {
    const nextDraft = { ...draft, ...next };
    setDraft(nextDraft);
    if (!reportDateRangeError(reportKey, nextDraft)) setApplied(buildFilters(reportKey, nextDraft));
  };
  const setPage = (page: number) => setApplied((current) => ({ ...current, page }));
  const hasFilters = Object.values(draft).some(Boolean);
  const title = REPORT_TITLES[reportKey];

  const download = () => {
    if (!query.data) return;
    const href = URL.createObjectURL(new Blob([toReportCsv(query.data)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `${query.data.reportKey}-${query.data.generatedAt.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const departmentName = departments.data?.find((department) => String(department.id) === String(applied.departmentId ?? ""))?.name;
  const statusName = statusFilter.options.find((option) => option.value === applied.status)?.label;
  const groups = Array.from(new Set(statusFilter.options.map((option) => option.group).filter(Boolean))) as string[];

  return (
    <section className="space-y-6">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button disabled={!query.data} onClick={download} type="button" variant="outline">
              Download CSV
            </Button>
            <Button onClick={() => window.print()} type="button">
              Print report
            </Button>
          </div>
        }
        eyebrow="Reports"
        title={title}
      />
      <form
        aria-label="Report filters"
        className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField description="Defaults to the last 30 days." htmlFor="report-starts-on" label="Start date">
          <Input
            id="report-starts-on"
            max={draft.endsOn || undefined}
            onChange={(event) => updateDraft({ startsOn: event.target.value })}
            type="date"
            value={draft.startsOn}
          />
        </FormField>
        <FormField error={dateError} htmlFor="report-ends-on" label="End date">
          <Input
            id="report-ends-on"
            min={draft.startsOn || undefined}
            onChange={(event) => updateDraft({ endsOn: event.target.value })}
            type="date"
            value={draft.endsOn}
          />
        </FormField>
        <FormField
          description={departments.error ? "Department list unavailable; showing all departments." : undefined}
          htmlFor="report-department"
          label="Department"
        >
          <select
            className={nativeSelectClassName}
            disabled={departments.isLoading || Boolean(departments.error)}
            id="report-department"
            onChange={(event) => updateDraft({ departmentId: event.target.value })}
            value={draft.departmentId}
          >
            <option value="">All departments</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
                {department.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="report-status" label={statusFilter.label}>
          <select
            className={nativeSelectClassName}
            id="report-status"
            onChange={(event) => updateDraft({ status: event.target.value })}
            value={draft.status}
          >
            <option value="">All</option>
            {groups.length
              ? groups.map((group) => (
                  <optgroup key={group} label={group}>
                    {statusFilter.options
                      .filter((option) => option.group === group)
                      .map((option) => (
                        <option key={`${group}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </optgroup>
                ))
              : statusFilter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
          </select>
        </FormField>
        <div className="sm:col-span-2 lg:col-span-4">
          <Button disabled={!hasFilters} onClick={() => updateDraft(emptyDraft)} type="button" variant="outline">
            Clear filters
          </Button>
        </div>
      </form>
      {query.isLoading ? (
        <LoadingState label="Loading report…" />
      ) : query.error ? (
        <ErrorState message={query.error.message} />
      ) : query.data ? (
        <div className="space-y-3">
          <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
            Showing {query.data.totalCount} matching record{query.data.totalCount === 1 ? "" : "s"} ·{" "}
            {applied.startsOn ?? "last 30 days"}
            {applied.startsOn || applied.endsOn ? ` to ${applied.endsOn ?? "today"}` : ""} · {departmentName ?? "All departments"} ·{" "}
            {statusName ?? `All ${statusFilter.label.toLowerCase()} values`}
          </p>
          <div className="relative overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">{query.data.title}</caption>
              <thead className="bg-muted/60">
                <tr>
                  {query.data.columns.map((column) => (
                    <th className="px-4 py-3 font-semibold text-muted-foreground" key={column.key} scope="col">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.rows.length ? (
                  query.data.rows.map((row, index) => (
                    <tr className="border-t" key={index}>
                      {query.data.columns.map((column) => (
                        <td className="px-4 py-3 align-top" key={column.key}>
                          {formatCell(row[column.key])}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <EmptyTableState
                      colSpan={query.data.columns.length}
                      message={
                        hasFilters
                          ? "No records match these filters. Widen the date range or clear filters."
                          : "No records in the last 30 days. Choose an earlier start date to see older records."
                      }
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <nav aria-label="Report pages" className="flex items-center justify-between gap-3 print:hidden">
            <Button
              disabled={query.data.page === 1}
              onClick={() => setPage(query.data.page - 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {query.data.page} of {Math.max(1, Math.ceil(query.data.totalCount / query.data.pageSize))}
            </span>
            <Button
              disabled={query.data.page * query.data.pageSize >= query.data.totalCount}
              onClick={() => setPage(query.data.page + 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Next
            </Button>
          </nav>
        </div>
      ) : null}
    </section>
  );
}
