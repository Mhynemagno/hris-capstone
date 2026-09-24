import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { presentAuditLog, type AuditLogDisplay, type AuditPresentationLookups } from "@/lib/administration/audit-presentation";
import type {
  AuditLog,
  Department,
  EmployeeActivationRequest,
  ManagedUser,
  OrganizationSettings,
  PaginatedResult,
  Rank,
  Profile,
  UserRole,
} from "@/lib/types/database";
import {
  auditLogFiltersSchema,
  departmentSchema,
  internalInvitationSchema,
  managedUserFiltersSchema,
  managedUserDeleteSchema,
  managedUserUpdateSchema,
  organizationSettingsSchema,
  rankSchema,
  referenceDataFiltersSchema,
  type AuditLogFilters,
  type DepartmentInput,
  type InternalInvitationInput,
  type ManagedUserFilters,
  type ManagedUserDeleteInput,
  type ManagedUserUpdateInput,
  type OrganizationSettingsInput,
  type RankInput,
  type ReferenceDataFilters,
} from "@/schemas/administration";

type SupabaseError = { message: string } | null;
type FunctionErrorContext = { json?: () => Promise<unknown> };

type ManagedUserRoleRow = Pick<UserRole, "user_id" | "role" | "assigned_at">;
type AuditProfileRow = Pick<Profile, "id" | "full_name" | "email">;
type ManagedUserProfileRow = Profile & { employees?: Array<{ id: string }> | null };

function throwIfError(error: SupabaseError) {
  if (error) throw new Error(error.message);
}

async function invitationErrorMessage(error: unknown) {
  const context = typeof error === "object" && error !== null && "context" in error
    ? (error as { context?: FunctionErrorContext }).context
    : undefined;
  const payload = await context?.json?.().catch(() => undefined);
  if (
    typeof payload === "object"
    && payload !== null
    && "error" in payload
    && typeof payload.error === "string"
  ) return payload.error;
  return error instanceof Error
    ? error.message
    : "The invitation service could not be reached. Please try again.";
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
    .select("id, email, full_name, is_active, created_at, updated_at, employees(id)", { count: "exact" })
    .order("full_name")
    .order("email");

  if (filters.search) query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  if (filters.status) query = query.eq("is_active", filters.status === "active");

  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  const profiles = (data ?? []) as ManagedUserProfileRow[];
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
  const applicantIds = roles.filter((role) => role.role === "applicant").map((role) => role.user_id);
  let pendingActivations: EmployeeActivationRequest[] = [];
  if (applicantIds.length) {
    const { data: activationData, error: activationError } = await client
      .from("employee_activation_requests")
      .select("*")
      .eq("status", "pending")
      .in("profile_id", applicantIds);
    throwIfError(activationError);
    pendingActivations = (activationData ?? []) as EmployeeActivationRequest[];
  }
  const activationByProfileId = new Map(pendingActivations.map((activation) => [activation.profile_id, activation]));
  const rows = profiles.flatMap((profile) => {
    const role = roleByUserId.get(profile.id);
    const pendingActivation = activationByProfileId.get(profile.id);
    const { employees, ...managedProfile } = profile;
    const employeeId = employees?.[0]?.id;
    return role ? [{ ...managedProfile, role: role.role, assigned_at: role.assigned_at, ...(employeeId ? { employee_id: employeeId } : {}), ...(pendingActivation ? { pending_activation: pendingActivation } : {}) }] : [];
  });
  return { rows, count: count ?? 0, filters };
}

