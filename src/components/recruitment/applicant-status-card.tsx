"use client";

import { Bell, CircleCheck, CircleX, FileText } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyApplicationHistory, useMyApplicationStatuses } from "@/hooks/use-applicant-portal";
import { FINAL_MESSAGES, scheduleParts, STAGE_MESSAGES } from "@/lib/recruitment/applicant-progress";
import type { Application } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/** Capstone UI notifapp.html, Application Status tab: the next action, its schedule, and HR's remarks. */
export function ApplicantStatusCard() {
  const applications = useMyApplicationStatuses();
  const latest = applications.data?.rows[0] as Application | undefined;
  const history = useMyApplicationHistory(latest?.id);

  if (applications.isLoading) return <LoadingState label="Loading your application status…" />;
  if (applications.error) return <ErrorState message={applications.error.message} />;

  const finished = latest && (latest.status === "Hired" || latest.status === "Shortlisted" || latest.status === "Not Selected");
  // Remarks for the current status: the note HR sent with the result that moved the application here
  // (e.g. why it was not selected), then notes added at this stage (remarks, Verified / Scheduled notes).
  const remarks = latest
    ? (history.data ?? []).filter((entry) => entry.next_status === latest.status && entry.note?.trim()).map((entry) => entry.note!.trim())
    : [];
  const schedule = latest?.stage_result === "scheduled" ? scheduleParts(latest.stage_scheduled_at) : null;
  const scheduleLine = schedule
    ? `Reporting time: ${schedule.time} on ${schedule.date}${latest?.stage_venue ? ` at ${latest.stage_venue}` : ""}.`
    : latest ? (STAGE_MESSAGES[latest.status] ?? "") : "";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-bold text-slate-900">Application Status</h1>

        {!latest ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-500" />
            <div>
              <span className="font-bold">Pending</span>
              <p className="mt-0.5">Your application is pending. Upload all required documents and press Save All Documents to submit it.</p>
              <Link className="mt-2 inline-flex text-xs font-bold text-blue-700 hover:underline" href="/applicant/documents">Go to Documents</Link>
            </div>
          </div>
        ) : finished ? (
          <div className={cn("mb-6 flex items-start gap-3 rounded-xl border p-4 text-xs", latest.status === "Not Selected" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900")}>
            {latest.status === "Not Selected"
              ? <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red-600" />
              : <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />}
            <div>
              <span className="font-bold">{latest.status === "Shortlisted" ? "Candidate" : latest.status}</span>
              <p className="mt-0.5">{FINAL_MESSAGES[latest.status]}</p>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <Bell aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <span className="font-bold">Next Action Required: {latest.status}</span>
              <p className="mt-0.5">{scheduleLine}</p>
            </div>
          </div>
        )}

        {latest ? (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase">REMARKS</h2>
            {remarks.length > 0 ? (
              <ul className="list-inside list-disc space-y-1.5 text-xs text-slate-600">
                {remarks.map((remark, index) => <li key={index}>{remark}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No remarks from HR yet.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
