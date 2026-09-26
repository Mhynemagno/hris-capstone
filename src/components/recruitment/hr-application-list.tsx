"use client";

import Link from "next/link";
import { Eye, SlidersHorizontal, UserRound } from "lucide-react";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { NativeSelect } from "@/components/ui/native-select";
import { useHrApplications } from "@/hooks/use-recruitment";
import type { HrShortlistApplication } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { applicationStatusSchema, type ApplicationStatus } from "@/schemas/recruitment";

type AiStatusFilter = "" | "queued" | "processing" | "completed" | "failed" | "unscored";

const statusStyles: Record<ApplicationStatus, string> = {
  Submitted: "bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-400/30",
  "Under Review": "bg-indigo-50 text-indigo-800 ring-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-400/30",
  Shortlisted: "bg-teal-50 text-teal-800 ring-teal-600/20 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-400/30",
  Interview: "bg-violet-50 text-violet-800 ring-violet-600/20 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-400/30",
  "Needs Revision": "bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-400/30",
  Hired: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-400/30",
  "Not Selected": "bg-muted text-muted-foreground ring-border",
};

const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

function formatApplicantNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const digits = String(value).padStart(6, "0");
  return `${digits.slice(0, 1)}-${digits.slice(1)}`;
}

function AiScore({ application }: { application: HrShortlistApplication }) {
  if (application.ai_score_status === "completed" && application.ai_score !== null) {
    const score = application.ai_score;
    const tone = score >= 75 ? "bg-emerald-600" : score >= 50 ? "bg-amber-500" : "bg-destructive";
    return (
      <div className="flex min-w-32 items-center gap-2">
        <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.max(2, score)}%` }} />
        </span>
        <span className="font-semibold tabular-nums">{score}/100</span>
      </div>
    );
  }
  const text = application.ai_score_status === "failed" ? "Analysis failed" : application.ai_score_status === "unscored" ? "Not analyzed" : "Analyzing application…";
  return <span className={cn("text-muted-foreground", application.ai_score_status === "failed" && "text-destructive")}>{text}</span>;
}

export function HrApplicationList() {
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [aiStatus, setAiStatus] = useState<AiStatusFilter>("");
  const [minimumScore, setMinimumScore] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const scoreValue = minimumScore === "" ? undefined : Math.min(100, Math.max(0, Number(minimumScore)));
  const applications = useHrApplications({
    page: 1,
    pageSize: 100,
    status: status || undefined,
    aiStatus: aiStatus || undefined,
    minimumScore: Number.isFinite(scoreValue) ? scoreValue : undefined,
  });
  const activeFilterCount = [status, aiStatus, minimumScore].filter(Boolean).length;
  const rows = applications.data?.rows ?? [];

  function clearFilters() {
    setStatus("");
    setAiStatus("");
    setMinimumScore("");
  }

  return (
    <section aria-label="Application list" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {applications.isLoading ? "Loading…" : rows.length === 1 ? "1 application" : `${rows.length} applications`}
        </p>
        <Button aria-controls="application-filters" aria-expanded={filtersOpen} className="min-h-11" onClick={() => setFiltersOpen((open) => !open)} type="button" variant="outline">
          <SlidersHorizontal aria-hidden="true" />
          Filter
          {activeFilterCount ? <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{activeFilterCount}</span> : null}
        </Button>
      </div>

      <div className="grid gap-4 border-b bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end" hidden={!filtersOpen} id="application-filters">
        <FormField htmlFor="application-status" label="Application status">
          <NativeSelect id="application-status" onChange={(event) => setStatus(event.target.value as ApplicationStatus | "")} value={status}>
            <option value="">All statuses</option>
            {applicationStatusSchema.options.map((option) => <option key={option} value={option}>{option}</option>)}
          </NativeSelect>
        </FormField>
        <FormField htmlFor="application-ai-status" label="AI analysis status">
          <NativeSelect id="application-ai-status" onChange={(event) => setAiStatus(event.target.value as AiStatusFilter)} value={aiStatus}>
            <option value="">All results</option>
            <option value="queued">Queued</option>
            <option value="processing">Analyzing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="unscored">Not analyzed</option>
          </NativeSelect>
        </FormField>
        <FormField htmlFor="application-minimum-score" label="Minimum AI score (0–100)">
          <Input id="application-minimum-score" inputMode="numeric" max="100" min="0" onChange={(event) => setMinimumScore(event.target.value)} placeholder="Any score" type="number" value={minimumScore} />
        </FormField>
        <Button className="min-h-11 w-full" disabled={!activeFilterCount} onClick={clearFilters} type="button" variant="ghost">Clear filters</Button>
      </div>

      {applications.isLoading ? <div className="p-4"><LoadingState label="Loading applications…" /></div> : applications.error ? <div className="p-4"><ErrorState message={applications.error.message} /></div> : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Applications awaiting HR review</caption>
            <thead className="border-b bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold" scope="col">Applicant</th>
                <th className="px-4 py-3 font-semibold" scope="col">Position</th>
                <th className="px-4 py-3 font-semibold" scope="col">Status</th>
                <th className="px-4 py-3 font-semibold" scope="col">Submitted</th>
                <th className="px-4 py-3 font-semibold" scope="col">AI recommendation</th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length ? rows.map((application) => {
                const name = application.applicant_name || `Application ${application.id.slice(0, 8)}`;
                const number = formatApplicantNumber(application.applicant_number);
                return (
                  <tr className="transition-colors hover:bg-muted/40" key={application.id}>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          <UserRound className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold">{name}</p>
                          {number ? <p className="text-xs text-muted-foreground tabular-nums">Applicant no. {number}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">{application.job_title ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 align-middle">
                      <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", statusStyles[application.status] ?? statusStyles["Not Selected"])}>
                        {application.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap tabular-nums">{dateFormat.format(new Date(application.submitted_at))}</td>
                    <td className="px-4 py-3 align-middle"><AiScore application={application} /></td>
                    <td className="px-4 py-3 text-right align-middle">
                      <Link className={buttonVariants({ className: "min-h-10", size: "sm", variant: "outline" })} href={`/hr/applications/${application.id}`}>
                        <Eye aria-hidden="true" />
                        Review{" "}<span className="sr-only">application {application.applicant_name || application.id.slice(0, 8)}</span>
                      </Link>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td className="px-4 py-12 text-center text-muted-foreground" colSpan={6}>
                    {activeFilterCount ? "No applications match these filters. Clear the filters to see every application." : "There are no applications to review."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
