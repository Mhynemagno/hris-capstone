"use client";

import { CheckCheck, ChevronUp, CircleCheck, CircleX, Clock, Info, ShieldCheck, TriangleAlert } from "lucide-react";

import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyPromotionStatus } from "@/hooks/use-promotion-eligibility";
import { formatDate, formatDateTime } from "@/lib/format-date";
import type { PromotionEvaluationResult } from "@/lib/types/database";
import { cn } from "@/lib/utils";

import { PromotionChecklist } from "./promotion-checklist";

const SUBTITLE = "Your records are checked automatically against the requirements for your next rank. HR approves or rejects qualified personnel.";
const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";
const eyebrow = "text-[11px] font-bold tracking-wider text-slate-500 uppercase";
const months = (value: number) => `${value} ${value === 1 ? "Mo" : "Mos"}`;

const NO_TARGET: Record<NonNullable<PromotionEvaluationResult["reason"]>, string> = {
  no_rank: "No rank is recorded on your personnel file yet. Ask HR to update your record.",
  non_uniformed: "Non-Uniformed Personnel (NUP) are not on the uniformed promotion ladder.",
  top_rank: "You already hold the highest rank on the promotion ladder.",
  inactive: "Only active personnel are evaluated for promotion.",
};

export function EmployeePromotionEligibility() {
  const query = useMyPromotionStatus();

  if (query.isLoading) return <LoadingState label="Loading your promotion status…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const evaluation = query.data?.evaluation;
  if (!evaluation || !evaluation.targetRank) {
    return (
      <div className="space-y-6">
        <PageTitle subtitle={SUBTITLE} title="Promotion Status" />
        <p className={cn(card, "p-6 text-xs text-slate-600")}>{NO_TARGET[evaluation?.reason ?? "no_rank"]}</p>
      </div>
    );
  }

  const { targetRank, currentRank, requirements, missingRequirements, isQualified } = evaluation;
  const decision = query.data?.decision ?? null;
  const verified = requirements.filter((row) => row.met).length;
  const total = Math.max(requirements.length, 1);
  const percent = Math.round((verified / total) * 100);
  const tig = evaluation.timeInGradeMonths ?? 0;
  const minimumTig = evaluation.minimumTimeInGradeMonths ?? 0;

  const statusPill = decision?.status === "approved"
    ? <StatusPill className="px-3 text-xs normal-case" icon={<CircleCheck aria-hidden="true" className="size-3.5" />} tone="emerald">Approved by HR</StatusPill>
    : decision?.status === "rejected"
      ? <StatusPill className="px-3 text-xs normal-case" icon={<CircleX aria-hidden="true" className="size-3.5" />} tone="rose">Rejected by HR</StatusPill>
      : isQualified
        ? <StatusPill className="px-3 text-xs normal-case" icon={<Clock aria-hidden="true" className="size-3.5" />} tone="amber">For approval</StatusPill>
        : <StatusPill className="px-3 text-xs normal-case" icon={<TriangleAlert aria-hidden="true" className="size-3.5" />} tone="slate">Requirements pending</StatusPill>;
  const statusNote = decision?.status === "approved"
    ? "HR will update your rank in your personnel record."
    : decision?.status === "rejected"
      ? "See HR's remarks below."
      : isQualified ? "You are listed for HR approval." : "Complete the missing requirements below.";

  return (
    <div className="space-y-6">
      <PageTitle subtitle={SUBTITLE} title="Promotion Status" />

      <p className="flex items-center gap-2 rounded-xl border border-slate-300/70 bg-slate-200/60 px-4 py-3 text-xs font-medium text-slate-700">
        <Info aria-hidden="true" className="size-4 shrink-0 text-blue-600" />
        Approval by HR does not change your rank automatically; HR records the new rank in your personnel file.
      </p>

      <section aria-label="Promotion overview" className={cn(card, "p-6")}>
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-4">
          <div className="space-y-1">
            <p className={eyebrow}>Next Rank</p>
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-900 text-amber-400"><ChevronUp aria-hidden="true" className="size-4" /></span>
              <div>
                <h2 className="text-base leading-tight font-extrabold text-slate-900">{targetRank.name}</h2>
                <p className="font-mono text-[10px] text-slate-500">{currentRank?.code ?? "—"} → {targetRank.code}</p>
              </div>
            </div>
          </div>
          <div className="space-y-1 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <p className={eyebrow}>Time in Grade</p>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-900">{months(tig)}</span>
              <span className={cn("text-xs font-semibold", tig >= minimumTig ? "text-emerald-700" : "text-rose-700")}>(Req: {months(minimumTig)})</span>
            </div>
            {evaluation.rankSince ? <p className="text-[10px] text-slate-500">Since {formatDate(evaluation.rankSince)}</p> : null}
          </div>
          <div className="space-y-1 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <p className={eyebrow}>Promotion Status</p>
            <div>{statusPill}</div>
            <p className="text-[10px] font-medium text-slate-500">{statusNote}</p>
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <div className="flex items-center justify-between">
              <p className={eyebrow}>Requirements Met</p>
              <span className={cn("font-mono text-xs font-extrabold", isQualified ? "text-emerald-700" : "text-slate-700")}>{percent}%</span>
            </div>
            <div aria-label="Requirements met" aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar">
              <div className={cn("h-full rounded-full transition-all duration-500", isQualified ? "bg-emerald-500" : "bg-blue-600")} style={{ width: `${percent}%` }} />
            </div>
            <p className="text-[10px] text-slate-500">{verified} of {total} requirements met</p>
          </div>
        </div>
      </section>

      {decision ? (
        <section aria-labelledby="decision-heading" className={cn(card, "space-y-1 p-6", decision.status === "approved" ? "border-emerald-200" : "border-rose-200")}>
          <h2 className="text-sm font-extrabold text-slate-900" id="decision-heading">HR decision</h2>
          <p className="text-xs text-slate-700">{decision.status === "approved" ? "Approved" : "Rejected"} on {formatDateTime(decision.decidedAt)}.</p>
          {decision.remarks ? <p className="text-xs text-slate-700">Remarks: {decision.remarks}</p> : null}
        </section>
      ) : null}

      <section aria-labelledby="criteria-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-extrabold tracking-wider text-slate-500 uppercase" id="criteria-heading">Requirements for {targetRank.code}</h2>
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><ShieldCheck aria-hidden="true" className="size-3.5 text-blue-600" />Checked against your current records</span>
        </div>
        <PromotionChecklist className={cn(card, "p-4")} evaluation={evaluation} />
      </section>

      <section aria-labelledby="missing-heading" className={cn(card, "space-y-4 p-6")}>
        <div>
          <h2 className="text-sm font-extrabold text-slate-900" id="missing-heading">Missing Requirements</h2>
          <p className="text-xs text-slate-500">Submit trainings, eligibility and proof through your profile; HR records your IPER and PFT.</p>
        </div>
        {missingRequirements.length ? (
          <ul className="space-y-2">
            {missingRequirements.map((requirement) => (
              <li className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800" key={requirement}>
                <CircleX aria-hidden="true" className="size-4 shrink-0" />{requirement}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCheck aria-hidden="true" className="size-4" /></span>
            <div>
              <p className="text-xs font-bold text-slate-900">Every requirement is on record.</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{decision ? statusNote : "You appear on HR's Promotion Evaluation list for approval."}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
