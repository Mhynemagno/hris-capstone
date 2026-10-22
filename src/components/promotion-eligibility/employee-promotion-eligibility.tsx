"use client";

import { ChevronUp, CircleCheck, CircleX, Clock, Info, ShieldCheck, TriangleAlert } from "lucide-react";

import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyPromotionStatus } from "@/hooks/use-promotion-eligibility";
import { formatDateTime } from "@/lib/format-date";
import type { PromotionEvaluationResult } from "@/lib/types/database";
import { cn } from "@/lib/utils";

import { ScorecardBreakdown, eligibilityLabel, formatScore, hasUnassessedCriteria } from "./promotion-scorecard";

const SUBTITLE = "Your records are scored automatically on the official promotion scorecard for your next rank. HR reviews every score and approves or rejects.";
const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";
const eyebrow = "text-[11px] font-bold tracking-wider text-slate-500 uppercase";

const NO_TARGET: Record<NonNullable<PromotionEvaluationResult["reason"]>, string> = {
  no_rank: "No rank is recorded on your personnel file yet. Ask HR to update your record.",
  non_uniformed: "Non-Uniformed Personnel (NUP) are not on the uniformed promotion ladder.",
  below_scored_rank: "Your rank is not covered by the official promotion scorecards (PCPL to PLTCOL).",
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

  const { targetRank, currentRank } = evaluation;
  const decision = query.data?.decision ?? null;
  const boardPending = hasUnassessedCriteria(evaluation);
  const score = evaluation.totalScore ?? 0;
  const maximum = evaluation.maximumScore ?? 100;
  const percent = Math.round((score / Math.max(maximum, 1)) * 100);

  const statusPill = decision?.status === "approved"
    ? <StatusPill className="px-3 text-xs normal-case" icon={<CircleCheck aria-hidden="true" className="size-3.5" />} tone="emerald">Approved by HR</StatusPill>
    : decision?.status === "rejected"
      ? <StatusPill className="px-3 text-xs normal-case" icon={<CircleX aria-hidden="true" className="size-3.5" />} tone="rose">Rejected by HR</StatusPill>
      : boardPending
        ? <StatusPill className="px-3 text-xs normal-case" icon={<TriangleAlert aria-hidden="true" className="size-3.5" />} tone="slate">Awaiting Promotion Board</StatusPill>
        : <StatusPill className="px-3 text-xs normal-case" icon={<Clock aria-hidden="true" className="size-3.5" />} tone="amber">For approval</StatusPill>;
  const statusNote = decision?.status === "approved"
    ? "HR will update your rank in your personnel file."
    : decision?.status === "rejected"
      ? "See HR's remarks below."
      : boardPending ? "The Promotion Board has not assessed you yet." : "Your scorecard is with HR for review.";

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
          <div className="space-y-2 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <div className="flex items-center justify-between">
              <p className={eyebrow}>Score</p>
              <span className="font-mono text-xs font-extrabold text-slate-900">{formatScore(score)} / {formatScore(maximum)}</span>
            </div>
            <div aria-label="Promotion score" aria-valuemax={maximum} aria-valuemin={0} aria-valuenow={score} className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar">
              <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-[10px] text-slate-500">{evaluation.band} scorecard</p>
          </div>
          <div className="space-y-1 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <p className={eyebrow}>Promotion Status</p>
            <div>{statusPill}</div>
            <p className="text-[10px] font-medium text-slate-500">{statusNote}</p>
          </div>
          <div className="space-y-1 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <p className={eyebrow}>Eligibility</p>
            <p className="text-xs font-semibold text-slate-800">{eligibilityLabel(evaluation)}</p>
            <p className="text-[10px] text-slate-500">Shown for reference; not part of the score.</p>
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
          <h2 className="text-xs font-extrabold tracking-wider text-slate-500 uppercase" id="criteria-heading">Scorecard for {targetRank.code}</h2>
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><ShieldCheck aria-hidden="true" className="size-3.5 text-blue-600" />Scored from your verified records</span>
        </div>
        <ScorecardBreakdown className="bg-white shadow-sm" evaluation={evaluation} />
        <p className="mt-2 text-[11px] text-slate-500">Assignments, awards and Promotion Board assessments are recorded by HR from verified documents. Ask HR if a record is missing.</p>
      </section>
    </div>
  );
}
