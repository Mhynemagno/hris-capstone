import type { ApplicationStatus } from "@/schemas/recruitment";

import { PIPELINE_STAGES } from "./application-stages";

/** Where the applicant stands within the current stage (applications.stage_result). */
export type StageResult = "pending" | "verified" | "scheduled";
/** What HR can record for the current stage (public.record_stage_result). */
export type RecordableResult = "verified" | "scheduled" | "passed" | "failed";

export const RESULT_LABELS: Record<RecordableResult, string> = { verified: "Verified", scheduled: "Scheduled", passed: "Passed", failed: "Failed" };

type BadgeVariant = "neutral" | "info" | "warning" | "success" | "danger";

/** The client's Status words: Pending / For Evaluation, Verified, Scheduled, Disqualified, Candidate (and Hired). */
export function applicationStatusLabel(status: ApplicationStatus, stageResult: StageResult | null | undefined): { label: string; variant: BadgeVariant } {
  if (status === "Hired") return { label: "Hired", variant: "success" };
  if (status === "Shortlisted") return { label: "Candidate", variant: "success" };
  if (status === "Not Selected") return { label: "Disqualified", variant: "danger" };
  if (stageResult === "verified") return { label: "Verified", variant: "info" };
  if (stageResult === "scheduled") return { label: "Scheduled", variant: "warning" };
  return { label: "Pending / For Evaluation", variant: "neutral" };
}

export function stageResultActions(status: ApplicationStatus, stageResult: StageResult | null | undefined): RecordableResult[] {
  if (!PIPELINE_STAGES.includes(status)) return [];
  if (status === "Application Submission") return stageResult === "verified" ? ["passed", "failed"] : ["verified", "passed", "failed"];
  return stageResult === "scheduled" ? ["passed", "failed"] : ["scheduled", "passed", "failed"];
}

/** Passing or failing a stage after Application Submission needs proof the stage was carried out. */
export function needsStageDocument(status: ApplicationStatus, result: RecordableResult) {
  return (result === "passed" || result === "failed") && status !== "Application Submission";
}

export function stageResultHistoryLabel(entry: { previous_status: ApplicationStatus | null; next_status: ApplicationStatus; result?: RecordableResult | null }) {
  if (!entry.result) return null;
  if (entry.result === "verified") return "Documents verified";
  return `${RESULT_LABELS[entry.result]}: ${entry.previous_status ?? entry.next_status}`;
}
