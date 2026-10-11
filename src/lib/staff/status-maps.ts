import type { AttendanceStatus, DeploymentStatus, LeaveRequestStatus, PromotionEvaluation } from "@/lib/types/database";
import type { ApplicationStatus } from "@/schemas/recruitment";

export type PillTone = "amber" | "emerald" | "rose" | "blue" | "slate";
type Pill = { label: string; tone: PillTone };

export const LEAVE_STATUS: Record<LeaveRequestStatus, Pill> = {
  pending: { label: "For Approval", tone: "amber" },
  approved: { label: "Approved", tone: "emerald" },
  rejected: { label: "Rejected", tone: "rose" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

export const DEPLOYMENT_STATUS: Record<DeploymentStatus, Pill> = {
  scheduled: { label: "Scheduled", tone: "slate" },
  ongoing: { label: "Ongoing", tone: "blue" },
  completed: { label: "Completed", tone: "emerald" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

export const ATTENDANCE_STATUS: Record<AttendanceStatus, Pill> = {
  present: { label: "Present", tone: "emerald" },
  late: { label: "Late", tone: "rose" },
  incomplete: { label: "Partial", tone: "amber" },
  absent: { label: "Absent", tone: "slate" },
};

export const RECOMMENDATION_STATUS: Record<PromotionEvaluation["recommendation"], Pill> = {
  recommended: { label: "Recommended", tone: "blue" },
  not_recommended: { label: "Not Recommended", tone: "rose" },
  deferred: { label: "Deferred", tone: "slate" },
};

/** Applicant Roster status pill (roster.html, PDF p. 22): "Pending" before anything is submitted. */
export function applicationStatusPill(status: ApplicationStatus | "Pending"): Pill {
  if (status === "Pending") return { label: "Pending", tone: "amber" };
  if (status === "Application Submission") return { label: "Pending / For Evaluation", tone: "amber" };
  if (status === "Hired") return { label: "Hired", tone: "emerald" };
  if (status === "Not Selected") return { label: "Not Selected", tone: "rose" };
  return { label: status, tone: "blue" };
}

export function aiMatchLabel(score: number | null) {
  if (score === null) return null;
  if (score >= 5) return "Excellent Match";
  if (score >= 4) return "Good Match";
  if (score >= 3) return "Fair Match";
  return "Low Match";
}
