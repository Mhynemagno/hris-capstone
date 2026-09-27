"use client";

import Link from "next/link";
import { BriefcaseBusiness, FileText, ListChecks } from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { useMyApplicationStatuses } from "@/hooks/use-applicant-portal";
import { useApplicantProfile, useApplicantProfileDocuments } from "@/hooks/use-recruitment";
import type { Application } from "@/lib/types/database";

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
  const uploaded = new Set((documents.data ?? []).map((document) => document.kind)).size;
  const firstName = profile.data?.first_name;

  return <section aria-labelledby="page-title" className="space-y-8">
    <PageHeader description="Track your application and keep your requirements up to date." id="page-title" title={firstName ? `Welcome, ${firstName}` : "Dashboard"} />
    <div className="grid gap-4 md:grid-cols-3">
      <article aria-labelledby="dashboard-latest" className={cardClassName}>
        <div>
          <div className="flex items-center gap-2"><ListChecks aria-hidden="true" className="size-5 text-primary" /><h2 className="font-semibold" id="dashboard-latest">Latest application</h2></div>
          {latest ? <><p className="mt-3 text-sm text-muted-foreground">{latest.job_openings?.title ?? "Application"}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{latest.status}</p></> : <p className="mt-3 text-sm text-muted-foreground">No application submitted yet.</p>}
        </div>
        <Link className={linkClassName} href="/applicant/applications">View application status</Link>
      </article>
      <article aria-labelledby="dashboard-documents" className={cardClassName}>
        <div>
          <div className="flex items-center gap-2"><FileText aria-hidden="true" className="size-5 text-primary" /><h2 className="font-semibold" id="dashboard-documents">Documents</h2></div>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{uploaded} of 2</p>
          <p className="mt-1 text-sm text-muted-foreground">{uploaded === 2 ? "Required documents uploaded." : "Upload your Eligibility and Diploma."}</p>
        </div>
        <Link className={linkClassName} href="/applicant/documents">Manage documents</Link>
      </article>
      <article aria-labelledby="dashboard-jobs" className={cardClassName}>
        <div>
          <div className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="size-5 text-primary" /><h2 className="font-semibold" id="dashboard-jobs">Job openings</h2></div>
          <p className="mt-3 text-sm text-muted-foreground">See the positions currently accepting applications.</p>
        </div>
        <Link className={linkClassName} href="/jobs">Browse job openings</Link>
      </article>
    </div>
  </section>;
}
