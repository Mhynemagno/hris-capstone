import type { AppRole } from "./roles";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserRole = {
  user_id: string;
  role: AppRole;
  assigned_by: string | null;
  assigned_at: string;
};

export type ManagedUser = Profile & Pick<UserRole, "role" | "assigned_at">;

export type PaginatedResult<T, TFilters> = {
  rows: T[];
  count: number;
  filters: TFilters;
};

export type Department = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Position = {
  id: number;
  department_id: number | null;
  title: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationSettings = {
  id: true;
  organization_name: string;
  support_email: string;
  default_timezone: string;
  updated_by: string | null;
  updated_at: string;
};

export type AuditLog = {
  id: number;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Employee = {
  id: string;
  profile_id: string | null;
  employee_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  personal_email: string;
  phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  department_id: number | null;
  position_id: number | null;
  employment_status: "active" | "on_leave" | "inactive" | "separated";
  employment_started_on: string;
  employment_ended_on: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceHistory = {
  id: string;
  employee_id: string;
  department_id: number | null;
  position_id: number | null;
  employment_title: string | null;
  started_on: string;
  ended_on: string | null;
  notes: string | null;
};

export type Qualification = {
  id: string;
  employee_id: string;
  name: string;
  institution: string;
  qualification_level: string | null;
  field_of_study: string | null;
  awarded_on: string;
  notes: string | null;
};

export type Certification = {
  id: string;
  employee_id: string;
  name: string;
  issuer: string;
  credential_id: string | null;
  issued_on: string;
  expires_on: string | null;
  notes: string | null;
};

export type TrainingRecord = {
  id: string;
  employee_id: string;
  course_name: string;
  provider: string;
  completed_on: string;
  expires_on: string | null;
  hours: number | null;
  notes: string | null;
};
