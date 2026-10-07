import type { ApplicationStatusHistory } from "@/lib/types/database";
import type { ApplicationStatus } from "@/schemas/recruitment";

/** Forward stages in workflow order (supabase/migrations/20261006091000_applicant_post_interview_flow.sql). */
export const PIPELINE_STAGES: readonly ApplicationStatus[] = [
  "Submitted", "Under Review", "Shortlisted", "Interview", "Endorsed to Crame", "Neuro Exam", "For Training", "Hired",
];

/** Stages HR still has to act on, or that wait on the applicant. */
export const ACTIVE_STAGES: readonly ApplicationStatus[] = [
  "Submitted", "Under Review", "Shortlisted", "Interview", "Needs Revision", "Endorsed to Crame", "Neuro Exam", "For Training",
];

/**
 * Review transitions HR can choose. private.transition_application_status also accepts
 * Needs Revision, but HR no longer offers it (tester feedback). Hiring is its own flow
 * once the applicant is For Training; Needs Revision, Hired and Not Selected have none.
 */
export const allowedNextStatuses: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  Submitted: ["Under Review"],
  "Under Review": ["Shortlisted", "Interview", "Not Selected"],
  Shortlisted: ["Interview", "Not Selected"],
  Interview: ["Endorsed to Crame", "Shortlisted", "Not Selected"],
  "Endorsed to Crame": ["Neuro Exam", "Not Selected"],
  "Neuro Exam": ["For Training", "Not Selected"],
  "For Training": ["Not Selected"],
  "Needs Revision": [],
  Hired: [],
  "Not Selected": [],
};

export type StageAction =
  | { kind: "advance"; next: ApplicationStatus[]; canReject: boolean }
  | { kind: "waiting-bmi"; canReject: boolean }
  | { kind: "hire"; canReject: boolean }
  | { kind: "waiting-resubmit" }
  | { kind: "closed" };

export function stageActions(status: ApplicationStatus, hasBmiProof: boolean): StageAction {
  if (status === "Hired" || status === "Not Selected") return { kind: "closed" };
  if (status === "Needs Revision") return { kind: "waiting-resubmit" };
  const allowed = allowedNextStatuses[status];
  const canReject = allowed.includes("Not Selected");
  if (status === "For Training") return { kind: "hire", canReject };
  if (status === "Endorsed to Crame" && !hasBmiProof) return { kind: "waiting-bmi", canReject };
  return { kind: "advance", next: allowed.filter((next) => next !== "Not Selected"), canReject };
}

export function stageBadgeVariant(status: ApplicationStatus) {
  if (status === "Submitted") return "info" as const;
  if (status === "Needs Revision") return "warning" as const;
  if (status === "Hired") return "success" as const;
  if (status === "Not Selected") return "danger" as const;
  return "neutral" as const;
}

/** The stage a Not Selected application had reached: the status it left when it was rejected. */
export function endedAtStage(history: Pick<ApplicationStatusHistory, "previous_status" | "next_status">[]) {
  const rejection = history.findLast((entry) => entry.next_status === "Not Selected" && entry.previous_status !== "Not Selected");
  return rejection?.previous_status ?? null;
}

export function trackerPosition(status: ApplicationStatus, endedAt?: ApplicationStatus | null) {
  const index = (value: ApplicationStatus) => Math.max(0, PIPELINE_STAGES.indexOf(value));
  if (status === "Hired") return { reached: PIPELINE_STAGES.length - 1, outcome: "hired" as const };
  if (status === "Not Selected") return { reached: endedAt ? index(endedAt === "Needs Revision" ? "Under Review" : endedAt) : 0, outcome: "not-selected" as const };
  if (status === "Needs Revision") return { reached: index("Under Review"), outcome: "needs-revision" as const };
  return { reached: index(status), outcome: "open" as const };
}
