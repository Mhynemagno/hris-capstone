"use client";

import Link from "next/link";
import { useState } from "react";

import { ApplicationStageBadge } from "@/components/recruitment/application-stage-badge";
import { HireDialog, MoveStageDialog, NotSelectedDialog } from "@/components/recruitment/stage-dialogs";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { stageActions } from "@/lib/recruitment/application-stages";
import type { ApplicationStatus } from "@/schemas/recruitment";

function timeAtStage(since: string | null) {
  if (!since) return null;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  return days < 1 ? "since today" : `for ${days} ${days === 1 ? "day" : "days"}`;
}

type HeaderProps = {
  applicationId: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  applicantNumber: number | null;
  formattedNumber: string | null;
  jobId: number;
  jobTitle: string | null;
  submittedAt: string;
  status: ApplicationStatus;
  stageSince: string | null;
  hasBmiProof: boolean;
};

export function ApplicationHeader(props: HeaderProps) {
  const [dialog, setDialog] = useState<"move" | "reject" | "hire" | null>(null);
  const action = stageActions(props.status, props.hasBmiProof);
  const canReject = "canReject" in action && action.canReject;

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {props.photoUrl
          // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL, not a configured next/image domain
          ? <img alt="" className="size-14 shrink-0 rounded-full border object-cover" src={props.photoUrl} />
          : <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-subtle text-lg font-semibold text-primary">{props.initials}</span>}
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold">{props.name}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {props.formattedNumber ? <span className="tabular-nums">{props.formattedNumber}</span> : null}
            {props.jobTitle ? <><span aria-hidden="true">·</span><Link className="text-primary hover:underline" href={`/hr/jobs/${props.jobId}`}>{props.jobTitle}</Link></> : null}
            <span aria-hidden="true">·</span><span>Submitted {formatDate(props.submittedAt)}</span>
          </p>
          <p className="flex flex-wrap items-center gap-2 pt-1">
            <ApplicationStageBadge status={props.status} />
            {action.kind === "closed"
              ? (props.stageSince ? <span className="text-sm text-muted-foreground">on {formatDate(props.stageSince)}</span> : null)
              : <span className="text-sm text-muted-foreground">in {props.status} {timeAtStage(props.stageSince)}</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {action.kind === "waiting-resubmit" ? <p className="text-sm text-muted-foreground">Waiting for the applicant to resubmit</p> : null}
        {action.kind === "waiting-bmi" ? <p className="text-sm text-muted-foreground">Waiting for the applicant&apos;s BMI proof</p> : null}
        {canReject ? <Button onClick={() => setDialog("reject")} variant="outline">Not selected</Button> : null}
        {action.kind === "advance" || action.kind === "waiting-bmi" ? <Button disabled={action.kind === "waiting-bmi"} onClick={() => setDialog("move")}>Move to next stage</Button> : null}
        {action.kind === "hire" ? <Button onClick={() => setDialog("hire")}>Hire applicant</Button> : null}
      </div>
      <MoveStageDialog applicationId={props.applicationId} onOpenChange={(open) => setDialog(open ? "move" : null)} open={dialog === "move"} status={props.status} />
      <NotSelectedDialog applicationId={props.applicationId} onOpenChange={(open) => setDialog(open ? "reject" : null)} open={dialog === "reject"} />
      <HireDialog applicantNumber={props.applicantNumber} applicationId={props.applicationId} onOpenChange={(open) => setDialog(open ? "hire" : null)} open={dialog === "hire"} />
    </header>
  );
}
