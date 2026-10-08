import type { ApplicationStatusHistory } from "@/lib/types/database";
import type { ApplicationStatus } from "@/schemas/recruitment";

/** The ordered eight-stage recruitment process provided in Doc2 (6). */
export const PIPELINE_STAGES: readonly ApplicationStatus[] = [
  "Application Submission",
  "Physical Agility Test",
  "Physical & Medical Examination",
  "Neuro-Psychiatric Examination",
  "Drug Test",
  "Character & Background Investigation",
  "Panel Interview",
  "Final Evaluation",
];

/** Stages HR progresses before the final selection decision. */
export const ACTIVE_STAGES: readonly ApplicationStatus[] = PIPELINE_STAGES;

/**
 * Each PDF stage advances to the next one. Final Evaluation is the only point where
 * the candidate can be shortlisted or not selected.
 */
export const allowedNextStatuses: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  "Application Submission": ["Physical Agility Test"],
  "Physical Agility Test": ["Physical & Medical Examination"],
  "Physical & Medical Examination": ["Neuro-Psychiatric Examination"],
  "Neuro-Psychiatric Examination": ["Drug Test"],
  "Drug Test": ["Character & Background Investigation"],
  "Character & Background Investigation": ["Panel Interview"],
  "Panel Interview": ["Final Evaluation"],
  "Final Evaluation": ["Shortlisted", "Not Selected"],
  Shortlisted: [],
  Hired: [],
  "Not Selected": [],
};

export type StageAction =
  | { kind: "advance"; next: ApplicationStatus[]; canReject: boolean }
  | { kind: "hire"; canReject: boolean }
  | { kind: "closed" };

export function stageActions(status: ApplicationStatus, _hasBmiProof?: boolean): StageAction {
  if (status === "Hired" || status === "Not Selected") return { kind: "closed" };
  if (status === "Shortlisted") return { kind: "hire", canReject: false };
  const allowed = allowedNextStatuses[status];
  const canReject = allowed.includes("Not Selected");
  return { kind: "advance", next: allowed.filter((next) => next !== "Not Selected"), canReject };
}

export function stageBadgeVariant(status: ApplicationStatus) {
  if (status === "Application Submission") return "info" as const;
  if (status === "Shortlisted" || status === "Hired") return "success" as const;
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
  if (status === "Shortlisted") return { reached: PIPELINE_STAGES.length - 1, outcome: "shortlisted" as const };
  if (status === "Not Selected") return { reached: endedAt ? index(endedAt) : 0, outcome: "not-selected" as const };
  return { reached: index(status), outcome: "open" as const };
}
