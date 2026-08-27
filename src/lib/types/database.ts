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
  employee_id?: string;
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
  rank: string | null;
  unit_station: string | null;
  profile_image_path: string | null;
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

export type UnlinkedEmployeeAccount = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
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
export type ApplicationAiScore = { id: string; application_id: string; status: "queued" | "processing" | "completed" | "failed"; score: number | null; explanation: string | null; provider: string | null; model: string | null; model_version: string | null; completed_at: string | null; created_at: string; };
export type HrShortlistApplication = Application & { ai_score_id: string | null; ai_score_status: "queued" | "processing" | "completed" | "failed" | "unscored"; ai_score: number | null; ai_explanation: string | null; ai_model: string | null; };

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

export type LeaveType = {
  id: string;
  name: string;
  description: string | null;
  requires_attachment: boolean;
  is_active: boolean;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveRequest = {
  id: string;
  employee_id: string;
  submitted_by_user_id: string;
  leave_type_id: string;
  leave_type_name: string;
  starts_on: string;
  ends_on: string;
  reason: string;
  status: LeaveRequestStatus;
  decision_note: string | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeaveRequestAttachment = {
  id: string;
  request_id: string;
  object_path: string;
  file_name: string;
  mime_type: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
  size_bytes: number;
  uploaded_by_user_id: string;
  created_at: string;
};

export type LeaveRequestHistory = {
  id: number;
  request_id: string;
  actor_user_id: string | null;
  event_type: LeaveRequestStatus;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DeploymentStatus = "planned" | "active" | "completed" | "cancelled";

export type Deployment = {
  id: string;
  employee_id: string;
  location: string | null;
  unit: string | null;
  project: string | null;
  assignment_role: string;
  starts_on: string;
  ends_on: string | null;
  status: DeploymentStatus;
  notes: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type DeploymentHistory = {
  id: number;
  deployment_id: string;
  actor_user_id: string | null;
  event_type: "created" | "updated" | "status_changed";
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PromotionCriterion = {
  id: string;
  target_position_id: number;
  minimum_years_of_service: number;
  minimum_performance_rating: number | null;
  is_active: boolean;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type PromotionCriterionRequirement = {
  id: string;
  criterion_id: string;
  ordinal: number;
  record_kind: "qualification" | "certification" | "training";
  required_name: string;
  label: string;
  is_mandatory: boolean;
  created_at: string;
};

export type PerformanceRating = {
  id: string;
  employee_id: string;
  rating: number;
  review_period_starts_on: string;
  review_period_ends_on: string;
  notes: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type PromotionEvaluation = {
  id: string;
  employee_id: string;
  target_position_id: number;
  criterion_id: string;
  evaluated_on: string;
  criteria_snapshot: Record<string, unknown>;
  years_of_service: number;
  is_ready: boolean;
  missing_requirements: string[];
  recommendation: "recommended" | "not_recommended" | "deferred";
  notes: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type PromotionEvaluationEvidence = {
  id: string;
  evaluation_id: string;
  requirement_id: string;
  qualification_id: string | null;
  certification_id: string | null;
  training_record_id: string | null;
  created_at: string;
};

export type EmployeePromotionEligibilitySummary = {
  employee_id: string;
  evaluation_id: string;
  target_position_id: number;
  target_position_title: string;
  calculated_at: string;
  years_of_service: number;
  is_ready: boolean;
  missing_requirements: string[];
};

export type AttendanceStatus = "present" | "late" | "absent" | "incomplete";

export type AttendanceIntegrationSettings = {
  id: string;
  adapter_key: "csv_xlsx";
  timezone: "Asia/Ulaanbaatar";
  workday_start: string;
  late_grace_minutes: number;
  template_version: string;
  is_enabled: boolean;
  updated_by_user_id: string | null;
  updated_at: string;
};

export type AttendanceIdentityMapping = {
  id: string;
  employee_id: string;
  external_employee_id: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type AttendanceImport = {
  id: string;
  source_filename: string;
  mime_type: "text/csv" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  checksum_sha256: string;
  adapter_key: "csv_xlsx";
  status: "processing" | "completed" | "completed_with_issues" | "failed";
  accepted_count: number;
  duplicate_count: number;
  unmatched_count: number;
  invalid_count: number;
  error_summary: string | null;
  imported_by_user_id: string;
  created_at: string;
  completed_at: string | null;
};

export type AttendanceLog = {
  id: string;
  employee_id: string;
  integration_id: string;
  source_event_id: string;
  external_employee_id: string;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  status: AttendanceStatus;
  import_id: string;
  sync_metadata: Record<string, unknown>;
  created_at: string;
};

export type AttendanceUnmatchedEvent = {
  id: string;
  integration_id: string;
  source_event_id: string;
  external_employee_id: string;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  event_type: "attendance" | "absence";
  import_id: string;
  sync_metadata: Record<string, unknown>;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  resolved_log_id: string | null;
  created_at: string;
};
