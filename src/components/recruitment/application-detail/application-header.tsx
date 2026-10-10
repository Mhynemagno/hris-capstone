"use client";

import Link from "next/link";
import { useState } from "react";

import { ApplicationStageBadge } from "@/components/recruitment/application-stage-badge";
import { HireDialog, StageResultDialog } from "@/components/recruitment/stage-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { stageActions } from "@/lib/recruitment/application-stages";
import { applicationStatusLabel, RESULT_LABELS, stageResultActions, type RecordableResult, type StageResult } from "@/lib/recruitment/stage-results";
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
  stageResult?: StageResult;
  stageSince: string | null;
};

export function ApplicationHeader(props: HeaderProps) {
  const [dialog, setDialog] = useState<RecordableResult | "hire" | null>(null);
  const action = stageActions(props.status);
  const results = stageResultActions(props.status, props.stageResult);
  const statusLabel = applicationStatusLabel(props.status, props.stageResult);

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
            <Badge variant={statusLabel.variant}>{statusLabel.label}</Badge>
            {action.kind === "closed"
              ? (props.stageSince ? <span className="text-sm text-muted-foreground">on {formatDate(props.stageSince)}</span> : null)
              : <span className="text-sm text-muted-foreground">in {props.status} {timeAtStage(props.stageSince)}</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {results.map((result) => (
          <Button key={result} onClick={() => setDialog(result)} variant={result === "passed" ? "default" : result === "failed" ? "destructive" : "outline"}>{RESULT_LABELS[result]}</Button>
        ))}
        {action.kind === "hire" ? <Button onClick={() => setDialog("hire")}>Hire applicant</Button> : null}
      </div>
      {results.map((result) => (
        <StageResultDialog applicationId={props.applicationId} key={result} onOpenChange={(open) => setDialog(open ? result : null)} open={dialog === result} result={result} status={props.status} />
      ))}
      <HireDialog applicantNumber={props.applicantNumber} applicationId={props.applicationId} onOpenChange={(open) => setDialog(open ? "hire" : null)} open={dialog === "hire"} />
    </header>
  );
}
