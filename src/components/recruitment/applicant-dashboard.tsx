"use client";

import Link from "next/link";
import { BriefcaseBusiness, FileText, ListChecks } from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ApplicationStatusTracker } from "@/components/recruitment/application-status-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { useMyApplicationStatuses } from "@/hooks/use-applicant-portal";
import { PNP_GENERAL_REQUIREMENTS } from "@/lib/pnp-catalogue";
import { PIPELINE_STAGES } from "@/lib/recruitment/application-stages";
import { useApplicantProfile, useApplicantProfileDocuments } from "@/hooks/use-recruitment";
import type { Application } from "@/lib/types/database";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

const cardClassName = "flex h-full flex-col justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm";
const linkClassName = "inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline";

export function ApplicantDashboard() {
  const profile = useApplicantProfile();
  const applications = useMyApplicationStatuses();
  const documents = useApplicantProfileDocuments();

  if (profile.isLoading || applications.isLoading || documents.isLoading) return <LoadingState label="Loading your dashboard…" />;
  const failure = profile.error ?? applications.error ?? documents.error;
  if (failure) return <ErrorState message={failure.message} />;

  const latest = applications.data?.rows[0] as (Application & { job_openings?: { title?: string } | null }) | undefined;
  const uploadedKinds = new Set((documents.data ?? []).map((document) => document.kind));
  const uploaded = APPLICANT_PROFILE_DOCUMENT_KINDS.filter(({ kind }) => uploadedKinds.has(kind)).length;
  const required = APPLICANT_PROFILE_DOCUMENT_KINDS.length;
  const firstName = profile.data?.first_name;
  const stageIndex = latest ? PIPELINE_STAGES.indexOf(latest.status) : -1;
  const progress = latest ? (stageIndex >= 0 ? stageIndex + 1 : PIPELINE_STAGES.length) : 0;

  return <section aria-labelledby="page-title" className="space-y-8">
    <PageHeader description="Track your application and keep your requirements up to date." id="page-title" title={firstName ? `Welcome, ${firstName}` : "Dashboard"} />
    <div className="grid gap-4 md:grid-cols-3">
      <article aria-labelledby="dashboard-latest" className={cardClassName}>
        <div>
          <div className="flex items-center gap-2"><ListChecks aria-hidden="true" className="size-5 text-primary" /><h2 className="font-bold" id="dashboard-latest">Latest application</h2></div>
          {latest ? <><p className="mt-3 text-sm text-muted-foreground">{latest.job_openings?.title ?? "Application"}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{latest.status}</p><p className="mt-1 text-sm font-medium text-primary">{progress} / {PIPELINE_STAGES.length}</p></> : <><p className="mt-3 text-sm text-muted-foreground">No application submitted yet.</p><p className="mt-1 text-sm font-medium text-primary">0 / {PIPELINE_STAGES.length}</p></>}
        </div>
        {latest
          ? <Link className={linkClassName} href="/applicant/applications">View application status</Link>
          : <Link className={linkClassName} href="/jobs">Start an application</Link>}
      </article>
      <article aria-labelledby="dashboard-documents" className={cardClassName}>
        <div>
          <div className="flex items-center gap-2"><FileText aria-hidden="true" className="size-5 text-primary" /><h2 className="font-bold" id="dashboard-documents">Documents</h2></div>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{uploaded} of {required}</p>
          <p className="mt-1 text-sm text-muted-foreground">{uploaded === required ? "Required documents uploaded." : "Upload your CV / Resume, PSA birth certificate, 2x2 picture, Eligibility, and Diploma."}</p>
        </div>
        <Link className={linkClassName} href="/applicant/documents">Manage documents</Link>
      </article>
      <article aria-labelledby="dashboard-jobs" className={cardClassName}>
        <div>
          <div className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="size-5 text-primary" /><h2 className="font-bold" id="dashboard-jobs">Job openings</h2></div>
          <p className="mt-3 text-sm text-muted-foreground">See the positions currently accepting applications.</p>
        </div>
        <Link className={linkClassName} href="/jobs">Browse job openings</Link>
      </article>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="recruitment-process-heading" className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-bold" id="recruitment-process-heading">Recruitment process</h2>
        <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {PIPELINE_STAGES.map((stage, index) => <li className="flex gap-2" key={stage}><span className="font-semibold text-primary">{index + 1}.</span>{stage}</li>)}
        </ol>
      </section>
      <section aria-labelledby="pnp-qualifications-heading" className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-bold" id="pnp-qualifications-heading">PNP minimum qualifications</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{PNP_GENERAL_REQUIREMENTS.education[0]}</li>
          <li>One qualifying eligibility, such as {PNP_GENERAL_REQUIREMENTS.eligibility[0]}</li>
          {PNP_GENERAL_REQUIREMENTS.other.map((requirement) => <li key={requirement}>{requirement}</li>)}
        </ul>
      </section>
    </div>
    {latest ? <section aria-labelledby="latest-progress-heading" className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="font-bold" id="latest-progress-heading">Latest application progress</h2>
      <div className="mt-4"><ApplicationStatusTracker status={latest.status} /></div>
    </section> : null}
  </section>;
}
