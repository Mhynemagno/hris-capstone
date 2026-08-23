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

export type ManagedUser = Profile & Pick<UserRole, "role" | "assigned_at"> & {
  pending_activation?: EmployeeActivationRequest;
};

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

export type Notification = {
  id: string;
  recipient_user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type ProfileChangeRequest = {
  id: string;
  employee_id: string;
  submitted_by_user_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note: string | null;
  decision_reason: string | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileChangeRequestChange = {
  id: string;
  request_id: string;
  ordinal: number;
  kind: "contact" | "qualification";
  field_key: string | null;
  operation: "add" | "edit" | "remove" | null;
  qualification_id: string | null;
  original_value: unknown;
  requested_value: unknown;
  created_at: string;
};

export type ProfileChangeRequestDocument = {
  id: string;
  request_id: string;
  object_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_user_id: string;
  created_at: string;
};

export type ProfileChangeRequestHistory = {
  id: number;
  request_id: string;
  actor_user_id: string | null;
  event_type: "submitted" | "cancelled" | "approved" | "rejected";
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

export type JobOpening = {
  id: number;
  department_id: number | null;
  position_id: number | null;
  title: string;
  description: string;
  location: string | null;
  closes_on: string | null;
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type JobQualificationCriterion = {
  id: string;
  job_opening_id: number;
  ordinal: number;
  kind: "education" | "experience" | "skill" | "certification" | "other";
  requirement: string;
  is_required: boolean;
  created_at: string;
};

export type Applicant = {
  id: string;
  profile_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type Application = {
  id: string;
  applicant_id: string;
  job_opening_id: number;
  status: "Submitted" | "Under Review" | "Shortlisted" | "Interview" | "Hired" | "Not Selected";
  cover_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  hired_employee_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationStatusHistory = {
  id: string;
  application_id: string;
  actor_user_id: string | null;
  previous_status: Application["status"] | null;
  next_status: Application["status"];
  note: string | null;
  created_at: string;
};
export type ApplicationAiScore = { id: string; application_id: string; status: "pending" | "completed" | "failed"; score: number | null; explanation: string | null; provider: string | null; model: string | null; model_version: string | null; completed_at: string | null; created_at: string; };
export type HrShortlistApplication = Application & { ai_score_id: string | null; ai_score_status: "pending" | "completed" | "failed" | "unscored"; ai_score: number | null; ai_explanation: string | null; ai_model: string | null; };

export type ApplicantDocument = {
  id: string;
  application_id: string;
  kind: "cv" | "credential";
  object_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_user_id: string;
  created_at: string;
};

export type EmployeeActivationRequest = {
  id: string;
  employee_id: string;
  profile_id: string;
  application_id: string;
  status: "pending" | "activated";
  requested_by_user_id: string;
  activated_by_user_id: string | null;
  activated_at: string | null;
  created_at: string;
};
