"use client";

import { ArrowRight, CalendarCheck, Check, Clock, FolderOpen, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyApplicationHistory, useMyApplicationStatuses } from "@/hooks/use-applicant-portal";
import { useApplicantProfile, useApplicantProfileDocuments } from "@/hooks/use-recruitment";
import { nextAction, progressTimeline, STAGE_SHORT_LABELS, stageProgress } from "@/lib/recruitment/applicant-progress";
import { PIPELINE_STAGES } from "@/lib/recruitment/application-stages";
import type { Application } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

type LatestApplication = Application & { job_openings?: { title?: string } | null };

const cardClassName = "flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition-shadow hover:shadow-md";

function CardLink({ children, href, tone = "teal" }: { children: ReactNode; href: string; tone?: "teal" | "amber" }) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-1 text-xs font-bold hover:underline",
        tone === "teal" ? "text-teal-700 hover:text-teal-900" : "text-amber-700 hover:text-amber-900",
      )}
      href={href}
    >
      {children} <ArrowRight aria-hidden="true" className="size-2.5" />
    </Link>
  );
}

/** Capstone UI notifapp.html, dashboard tab. */
export function ApplicantDashboard() {
  const profile = useApplicantProfile();
  const applications = useMyApplicationStatuses();
  const documents = useApplicantProfileDocuments();
  const latest = applications.data?.rows[0] as LatestApplication | undefined;
  const history = useMyApplicationHistory(latest?.id);

  if (profile.isLoading || applications.isLoading || documents.isLoading) return <LoadingState label="Loading your dashboard…" />;
  const failure = profile.error ?? applications.error ?? documents.error;
  if (failure) return <ErrorState message={failure.message} />;

  const uploadedKinds = new Set((documents.data ?? []).map((document) => document.kind));
  const uploaded = APPLICANT_PROFILE_DOCUMENT_KINDS.filter(({ kind }) => uploadedKinds.has(kind)).length;
  const required = APPLICANT_PROFILE_DOCUMENT_KINDS.length;
  const firstName = profile.data?.first_name;
  const action = nextAction(latest ?? null);
  const timeline = progressTimeline(latest?.status ?? null, history.data ?? []);
  const cycleYear = latest ? new Date(latest.submitted_at).getFullYear() : new Date().getFullYear();
  const columns = [PIPELINE_STAGES.slice(0, 4), PIPELINE_STAGES.slice(4)];

  return (
    <div className="space-y-6">
      {/* WELCOME HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{firstName ? `Welcome, ${firstName}!` : "Welcome!"}</h1>
        <p className="mt-0.5 text-xs text-slate-500">Monitor your application progress and manage your documentary requirements for CY {new Date().getFullYear()} Recruitment.</p>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section aria-labelledby="dashboard-latest" className={cardClassName}>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <SlidersHorizontal aria-hidden="true" className="size-3.5 text-teal-600" />
              <h2 id="dashboard-latest">Latest application</h2>
            </div>
            {latest ? (
              <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {(latest.job_openings?.title ?? "San Juan City Recruitment").toUpperCase()} - CY {cycleYear}
              </div>
            ) : null}
            <h3 className="mt-1 text-lg font-bold text-slate-900">{latest?.status ?? "Pending"}</h3>
            <div className="mt-2 inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {stageProgress(latest?.status ?? null)} / {PIPELINE_STAGES.length}
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <CardLink href="/applicant/applications">View application status</CardLink>
          </div>
        </section>

        <section aria-labelledby="dashboard-documents" className={cardClassName}>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <FolderOpen aria-hidden="true" className="size-3.5 text-teal-600" />
              <h2 id="dashboard-documents">Documents</h2>
            </div>
            <h3 className="text-lg font-bold text-slate-900">{uploaded} of {required}</h3>
            <p className="mt-1 text-xs text-slate-500">{uploaded === required ? "Required documents uploaded and verified." : "Upload your remaining required documents."}</p>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <CardLink href="/applicant/documents">Manage documents</CardLink>
          </div>
        </section>

        <section aria-labelledby="dashboard-next" className={cn(cardClassName, "border-amber-200/90 bg-amber-50/20")}>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-700">
              <CalendarCheck aria-hidden="true" className="size-3.5 text-amber-600" />
              <h2 id="dashboard-next">Next Action Required</h2>
            </div>
            <h3 className="mt-1 text-sm font-bold text-slate-900">{action.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{action.detail}</p>
          </div>
          <div className="mt-4 border-t border-amber-100 pt-3">
            <CardLink href={action.href} tone="amber">View Schedule Details</CardLink>
          </div>
        </section>
      </div>

      {/* RECRUITMENT PROCESS */}
      <section aria-labelledby="dashboard-process" className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-bold tracking-wider text-slate-900 uppercase" id="dashboard-process">Recruitment process</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-xs font-medium text-slate-700 sm:grid-cols-2">
          {columns.map((stages, column) => (
            <ol className="space-y-2.5" key={column} start={column * 4 + 1}>
              {stages.map((stage, index) => (
                <li className="flex items-center gap-2" key={stage}>
                  <span aria-hidden="true" className="w-4 font-bold text-teal-700">{column * 4 + index + 1}.</span>
                  <span>{STAGE_SHORT_LABELS[stage as keyof typeof STAGE_SHORT_LABELS]}</span>
                </li>
              ))}
            </ol>
          ))}
        </div>
      </section>

      {/* LATEST APPLICATION PROGRESS */}
      <section aria-labelledby="dashboard-progress" className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <h2 className="border-b border-slate-100 pb-3 text-xs font-bold tracking-wider text-slate-900 uppercase" id="dashboard-progress">Latest application progress</h2>
        <ol aria-label="Application progress" className="space-y-4 pl-2">
          {timeline.map((step) => (
            <li className="flex items-start gap-3" key={step.label}>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs",
                  step.state === "done" ? "bg-emerald-100 text-emerald-700" : step.state === "current" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400 opacity-60",
                )}
              >
                {step.state === "done" ? <Check className="size-2.5" /> : <Clock className="size-2.5" />}
              </span>
              <div>
                <h3 className={cn("text-xs", step.state === "upcoming" ? "font-semibold text-slate-500" : "font-bold text-slate-900")}>
                  {step.label}
                  <span className="sr-only"> ({step.state === "done" ? "completed" : step.state === "current" ? "current stage" : "upcoming"})</span>
                </h3>
                <p className={cn("text-[11px]", step.state === "done" ? "text-slate-500" : step.state === "current" ? "text-slate-600" : "text-slate-500")}>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
