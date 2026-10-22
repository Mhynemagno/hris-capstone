import { withSearch } from "@/lib/search";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Deployment, DeploymentReport, Employee, PaginatedResult } from "@/lib/types/database";
import { isoDateSchema, uuidSchema } from "@/schemas/common";
import { deploymentCancelSchema, deploymentFiltersSchema, deploymentGroupInputSchema, deploymentStatusProposalSchema, deploymentStatusReviewSchema, deploymentUpdateSchema, type DeploymentFilters } from "@/schemas/deployment-tracking";

function throwIfError(error: { message: string } | null) { if (error) throw new Error(error.message); }

export function deploymentFilters(input: unknown = {}) { return deploymentFiltersSchema.parse(input); }

/** The deployed employee's identity as shown in the HR list and details page. */
export type DeploymentEmployee = { id: string; employee_number: string; first_name: string; middle_name: string | null; last_name: string; qualifier: string | null; rank: { code: string } | null };
export type DeploymentWithEmployee = Deployment & { employee: DeploymentEmployee | null };

const employeeColumns = "id, employee_number, first_name, middle_name, last_name, qualifier, rank:ranks(code)";

export function deploymentEmployeeName(employee: Pick<DeploymentEmployee, "first_name" | "middle_name" | "last_name" | "qualifier"> | null | undefined) {
  return employee ? [employee.first_name, employee.middle_name, employee.last_name, employee.qualifier].filter(Boolean).join(" ") : null;
}

export async function listHrDeployments(input: Partial<DeploymentFilters> = {}): Promise<PaginatedResult<DeploymentWithEmployee, DeploymentFilters>> {
  const filters = deploymentFilters(input); const from = (filters.page - 1) * filters.pageSize;
  // Rank, name and badge number come with each row; the inner join also lets the HR dashboard leave retired personnel out.
  const columns = filters.activeEmployeesOnly ? `*, employee:employees!inner(${employeeColumns}, employment_status)` : `*, employee:employees(${employeeColumns})`;
  let query = createBrowserSupabaseClient().from("deployments").select(columns, { count: "exact" }).order("starts_on", { ascending: false }).order("id").range(from, from + filters.pageSize - 1);
  query = withSearch(query, filters.search);
  if (filters.activeEmployeesOnly) query = query.eq("employee.employment_status", "active");
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.deploymentType) query = query.eq("deployment_type", filters.deploymentType);
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters.startsOn) query = query.or(`ends_on.is.null,ends_on.gte.${filters.startsOn}`);
  if (filters.endsOn) query = query.lte("starts_on", filters.endsOn);
  const { data, error, count } = await query; throwIfError(error);
  // The employment status is only a filter; it is not part of the row.
  const rows = ((data ?? []) as unknown as Array<Deployment & { employee: (DeploymentEmployee & { employment_status?: string }) | null }>).map((row) => {
    if (!row.employee) return row as DeploymentWithEmployee;
    const employee = { ...row.employee }; delete employee.employment_status;
    return { ...row, employee } as DeploymentWithEmployee;
  });
  return { rows, count: count ?? 0, filters };
}

export async function listMyDeployments(input: Partial<DeploymentFilters> = {}): Promise<PaginatedResult<Deployment, DeploymentFilters>> {
  const filters = deploymentFilters(input); const from = (filters.page - 1) * filters.pageSize;
  let query = createBrowserSupabaseClient().from("deployments").select("*", { count: "exact" }).order("starts_on", { ascending: false }).range(from, from + filters.pageSize - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.startsOn) query = query.or(`ends_on.is.null,ends_on.gte.${filters.startsOn}`);
  if (filters.endsOn) query = query.lte("starts_on", filters.endsOn);
  const { data, error, count } = await query; throwIfError(error);
  return { rows: (data ?? []) as Deployment[], count: count ?? 0, filters };
}

export async function getDeployment(deploymentId: string) {
  const id = uuidSchema.parse(deploymentId);
  const { data, error } = await createBrowserSupabaseClient()
    .from("deployments")
    .select(`*, employee:employees(${employeeColumns})`)
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return (data as DeploymentWithEmployee | null) ?? null;
}

export const EMPLOYEE_OPTIONS_LIMIT = 2000;

export type EmployeeOption = {
  id: string;
  fullName: string;
  employeeNumber: string;
  rank: string | null;
  /** Position of the rank in the catalogue, so rank filters list junior ranks first. */
  rankSortOrder: number | null;
  department: string | null;
};

/** Active employees (up to 2000) for deployment pickers; retired personnel cannot be assigned new duty. */
export async function listEmployeeOptions(): Promise<EmployeeOption[]> {
  const { data, error } = await createBrowserSupabaseClient()
    .from("employees")
    .select("id, employee_number, first_name, middle_name, last_name, qualifier, rank:ranks(code, sort_order), department:departments(name)")
    .eq("employment_status", "active")
    .order("last_name")
    .order("first_name")
    .order("employee_number")
    .limit(EMPLOYEE_OPTIONS_LIMIT);
  throwIfError(error);
  type Row = Pick<Employee, "id" | "employee_number" | "first_name" | "middle_name" | "last_name" | "qualifier"> & { rank?: { code: string; sort_order: number } | null; department?: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    employeeNumber: row.employee_number,
    fullName: [row.first_name, row.middle_name, row.last_name, row.qualifier].filter(Boolean).join(" "),
    rank: row.rank?.code ?? null,
    rankSortOrder: row.rank?.sort_order ?? null,
    department: row.department?.name ?? null,
  }));
}

function localIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Employees with approved leave overlapping the given dates (today when none are chosen).
 * They are left out of the deployable list; the database refuses them as well.
 */
export async function listEmployeeIdsOnLeave(input: { startsOn?: string | null; endsOn?: string | null } = {}): Promise<string[]> {
  const startsOn = isoDateSchema.parse(input.startsOn || localIsoDate(new Date()));
  const endsOn = isoDateSchema.parse(input.endsOn && input.endsOn >= startsOn ? input.endsOn : startsOn);
  const { data, error } = await createBrowserSupabaseClient()
    .from("leave_requests")
    .select("employee_id")
    .eq("status", "approved")
    .lte("starts_on", endsOn)
    .gte("ends_on", startsOn);
  throwIfError(error);
  return [...new Set(((data ?? []) as Array<{ employee_id: string }>).map((row) => row.employee_id))];
}

/** Creates a single deployment header with one assignment row for every selected employee. */
export async function createDeploymentGroup(input: unknown) {
  const values = deploymentGroupInputSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("create_deployment_group", {
    target_location: values.location,
    target_unit: values.unit,
    target_starts_on: values.startsOn,
    target_ends_on: values.endsOn,
    target_deployment_type: values.deploymentType,
    target_event_operation: values.eventOperation,
    target_assignments: values.assignments,
  });
  throwIfError(error);
  return data as string;
}

/** HR edits one employee's deployment details. The status is never sent: HR can only cancel. */
export async function updateDeployment(input: unknown) {
  const values = deploymentUpdateSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().rpc("update_deployment_details", {
    target_deployment_id: values.id,
    expected_updated_at: values.expectedUpdatedAt,
    target_location: values.location,
    target_starts_on: values.startsOn,
    target_ends_on: values.endsOn,
    target_deployment_type: values.deploymentType,
    target_event_operation: values.eventOperation,
    target_task: values.task,
  });
  throwIfError(error);
}

/** HR's only direct status action. */
export async function cancelDeployment(input: unknown) {
  const values = deploymentCancelSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().rpc("cancel_deployment", { target_deployment_id: values.id, expected_updated_at: values.expectedUpdatedAt });
  throwIfError(error);
}

/** The deployed employee asks HR to set Ongoing or Completed (Completed needs submitted proof). */
export async function proposeDeploymentStatus(input: unknown) {
  const values = deploymentStatusProposalSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().rpc("propose_deployment_status", { target_deployment_id: values.deploymentId, target_status: values.status });
  throwIfError(error);
}

/** HR approves (applies) or rejects (clears) the employee's proposed status. */
export async function reviewDeploymentStatus(input: unknown) {
  const values = deploymentStatusReviewSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().rpc("review_deployment_status", { target_deployment_id: values.id, approve: values.approve });
  throwIfError(error);
}

const deploymentReportBucket = "deployment-reports";
const reportExtensions: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export type DeploymentReportInput = { deploymentId: string; notes?: string; file: File | null };

/** The deployed employee submits a report / proof of attendance; the file is removed again if the report is refused. */
export async function submitDeploymentReport({ deploymentId, notes, file }: DeploymentReportInput) {
  const id = uuidSchema.parse(deploymentId);
  if (!file) throw new Error("Attach the report or proof of attendance.");
  const extension = reportExtensions[file.type];
  if (!extension || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Use a PDF, PNG, JPEG, or WebP file up to 10 MB.");
  const client = createBrowserSupabaseClient();
  const objectPath = `deployments/${id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from(deploymentReportBucket).upload(objectPath, file, { contentType: file.type, upsert: false });
  throwIfError(uploadError);
  const { data, error } = await client.rpc("submit_deployment_report", { target_deployment_id: id, target_notes: notes?.trim() || null, target_document: { objectPath, fileName: file.name.slice(0, 255), mimeType: file.type, sizeBytes: file.size } });
  if (error) {
    await client.storage.from(deploymentReportBucket).remove([objectPath]).catch(() => undefined);
    throw new Error(error.message);
  }
  return data as string;
}

export async function listDeploymentReports(deploymentId: string) {
  const id = uuidSchema.parse(deploymentId);
  const { data, error } = await createBrowserSupabaseClient().from("deployment_reports").select("*").eq("deployment_id", id).order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as DeploymentReport[];
}

export async function getDeploymentReportUrl(objectPath: string) {
  const { data, error } = await createBrowserSupabaseClient().storage.from(deploymentReportBucket).createSignedUrl(objectPath, 60);
  throwIfError(error);
  if (!data?.signedUrl) throw new Error("Unable to open the report.");
  return data.signedUrl;
}
