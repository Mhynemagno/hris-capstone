import type { Certification, Employee, Qualification, ServiceHistory, TrainingRecord } from "@/lib/types/database";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  certificationSchema,
  employeeDirectoryFiltersSchema,
  employeeSchema,
  qualificationSchema,
  serviceHistorySchema,
  trainingRecordSchema,
  type CertificationInput,
  type EmployeeDirectoryFilters,
  type EmployeeInput,
  type QualificationInput,
  type ServiceHistoryInput,
  type TrainingRecordInput,
} from "@/schemas/personnel-records";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listEmployees(input: Partial<EmployeeDirectoryFilters> = {}) {
  const filters = employeeDirectoryFiltersSchema.parse(input);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let query = createBrowserSupabaseClient()
    .from("employees")
    .select("*", { count: "exact" })
    .order("last_name")
    .order("first_name")
    .order("employee_number")
    .range(from, to);
  if (filters.search) query = query.or(`employee_number.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.positionId) query = query.eq("position_id", filters.positionId);
  if (filters.employmentStatus) query = query.eq("employment_status", filters.employmentStatus);
  const { data, error, count } = await query;
  throwIfError(error);
  return { rows: (data ?? []) as Employee[], count: count ?? 0, filters };
}

export async function getEmployee(employeeId: string) {
  const { data, error } = await createBrowserSupabaseClient().from("employees").select("*").eq("id", employeeId).maybeSingle();
  throwIfError(error);
  return data as Employee | null;
}

export async function getEmployeeForCurrentUser() {
  const { data, error } = await createBrowserSupabaseClient().from("employees").select("*").maybeSingle();
  throwIfError(error);
  return data as Employee | null;
}

function employeePayload(input: EmployeeInput) {
  return {
    profile_id: input.profileId ?? null, employee_number: input.employeeNumber, first_name: input.firstName,
    middle_name: input.middleName ?? null, last_name: input.lastName, personal_email: input.personalEmail,
    phone: input.phone ?? null, address: input.address ?? null, emergency_contact_name: input.emergencyContactName ?? null,
    emergency_contact_phone: input.emergencyContactPhone ?? null, department_id: input.departmentId ?? null,
    position_id: input.positionId ?? null, employment_status: input.employmentStatus,
    employment_started_on: input.employmentStartedOn, employment_ended_on: input.employmentEndedOn ?? null,
  };
}

export async function saveEmployee(input: EmployeeInput, employeeId?: string) {
  const values = employeePayload(employeeSchema.parse(input));
  const client = createBrowserSupabaseClient();
  const result = employeeId
    ? await client.from("employees").update(values).eq("id", employeeId).select("*").single()
    : await client.from("employees").insert(values).select("*").single();
  throwIfError(result.error);
  return result.data as Employee;
}

type PersonnelEntry = ServiceHistory | Qualification | Certification | TrainingRecord;
type PersonnelKind = "serviceHistory" | "qualification" | "certification" | "training";

const childConfig = {
  serviceHistory: { table: "service_history", schema: serviceHistorySchema, payload: (v: ServiceHistoryInput) => ({ employee_id: v.employeeId, department_id: v.departmentId ?? null, position_id: v.positionId ?? null, employment_title: v.employmentTitle ?? null, started_on: v.startedOn, ended_on: v.endedOn ?? null, notes: v.notes ?? null }) },
  qualification: { table: "qualifications", schema: qualificationSchema, payload: (v: QualificationInput) => ({ employee_id: v.employeeId, name: v.name, institution: v.institution, qualification_level: v.qualificationLevel ?? null, field_of_study: v.fieldOfStudy ?? null, awarded_on: v.awardedOn, notes: v.notes ?? null }) },
  certification: { table: "certifications", schema: certificationSchema, payload: (v: CertificationInput) => ({ employee_id: v.employeeId, name: v.name, issuer: v.issuer, credential_id: v.credentialId ?? null, issued_on: v.issuedOn, expires_on: v.expiresOn ?? null, notes: v.notes ?? null }) },
  training: { table: "training_records", schema: trainingRecordSchema, payload: (v: TrainingRecordInput) => ({ employee_id: v.employeeId, course_name: v.courseName, provider: v.provider, completed_on: v.completedOn, expires_on: v.expiresOn ?? null, hours: v.hours ?? null, notes: v.notes ?? null }) },
} as const;

type ChildConfig = {
  table: string;
  schema: { parse: (input: unknown) => unknown };
  payload: (input: never) => Record<string, unknown>;
};

export async function listPersonnelEntries(kind: PersonnelKind, employeeId: string) {
  const { data, error } = await createBrowserSupabaseClient().from(childConfig[kind].table).select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as PersonnelEntry[];
}

export async function savePersonnelEntry(kind: PersonnelKind, input: ServiceHistoryInput | QualificationInput | CertificationInput | TrainingRecordInput, id?: string) {
  const config = childConfig[kind] as unknown as ChildConfig;
  const values = config.payload(config.schema.parse(input) as never);
  const client = createBrowserSupabaseClient();
  const result = id ? await client.from(config.table).update(values).eq("id", id).select("*").single() : await client.from(config.table).insert(values).select("*").single();
  throwIfError(result.error);
  return result.data as PersonnelEntry;
}

export async function deletePersonnelEntry(kind: PersonnelKind, id: string) {
  const { error } = await createBrowserSupabaseClient().from(childConfig[kind].table).delete().eq("id", id);
  throwIfError(error);
}

export type { PersonnelKind };
