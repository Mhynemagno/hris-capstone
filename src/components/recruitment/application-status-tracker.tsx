import { CircleCheck, CircleX, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/schemas/recruitment";

export type TrackerStepState = "done" | "waiting" | "rejected";
export type TrackerStep = { label: string; state: TrackerStepState; detail?: string };

const reviewDetails: Partial<Record<ApplicationStatus, string>> = {
  "Under Review": "HR is reviewing your application.",
  Shortlisted: "You have been shortlisted.",
  Interview: "You have been invited to an interview.",
  "Needs Revision": "HR asked you to revise your documents. Open the application to resubmit.",
};

/**
 * Maps the recruitment workflow onto the applicant-facing steps:
 * Application Submitted → Under Review → Pending, then the final outcome once HR decides.
 * Shortlisted, Interview, and Needs Revision are all part of the review stage.
 */
export function applicationStatusSteps(status: ApplicationStatus): TrackerStep[] {
  const decided = status === "Hired" || status === "Not Selected";
  const reviewed = status !== "Submitted";
  const steps: TrackerStep[] = [
    { label: "Application Submitted", state: "done", detail: status === "Submitted" ? "Your application was received." : undefined },
    { label: "Under Review", state: reviewed ? "done" : "waiting", detail: reviewDetails[status] ?? (reviewed ? undefined : "Waiting for HR to start the review.") },
    { label: "Pending", state: decided ? "done" : "waiting", detail: decided ? undefined : "Awaiting the final decision." },
  ];
  if (status === "Hired") steps.push({ label: "Approved — Hired", state: "done", detail: "Congratulations! HR will contact you about the next steps." });
  if (status === "Not Selected") steps.push({ label: "Rejected — Not Selected", state: "rejected", detail: "Thank you for applying. You were not selected for this opening." });
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
