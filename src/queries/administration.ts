import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  AuditLog,
  Department,
  ManagedUser,
  OrganizationSettings,
  PaginatedResult,
  Position,
  Profile,
  UserRole,
} from "@/lib/types/database";
import {
  auditLogFiltersSchema,
  departmentSchema,
  internalInvitationSchema,
  managedUserFiltersSchema,
  managedUserUpdateSchema,
  organizationSettingsSchema,
  positionSchema,
  referenceDataFiltersSchema,
  type AuditLogFilters,
  type DepartmentInput,
  type InternalInvitationInput,
  type ManagedUserFilters,
  type ManagedUserUpdateInput,
  type OrganizationSettingsInput,
  type PositionInput,
  type ReferenceDataFilters,
} from "@/schemas/administration";

type SupabaseError = { message: string } | null;

type ManagedUserRoleRow = Pick<UserRole, "user_id" | "role" | "assigned_at">;

function throwIfError(error: SupabaseError) {
  if (error) throw new Error(error.message);
}

function pageRange(page: number) {
  const from = (page - 1) * 20;
  return { from, to: from + 19 };
}

function managedUserFilters(input: Partial<ManagedUserFilters> = {}) {
  return managedUserFiltersSchema.parse({ page: 1, pageSize: 20, ...input });
}

function referenceDataFilters(input: Partial<ReferenceDataFilters> = {}) {
  return referenceDataFiltersSchema.parse({ page: 1, pageSize: 20, ...input });
}

function auditLogFilters(input: Partial<AuditLogFilters> = {}) {
  return auditLogFiltersSchema.parse({ page: 1, pageSize: 20, ...input });
}

export async function listManagedUsers(input: Partial<ManagedUserFilters> = {}): Promise<PaginatedResult<ManagedUser, ManagedUserFilters>> {
  const filters = managedUserFilters(input);
  const { from, to } = pageRange(filters.page);
  const client = createBrowserSupabaseClient();
  let query = client
    .from("profiles")
    .select("id, email, full_name, is_active, created_at, updated_at", { count: "exact" })
    .order("full_name")
    .order("email");

  if (filters.search) query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  if (filters.status) query = query.eq("is_active", filters.status === "active");

  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  const profiles = (data ?? []) as Profile[];
  const profileIds = profiles.map((profile) => profile.id);
  let roles: ManagedUserRoleRow[] = [];
  if (profileIds.length) {
    let roleQuery = client.from("user_roles").select("user_id, role, assigned_at");
    if (filters.role) roleQuery = roleQuery.eq("role", filters.role);
    const { data: roleData, error: roleError } = await roleQuery.in("user_id", profileIds);
    throwIfError(roleError);
    roles = (roleData ?? []) as ManagedUserRoleRow[];
  }
  const roleByUserId = new Map(roles.map((role) => [role.user_id, role]));
  const rows = profiles.flatMap((profile) => {
    const role = roleByUserId.get(profile.id);
    return role ? [{ ...profile, role: role.role, assigned_at: role.assigned_at }] : [];
  });
  return { rows, count: count ?? 0, filters };
}

export async function inviteInternalUser(input: InternalInvitationInput) {
  const body = internalInvitationSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().functions.invoke("invite-internal-user", { body });
  throwIfError(error);
  return data as { userId: string };
}

export async function updateManagedUser(input: ManagedUserUpdateInput) {
  const values = managedUserUpdateSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().rpc("update_managed_user", {
    target_user_id: values.userId,
    next_role: values.role,
    next_is_active: values.isActive,
  });
  throwIfError(error);
}

export async function listDepartments(input: Partial<ReferenceDataFilters> = {}): Promise<PaginatedResult<Department, ReferenceDataFilters>> {
  const filters = referenceDataFilters(input);
  const { from, to } = pageRange(filters.page);
  let query = createBrowserSupabaseClient().from("departments").select("*", { count: "exact" }).order("name");
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.status) query = query.eq("is_active", filters.status === "active");
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  return { rows: (data ?? []) as Department[], count: count ?? 0, filters };
}

export async function saveDepartment(input: DepartmentInput, departmentId?: number) {
  const values = departmentSchema.parse(input);
  const payload = { name: values.name, is_active: values.isActive };
  const client = createBrowserSupabaseClient();
  const result = departmentId
    ? await client.from("departments").update(payload).eq("id", departmentId).select("*").single()
    : await client.from("departments").insert(payload).select("*").single();
  throwIfError(result.error);
  return result.data as Department;
}

export async function listPositions(input: Partial<ReferenceDataFilters> = {}): Promise<PaginatedResult<Position, ReferenceDataFilters>> {
  const filters = referenceDataFilters(input);
  const { from, to } = pageRange(filters.page);
  let query = createBrowserSupabaseClient().from("positions").select("*", { count: "exact" }).order("title");
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
  if (filters.status) query = query.eq("is_active", filters.status === "active");
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  return { rows: (data ?? []) as Position[], count: count ?? 0, filters };
}

export async function savePosition(input: PositionInput, positionId?: number) {
  const values = positionSchema.parse(input);
  const payload = {
    department_id: values.departmentId,
    title: values.title,
    code: values.code ?? null,
    description: values.description ?? null,
    is_active: values.isActive,
  };
  const client = createBrowserSupabaseClient();
  const result = positionId
    ? await client.from("positions").update(payload).eq("id", positionId).select("*").single()
    : await client.from("positions").insert(payload).select("*").single();
  throwIfError(result.error);
  return result.data as Position;
}

export async function getOrganizationSettings() {
  const { data, error } = await createBrowserSupabaseClient().from("organization_settings").select("*").maybeSingle();
  throwIfError(error);
  return data as OrganizationSettings | null;
}

export async function saveOrganizationSettings(input: OrganizationSettingsInput) {
  const values = organizationSettingsSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient()
    .from("organization_settings")
    .upsert({ id: true, organization_name: values.organizationName, support_email: values.supportEmail, default_timezone: values.defaultTimezone })
    .select("*")
    .single();
  throwIfError(error);
  return data as OrganizationSettings;
}

export async function listAuditLogs(input: Partial<AuditLogFilters> = {}): Promise<PaginatedResult<AuditLog, AuditLogFilters>> {
  const filters = auditLogFilters(input);
  const { from, to } = pageRange(filters.page);
  let query = createBrowserSupabaseClient().from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.search) query = query.or(`entity_type.ilike.%${filters.search}%,entity_id.ilike.%${filters.search}%,action.ilike.%${filters.search}%`);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.action) query = query.eq("action", filters.action);
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  return { rows: (data ?? []) as AuditLog[], count: count ?? 0, filters };
}
