import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AttendanceImport, AttendanceIntegrationSettings, AttendanceLog, AttendanceUnmatchedEvent, Employee, PaginatedResult } from "@/lib/types/database";
import { attendanceFiltersSchema, attendanceImportFileSchema, attendanceMappingSchema, attendanceSettingsSchema, type AttendanceFilters } from "@/schemas/attendance-integration";

function throwIfError(error: { message: string } | null) { if (error) throw new Error(error.message); }

export function attendanceFilters(input: unknown = {}) { return attendanceFiltersSchema.parse(input); }

export async function listHrAttendanceLogs(input: Partial<AttendanceFilters> = {}): Promise<PaginatedResult<AttendanceLog, AttendanceFilters>> {
  const filters = attendanceFilters(input); const from = (filters.page - 1) * filters.pageSize;
  let query = createBrowserSupabaseClient().from("attendance_logs").select("*, employee:employees(id, employee_number, first_name, last_name)", { count: "exact" }).order("attendance_date", { ascending: false }).range(from, from + filters.pageSize - 1);
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.startsOn) query = query.gte("attendance_date", filters.startsOn);
  if (filters.endsOn) query = query.lte("attendance_date", filters.endsOn);
  const { data, error, count } = await query; throwIfError(error);
  return { rows: (data ?? []) as AttendanceLog[], count: count ?? 0, filters };
}

export async function listMyAttendanceLogs(input: Partial<AttendanceFilters> = {}): Promise<PaginatedResult<AttendanceLog, AttendanceFilters>> {
  const filters = attendanceFilters(input); const from = (filters.page - 1) * filters.pageSize;
  let query = createBrowserSupabaseClient().from("attendance_logs").select("*", { count: "exact" }).order("attendance_date", { ascending: false }).range(from, from + filters.pageSize - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.startsOn) query = query.gte("attendance_date", filters.startsOn);
  if (filters.endsOn) query = query.lte("attendance_date", filters.endsOn);
  const { data, error, count } = await query; throwIfError(error);
  return { rows: (data ?? []) as AttendanceLog[], count: count ?? 0, filters };
}

export async function listAttendanceImports(input: Partial<AttendanceFilters> = {}): Promise<PaginatedResult<AttendanceImport, AttendanceFilters>> {
  const filters = attendanceFilters(input); const from = (filters.page - 1) * filters.pageSize;
  const query = createBrowserSupabaseClient().from("attendance_imports").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + filters.pageSize - 1);
  const { data, error, count } = await query; throwIfError(error);
  return { rows: (data ?? []) as AttendanceImport[], count: count ?? 0, filters };
}

export async function listUnmatchedAttendanceEvents(input: Partial<AttendanceFilters> = {}): Promise<PaginatedResult<AttendanceUnmatchedEvent, AttendanceFilters>> {
  const filters = attendanceFilters(input); const from = (filters.page - 1) * filters.pageSize;
  let query = createBrowserSupabaseClient().from("attendance_unmatched_events").select("*", { count: "exact" }).is("resolved_at", null).order("created_at", { ascending: false }).range(from, from + filters.pageSize - 1);
  if (filters.startsOn) query = query.gte("attendance_date", filters.startsOn);
  if (filters.endsOn) query = query.lte("attendance_date", filters.endsOn);
  const { data, error, count } = await query; throwIfError(error);
  return { rows: (data ?? []) as AttendanceUnmatchedEvent[], count: count ?? 0, filters };
}

export async function getAttendanceSettings() {
  const { data, error } = await createBrowserSupabaseClient().from("attendance_integration_settings").select("*").eq("adapter_key", "csv_xlsx").maybeSingle();
  throwIfError(error); return data as AttendanceIntegrationSettings | null;
}

export async function listAttendanceEmployees() {
  const { data, error } = await createBrowserSupabaseClient().from("employees").select("id, employee_number, first_name, last_name").order("employee_number");
  throwIfError(error); return (data ?? []) as Pick<Employee, "id" | "employee_number" | "first_name" | "last_name">[];
}

export async function importAttendanceFile(file: File) {
  attendanceImportFileSchema.parse({ name: file.name, type: file.type, size: file.size });
  const body = new FormData(); body.append("file", file);
  const { data, error } = await createBrowserSupabaseClient().functions.invoke("import-attendance", { body });
  throwIfError(error); return data as { importId: string; acceptedCount: number; duplicateCount: number; unmatchedCount: number; invalidCount: number; status: "completed" | "completed_with_issues" };
}

export async function saveAttendanceSettings(input: unknown) {
  const values = attendanceSettingsSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().rpc("update_attendance_integration_settings", { target_template_version: values.templateVersion, target_workday_start: values.workdayStart, target_late_grace_minutes: values.lateGraceMinutes, target_timezone: "Asia/Ulaanbaatar", target_enabled: values.isEnabled });
  throwIfError(error);
}

export async function resolveUnmatchedAttendanceEvent(input: unknown) {
  const values = attendanceMappingSchema.parse(input);
  if (!values.unmatchedEventId) throw new Error("An unmatched attendance event is required.");
  const { data, error } = await createBrowserSupabaseClient().rpc("resolve_attendance_unmatched_event", { target_unmatched_event_id: values.unmatchedEventId, target_employee_id: values.employeeId });
  throwIfError(error); return data as string;
}
