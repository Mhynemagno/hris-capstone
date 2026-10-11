import { CircleCheck, CircleX, Clock } from "lucide-react";

import type { ApplicantDocument, ApplicationStatusHistory } from "@/lib/types/database";
import { PIPELINE_STAGES } from "@/lib/recruitment/application-stages";
import { FINAL_MESSAGES, STAGE_MESSAGES } from "@/lib/recruitment/applicant-progress";
import { stageResultHistoryLabel } from "@/lib/recruitment/stage-results";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/schemas/recruitment";

/** How each application document kind is named on screen. */
export const documentKindLabels: Record<ApplicantDocument["kind"], string> = { cv: "CV", credential: "Credential", bmi_proof: "BMI proof" };

/** A history row that keeps the status is a progress remark (add_application_remark, submit_bmi_proof). */
export function historyEntryLabel(entry: Pick<ApplicationStatusHistory, "previous_status" | "next_status" | "result">) {
  return stageResultHistoryLabel(entry) ?? (entry.previous_status === entry.next_status ? "Remark" : entry.next_status);
}

export type TrackerStepState = "done" | "waiting" | "rejected";
export type TrackerStep = { label: string; state: TrackerStepState; detail?: string };

export function applicationStatusSteps(status: ApplicationStatus): TrackerStep[] {
  const reached = ["Shortlisted", "Not Selected", "Hired"].includes(status)
    ? PIPELINE_STAGES.length
    : PIPELINE_STAGES.indexOf(status);
  const steps: TrackerStep[] = PIPELINE_STAGES.map((label, index) => {
    if (index < reached || (index === 0 && reached === 0)) return { label, state: "done" };
    if (index === reached) return { label, state: "waiting", detail: STAGE_MESSAGES[status] };
    return { label, state: "waiting" };
  });
  if (status === "Shortlisted") steps.push({ label: "SHORTLISTED", state: "done", detail: FINAL_MESSAGES.Shortlisted });
  if (status === "Not Selected") steps.push({ label: "NOT SELECTED", state: "rejected", detail: FINAL_MESSAGES["Not Selected"] });
  if (status === "Hired") steps.push({ label: "Approved — Hired", state: "done", detail: FINAL_MESSAGES.Hired });
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
