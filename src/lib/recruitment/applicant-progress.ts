import { formatDate } from "@/lib/format-date";
import type { Application, ApplicationStatusHistory } from "@/lib/types/database";
import type { ApplicationStatus } from "@/schemas/recruitment";

import { endedAtStage, PIPELINE_STAGES } from "./application-stages";

type PipelineStage =
  | "Application Submission"
  | "Physical Agility Test"
  | "Physical & Medical Examination"
  | "Neuro-Psychiatric Examination"
  | "Drug Test"
  | "Character & Background Investigation"
  | "Panel Interview"
  | "Final Evaluation";

/** The stage names as the Capstone UI dashboard lists them. */
export const STAGE_SHORT_LABELS: Record<PipelineStage, string> = {
  "Application Submission": "Application Submission",
  "Physical Agility Test": "Physical Agility Test",
  "Physical & Medical Examination": "Physical & Medical Exam",
  "Neuro-Psychiatric Examination": "Neuro-Psychiatric Exam",
  "Drug Test": "Drug Test",
  "Character & Background Investigation": "Background Investigation",
  "Panel Interview": "Panel Interview",
  "Final Evaluation": "Final Evaluation",
};

/** What the applicant is told at each stage. */
export const STAGE_MESSAGES: Partial<Record<ApplicationStatus, string>> = {
  "Application Submission": "Your application is now under review.",
  "Physical Agility Test": "You are now scheduled for the physical agility test.",
  "Physical & Medical Examination": "You are now scheduled for the physical and medical examination.",
  "Neuro-Psychiatric Examination": "You are now scheduled for the neuro-psychiatric examination.",
  "Drug Test": "You are now scheduled for the drug test.",
  "Character & Background Investigation": "Your character and background investigation is in progress.",
  "Panel Interview": "You are now scheduled for the panel interview.",
  "Final Evaluation": "Under Final Deliberation",
};

/** The message once the recruitment process is over. */
export const FINAL_MESSAGES: Partial<Record<ApplicationStatus, string>> = {
  Shortlisted: "You have completed the recruitment process and are shortlisted.",
  "Not Selected": "Thank you for applying. You were not selected for this opening.",
  Hired: "Congratulations! HR will contact you about the next steps.",
};

/** The clearance a stage gives before the next one is scheduled ("Scheduled upon medical clearance."). */
const CLEARANCE: Record<PipelineStage, string> = {
  "Application Submission": "document",
  "Physical Agility Test": "agility test",
  "Physical & Medical Examination": "medical",
  "Neuro-Psychiatric Examination": "neuro-psychiatric",
  "Drug Test": "drug test",
  "Character & Background Investigation": "background investigation",
  "Panel Interview": "panel interview",
  "Final Evaluation": "final evaluation",
};

const FINISHED: readonly ApplicationStatus[] = ["Shortlisted", "Hired", "Not Selected"];

/** "2 / 8": the stage reached, 0 before an application exists, 8 once the process is over. */
export function stageProgress(status: ApplicationStatus | null) {
  if (!status) return 0;
  if (FINISHED.includes(status)) return PIPELINE_STAGES.length;
  return PIPELINE_STAGES.indexOf(status) + 1;
}

const manilaTime = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

/** A stage schedule as "October 18, 2026" and "6:00 AM", in Philippine time. */
export function scheduleParts(iso: string | null | undefined) {
  if (!iso) return null;
  const date = formatDate(iso);
  if (!date) return null;
  return { date, time: manilaTime.format(new Date(iso)) };
}

export type NextActionInput = Pick<Application, "status" | "stage_result" | "stage_scheduled_at" | "stage_venue">;

/** The dashboard's "Next Action Required" card and the status page's banner. */
export function nextAction(application: NextActionInput | null): { title: string; detail: string; href: string } {
  if (!application) {
    return { title: "Upload your required documents", detail: "Upload all five documents, then press Save to submit your application.", href: "/applicant/documents" };
  }
  const { status } = application;
  const href = "/applicant/applications";
  if (FINISHED.includes(status)) return { title: status, detail: FINAL_MESSAGES[status] ?? "", href };
  if (status === "Application Submission") return { title: "Application under review", detail: STAGE_MESSAGES[status] ?? "", href };
  const schedule = application.stage_result === "scheduled" ? scheduleParts(application.stage_scheduled_at) : null;
  if (schedule) {
    const title = /Test|Exam|Interview/.test(status) ? `${status} Attendance` : status;
    const venue = application.stage_venue ? ` at ${application.stage_venue}` : "";
    return { title, detail: `Scheduled on ${schedule.date} (${schedule.time})${venue}.`, href };
  }
  return { title: status, detail: STAGE_MESSAGES[status] ?? "", href };
}

export type TimelineStep = { label: string; state: "done" | "current" | "upcoming"; detail: string };

type HistoryEntry = Pick<ApplicationStatusHistory, "previous_status" | "next_status" | "created_at">;

/**
 * The dashboard's "Latest application progress": every completed stage with the day it was completed,
 * the current stage, and the next two stages (Capstone UI notifapp.html).
 */
export function progressTimeline(status: ApplicationStatus | null, history: HistoryEntry[]): TimelineStep[] {
  const finishedAt = status === "Not Selected" ? endedAtStage(history) : null;
  const current = !status
    ? 0
    : status === "Not Selected"
      ? Math.max(0, PIPELINE_STAGES.indexOf(finishedAt ?? "Application Submission"))
      : FINISHED.includes(status)
        ? PIPELINE_STAGES.length
        : PIPELINE_STAGES.indexOf(status);

  const steps: TimelineStep[] = [];
  PIPELINE_STAGES.forEach((stage, index) => {
    if (index < current) {
      const left = history.find((entry) => entry.previous_status === stage && entry.next_status !== stage);
      steps.push({ label: stage, state: "done", detail: left ? `Completed & Verified on ${formatDate(left.created_at)}.` : "Completed." });
    } else if (index === current) {
      const detail = !status
        ? "Upload your required documents to start."
        : status === "Not Selected"
          ? FINAL_MESSAGES["Not Selected"]!
          : (STAGE_MESSAGES[stage] ?? "");
      steps.push({ label: stage, state: "current", detail });
    } else if (index === current + 1 && status !== "Not Selected") {
      steps.push({ label: stage, state: "upcoming", detail: `Pending ${PIPELINE_STAGES[current]!.toLowerCase()} evaluation.` });
    } else if (index === current + 2 && status !== "Not Selected") {
      steps.push({ label: stage, state: "upcoming", detail: `Scheduled upon ${CLEARANCE[PIPELINE_STAGES[index - 1] as PipelineStage]} clearance.` });
    }
  });
  if (status && FINISHED.includes(status) && status !== "Not Selected") {
    steps.push({ label: status === "Hired" ? "Approved — Hired" : "Shortlisted", state: "done", detail: FINAL_MESSAGES[status] ?? "" });
  }
  return steps;
}
