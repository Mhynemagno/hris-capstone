import type { ApplicationStatus } from "@/schemas/recruitment";

/** Forward stages in workflow order (supabase/migrations/20261006091000_applicant_post_interview_flow.sql). */
export const PIPELINE_STAGES: readonly ApplicationStatus[] = [
  "Submitted", "Under Review", "Shortlisted", "Interview", "Endorsed to Crame", "Neuro Exam", "For Training", "Hired",
];

/** Stages HR still has to act on, or that wait on the applicant. */
export const ACTIVE_STAGES: readonly ApplicationStatus[] = [
  "Submitted", "Under Review", "Shortlisted", "Interview", "Needs Revision", "Endorsed to Crame", "Neuro Exam", "For Training",
];
