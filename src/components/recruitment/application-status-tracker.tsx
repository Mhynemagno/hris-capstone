import { CircleCheck, CircleX, Clock } from "lucide-react";

import type { ApplicantDocument, ApplicationStatusHistory } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/schemas/recruitment";

/** How each application document kind is named on screen. */
export const documentKindLabels: Record<ApplicantDocument["kind"], string> = { cv: "CV", credential: "Credential", bmi_proof: "BMI proof" };

/** A history row that keeps the status is a progress remark (add_application_remark, submit_bmi_proof). */
export function historyEntryLabel(entry: Pick<ApplicationStatusHistory, "previous_status" | "next_status">) {
  return entry.previous_status === entry.next_status ? "Remark" : entry.next_status;
}

export type TrackerStepState = "done" | "waiting" | "rejected";
export type TrackerStep = { label: string; state: TrackerStepState; detail?: string };

const reviewDetails: Partial<Record<ApplicationStatus, string>> = {
  "Under Review": "HR is reviewing your application.",
  Shortlisted: "You have been shortlisted.",
  "Needs Revision": "HR asked you to revise your documents. Open the application to resubmit.",
};

/**
 * The whole recruitment cycle as the applicant sees it (client consultation, 2026-10-06):
 * submitted, reviewed, interviewed in San Juan, endorsed to Crame for the BMI, the neuro exam,
 * training, then hired. Shortlisted and Needs Revision are part of the review stage.
 */
const STAGES: Array<{ label: string; statuses: readonly ApplicationStatus[]; waiting: string; current?: string }> = [
  { label: "Application Submitted", statuses: ["Submitted"], waiting: "", current: "Your application was received." },
  { label: "Under Review", statuses: ["Under Review", "Shortlisted", "Needs Revision"], waiting: "Waiting for HR to start the review." },
  { label: "For Interview", statuses: ["Interview"], waiting: "You will be told when you are for interview.", current: "Your requirements are complete. You are now for interview." },
  { label: "Endorsed to Crame", statuses: ["Endorsed to Crame"], waiting: "After the interview, applicants who pass are endorsed to Crame for the BMI.", current: "Open the application to upload your proof of passing the BMI." },
  { label: "Neuro Exam", statuses: ["Neuro Exam"], waiting: "After the BMI comes the neuro-psychiatric exam.", current: "You are now for the neuro-psychiatric exam." },
  { label: "For Training", statuses: ["For Training"], waiting: "Applicants who pass the neuro exam are endorsed for training.", current: "You are endorsed for training." },
];

export function applicationStatusSteps(status: ApplicationStatus): TrackerStep[] {
  if (status === "Not Selected") {
    return [
      { label: "Application Submitted", state: "done" },
      { label: "Rejected — Not Selected", state: "rejected", detail: "Thank you for applying. You were not selected for this opening." },
    ];
  }
  const reached = status === "Hired" ? STAGES.length : STAGES.findIndex((stage) => stage.statuses.includes(status));
  const steps: TrackerStep[] = STAGES.map((stage, index) => {
    if (index < reached) return { label: stage.label, state: "done" };
    if (index === reached) return { label: stage.label, state: index === 0 ? "done" : "waiting", detail: reviewDetails[status] ?? stage.current };
    return { label: stage.label, state: "waiting", detail: index === reached + 1 ? stage.waiting : undefined };
  });
  if (status === "Hired") steps.push({ label: "Approved — Hired", state: "done", detail: "Congratulations! HR will contact you about the next steps." });
  return steps;
}

const stepIcons = { done: CircleCheck, waiting: Clock, rejected: CircleX };
const stepTone = { done: "text-emerald-600 dark:text-emerald-400", waiting: "text-amber-600 dark:text-amber-400", rejected: "text-destructive" };
const stepStateLabel = { done: "Completed", waiting: "Pending", rejected: "Rejected" };

export function ApplicationStatusTracker({ status }: { status: ApplicationStatus }) {
  const steps = applicationStatusSteps(status);
  return <ol aria-label="Application progress" className="space-y-0">
    {steps.map((step, index) => {
      const Icon = stepIcons[step.state];
      const last = index === steps.length - 1;
      return <li className="relative flex gap-3 pb-5 last:pb-0" data-state={step.state} key={step.label}>
        {!last ? <span aria-hidden="true" className={cn("absolute top-7 left-3 h-[calc(100%-1.75rem)] w-px -translate-x-1/2", step.state === "done" ? "bg-emerald-600/40" : "bg-border")} /> : null}
        <Icon aria-hidden="true" className={cn("size-6 shrink-0", stepTone[step.state])} />
        <div className="min-w-0">
          <p className={cn("font-medium", step.state === "rejected" && "text-destructive")}>{step.label}<span className="sr-only"> ({stepStateLabel[step.state]})</span></p>
          {step.detail ? <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p> : null}
        </div>
      </li>;
    })}
  </ol>;
}
