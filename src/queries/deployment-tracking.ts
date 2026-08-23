import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Deployment, DeploymentHistory, PaginatedResult } from "@/lib/types/database";
import { uuidSchema } from "@/schemas/common";
import { deploymentFiltersSchema, deploymentInputSchema, deploymentUpdateSchema, type DeploymentFilters } from "@/schemas/deployment-tracking";

function throwIfError(error: { message: string } | null) { if (error) throw new Error(error.message); }

export function deploymentFilters(input: unknown = {}) { return deploymentFiltersSchema.parse(input); }

export type DeploymentWithHistory = Deployment & { deployment_history: DeploymentHistory[] };

export async function listHrDeployments(input: Partial<DeploymentFilters> = {}): Promise<PaginatedResult<Deployment, DeploymentFilters>> {
  const filters = deploymentFilters(input); const from = (filters.page - 1) * filters.pageSize;
  let query = createBrowserSupabaseClient().from("deployments").select("*", { count: "exact" }).order("starts_on", { ascending: false }).range(from, from + filters.pageSize - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters.startsOn) query = query.or(`ends_on.is.null,ends_on.gte.${filters.startsOn}`);
  if (filters.endsOn) query = query.lte("starts_on", filters.endsOn);
  const { data, error, count } = await query; throwIfError(error);
  return { rows: (data ?? []) as Deployment[], count: count ?? 0, filters };
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
  const { data, error } = await createBrowserSupabaseClient().from("deployments").select("*, deployment_history(*)").eq("id", id).maybeSingle();
  throwIfError(error);
  if (!data) return null;
  const deployment = data as DeploymentWithHistory;
  deployment.deployment_history.sort((left, right) => left.created_at.localeCompare(right.created_at));
  return deployment;
}

function rpcPayload(input: ReturnType<typeof deploymentInputSchema.parse>) {
  return { target_employee_id: input.employeeId, target_location: input.location, target_unit: input.unit, target_project: input.project, target_assignment_role: input.assignmentRole, target_starts_on: input.startsOn, target_ends_on: input.endsOn, target_status: input.status, target_notes: input.notes };
}

export async function createDeployment(input: unknown) {
  const values = deploymentInputSchema.parse(input); const { data, error } = await createBrowserSupabaseClient().rpc("create_deployment", rpcPayload(values)); throwIfError(error); return data as string;
}

export async function updateDeployment(input: unknown) {
  const values = deploymentUpdateSchema.parse(input); const { error } = await createBrowserSupabaseClient().rpc("update_deployment", { target_deployment_id: values.id, expected_updated_at: values.expectedUpdatedAt, ...rpcPayload(values) }); throwIfError(error);
}