export async function inviteInternalUser(input: InternalInvitationInput) {
  const values = internalInvitationSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().functions.invoke("invite-internal-user", {
    body: {
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName,
      role: values.role,
    },
  });
  if (error) throw new Error(await invitationErrorMessage(error));
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

export async function deleteManagedUser(input: ManagedUserDeleteInput) {
  const values = managedUserDeleteSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().functions.invoke("delete-managed-user", {
    method: "DELETE",
    body: { userId: values.userId },
  });
  if (error) throw new Error(await invitationErrorMessage(error));
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

/**
 * Complete department catalogue for dropdowns (active and inactive, so an edit
 * form can still display a record's current, now-inactive department).
 */
export async function listDepartmentOptions() {
  const { data, error } = await createBrowserSupabaseClient().from("departments").select("*").order("name").limit(1000);
  throwIfError(error);
  return (data ?? []) as Department[];
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

export async function listRanks(input: Partial<ReferenceDataFilters> = {}): Promise<PaginatedResult<Rank, ReferenceDataFilters>> {
  const filters = referenceDataFilters(input);
  const { from, to } = pageRange(filters.page);
  let query = createBrowserSupabaseClient().from("ranks").select("*", { count: "exact" }).order("sort_order");
  if (filters.search) query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
  if (filters.status) query = query.eq("is_active", filters.status === "active");
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  return { rows: (data ?? []) as Rank[], count: count ?? 0, filters };
}

/** Complete rank catalogue for dropdowns, junior to senior (every rank applies to every department). */
export async function listRankOptions() {
  const { data, error } = await createBrowserSupabaseClient().from("ranks").select("*").order("sort_order").limit(1000);
  throwIfError(error);
  return (data ?? []) as Rank[];
}

export async function saveRank(input: RankInput, rankId?: number) {
  const values = rankSchema.parse(input);
  const payload = {
    name: values.name,
    code: values.code,
    sort_order: values.sortOrder,
    is_active: values.isActive,
  };
  const client = createBrowserSupabaseClient();
  const result = rankId
    ? await client.from("ranks").update(payload).eq("id", rankId).select("*").single()
    : await client.from("ranks").insert(payload).select("*").single();
  throwIfError(result.error);
  return result.data as Rank;
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

export async function listAuditLogs(input: Partial<AuditLogFilters> = {}): Promise<PaginatedResult<AuditLogDisplay, AuditLogFilters>> {
  const filters = auditLogFilters(input);
  const { from, to } = pageRange(filters.page);
  const client = createBrowserSupabaseClient();
  let query = client.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.search) query = query.or(`entity_type.ilike.%${filters.search}%,entity_id.ilike.%${filters.search}%,action.ilike.%${filters.search}%`);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.action) query = query.eq("action", filters.action);
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  const rows = (data ?? []) as AuditLog[];
  const profileIds = [...new Set(rows.flatMap((row) => {
    const metadataUserId = typeof row.metadata.user_id === "string" ? row.metadata.user_id : null;
    const targetId = row.entity_type === "profiles" || row.entity_type === "user_roles" ? row.entity_id : null;
    return [row.actor_user_id, metadataUserId, targetId].filter((id): id is string => Boolean(id));
  }))];
  const departmentIds = [...new Set(rows
    .filter((row) => row.entity_type === "departments" && typeof row.metadata.name !== "string")
    .map((row) => row.entity_id))];
  const rankIds = [...new Set(rows
    .filter((row) => row.entity_type === "ranks" && typeof row.metadata.name !== "string")
    .map((row) => row.entity_id))];

  const lookups: AuditPresentationLookups = { profiles: {}, departments: {}, ranks: {} };
  if (profileIds.length) {
    const { data: profileRows, error: profileError } = await client
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds);
    throwIfError(profileError);
    for (const profile of (profileRows ?? []) as AuditProfileRow[]) {
      const label = profile.full_name?.trim() || profile.email?.trim();
      if (label) lookups.profiles[profile.id] = label;
    }
  }
  if (departmentIds.length) {
    const { data: departmentRows, error: departmentError } = await client
      .from("departments")
      .select("id, name")
      .in("id", departmentIds);
    throwIfError(departmentError);
    for (const department of (departmentRows ?? []) as Array<Pick<Department, "id" | "name">>) {
      lookups.departments[String(department.id)] = department.name;
    }
  }
  if (rankIds.length) {
    const { data: rankRows, error: rankError } = await client
      .from("ranks")
      .select("id, name")
      .in("id", rankIds);
    throwIfError(rankError);
    for (const rank of (rankRows ?? []) as Array<Pick<Rank, "id" | "name">>) {
      lookups.ranks[String(rank.id)] = rank.name;
    }
  }

  return { rows: rows.map((row) => presentAuditLog(row, lookups)), count: count ?? 0, filters };
}
