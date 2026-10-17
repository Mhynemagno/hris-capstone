"use client";

import { Award, CheckCheck, CircleCheck, CircleX, ChevronUp, Info, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyPromotionEligibility } from "@/hooks/use-promotion-eligibility";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

import { EmployeePromotionDocketModal } from "./employee-promotion-docket-modal";

const SUBTITLE = "Automated readiness review based on your official service records and the active promotion criteria for your rank.";
const years = (value: number) => `${value} ${value === 1 ? "Yr" : "Yrs"}`;
const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";
const eyebrow = "text-[11px] font-bold tracking-wider text-slate-500 uppercase";

export function EmployeePromotionEligibility() {
  const query = useMyPromotionEligibility();
  const [open, setOpen] = useState(false);

  if (query.isLoading) return <LoadingState label="Loading your promotion status…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  if (!query.data) {
    return (
      <div className="space-y-6">
        <PageTitle subtitle={SUBTITLE} title="Promotion Status" />
        <p className={cn(card, "p-6 text-xs text-slate-600")}>No active promotion criterion applies to your current rank yet. You will see your readiness here once HR publishes one.</p>
      </div>
    );
  }

  const { criterionId, targetRankName, targetRankCode, currentRankName, docket, readiness } = query.data;
  const timeInGradeYears = readiness.timeInGradeYears ?? readiness.yearsOfService;
  const minimumTimeInGradeYears = readiness.minimumTimeInGradeYears ?? readiness.minimumYearsOfService;
  const requirements = readiness.requirements.some((row) => row.label.startsWith("Time in Grade"))
    ? readiness.requirements
    : [{ label: `Time in Grade (${minimumTimeInGradeYears} years)`, met: timeInGradeYears >= minimumTimeInGradeYears }, ...readiness.requirements];
  const verified = requirements.filter((row) => row.met).length;
  const total = Math.max(requirements.length, 1);
  const serviceMet = timeInGradeYears >= minimumTimeInGradeYears;
  const percent = Math.round((verified / total) * 100);
  const canSubmit = readiness.isReady && !docket;
  const submit = (
    <button className={staffButton.primary} onClick={() => setOpen(true)} type="button">
      <Send aria-hidden="true" className="size-3.5 text-amber-300" />Submit to Promotion Board
    </button>
  );
  const submittedOn = docket ? formatDate(docket.submittedAt) : null;
  const submitted = docket ? <StatusPill icon={<CircleCheck aria-hidden="true" className="size-3" />} tone="emerald">Docket submitted {submittedOn}</StatusPill> : null;

  return (
    <div className="space-y-6">
      <PageTitle actions={canSubmit ? submit : submitted} subtitle={SUBTITLE} title="Promotion Status" />

      <p className="flex items-center gap-2 rounded-xl border border-slate-300/70 bg-slate-200/60 px-4 py-3 text-xs font-medium text-slate-700">
        <Info aria-hidden="true" className="size-4 shrink-0 text-blue-600" />
        This is a readiness review, not an automatic promotion decision.
      </p>

      <section aria-label="Promotion overview" className={cn(card, "p-6")}>
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-4">
          <div className="space-y-1">
            <p className={eyebrow}>Target Rank</p>
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-900 text-amber-400"><ChevronUp aria-hidden="true" className="size-4" /></span>
              <div>
                <h2 className="text-base leading-tight font-extrabold text-slate-900">{targetRankName}</h2>
                <p className="font-mono text-[10px] text-slate-500">Rank Code: {targetRankCode} (from {currentRankName})</p>
              </div>
            </div>
          </div>
          <div className="space-y-1 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <p className={eyebrow}>Time-in-Grade / Service</p>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-900">{years(timeInGradeYears)}</span>
              <span className={cn("text-xs font-semibold", serviceMet ? "text-emerald-700" : "text-rose-700")}>(Req: {years(minimumTimeInGradeYears)})</span>
            </div>
          </div>
          <div className="space-y-1 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <p className={eyebrow}>Readiness Status</p>
            <div>
              {docket ? (
                <StatusPill className="px-3 text-xs normal-case" icon={<CircleCheck aria-hidden="true" className="size-3.5" />} tone="blue">Docket submitted</StatusPill>
              ) : readiness.isReady ? (
                <StatusPill className="px-3 text-xs normal-case" icon={<CircleCheck aria-hidden="true" className="size-3.5" />} tone="emerald">Requirements met</StatusPill>
              ) : (
                <StatusPill className="px-3 text-xs normal-case" icon={<TriangleAlert aria-hidden="true" className="size-3.5" />} tone="amber">Requirements pending</StatusPill>
              )}
            </div>
            <p className={cn("text-[10px] font-medium", readiness.isReady ? "text-emerald-700" : "text-slate-500")}>{docket ? "Awaiting Promotion Board and HR review" : readiness.isReady ? "Eligible for Board Deliberation" : "Complete the missing requirements below"}</p>
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <div className="flex items-center justify-between">
              <p className={eyebrow}>Compliance Index</p>
              <span className={cn("font-mono text-xs font-extrabold", readiness.isReady ? "text-emerald-700" : "text-slate-700")}>{percent}% Ready</span>
            </div>
            <div aria-label="Compliance Index" aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar">
              <div className={cn("h-full rounded-full transition-all duration-500", readiness.isReady ? "bg-emerald-500" : "bg-blue-600")} style={{ width: `${percent}%` }} />
            </div>
            <p className="text-[10px] text-slate-500">{verified} of {total} Criteria Verified</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="criteria-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-extrabold tracking-wider text-slate-500 uppercase" id="criteria-heading">Qualification Criteria Breakdown</h2>
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><ShieldCheck aria-hidden="true" className="size-3.5 text-blue-600" />Checked against your current records</span>
        </div>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {requirements.map((row, index) => (
            <CriterionCard detail={row.label.startsWith("Time in Grade") ? `Minimum ${years(minimumTimeInGradeYears)} required.` : "Required record for this rank."} key={row.label} met={row.met} recorded={row.label.startsWith("Time in Grade") ? years(timeInGradeYears) : row.met ? "On record" : "Not on record"} recordedLabel={row.label.startsWith("Time in Grade") ? "Recorded:" : "Status:"} title={`${index + 1}. ${row.label}`} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="missing-heading" className={cn(card, "space-y-4 p-6")}>
        <div>
          <h2 className="text-sm font-extrabold text-slate-900" id="missing-heading">Missing Requirements</h2>
          <p className="text-xs text-slate-500">Items requiring resolution before promotion docket filing</p>
        </div>
        {readiness.missingRequirements.length ? (
          <ul className="space-y-2">
            {readiness.missingRequirements.map((requirement) => (
              <li className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800" key={requirement}>
                <CircleX aria-hidden="true" className="size-4 shrink-0" />{requirement}
              </li>
            ))}
          </ul>
        ) : null}
        {!readiness.missingRequirements.length ? (
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCheck aria-hidden="true" className="size-4" /></span>
              <div>
                <p className="text-xs font-bold text-slate-900">Every requirement is on record.</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {!serviceMet
                    ? `${years(minimumTimeInGradeYears)} in your current grade are needed before you can file.`
                    : docket
                      ? `Your docket was submitted on ${submittedOn}. HR will review it through the existing promotion evaluation.`
                      : "Your dossier is complete. You may submit your docket to the San Juan City Police Promotion Board."}
                </p>
              </div>
            </div>
            {canSubmit ? (
              <button className={staffButton.primary} onClick={() => setOpen(true)} type="button"><Award aria-hidden="true" className="size-3.5 text-amber-300" />Proceed with Docket</button>
            ) : null}
          </div>
        ) : null}
      </section>

      {canSubmit ? <EmployeePromotionDocketModal criterionId={criterionId} onOpenChange={setOpen} open={open} targetRankName={targetRankName} /> : null}
    </div>
  );
}

function CriterionCard({ title, detail, met, recorded, recordedLabel }: { title: string; detail: string; met: boolean; recorded: string; recordedLabel: string }) {
  return (
    <li className={cn(card, "flex flex-col justify-between space-y-4 p-5")}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={cn("flex size-10 items-center justify-center rounded-xl border", met ? "border-emerald-100 bg-emerald-50 text-emerald-600" : "border-rose-100 bg-rose-50 text-rose-600")}>
            {met ? <CircleCheck aria-hidden="true" className="size-5" /> : <CircleX aria-hidden="true" className="size-5" />}
          </span>
          <StatusPill tone={met ? "emerald" : "rose"}>{met ? "MET" : "NOT MET"}</StatusPill>
        </div>
        <div>
          <h3 className="text-xs font-extrabold tracking-wide text-slate-900 uppercase">{title}</h3>
          <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <span className="font-medium text-slate-500">{recordedLabel}</span>
        <span className="font-mono font-bold text-slate-800">{recorded}</span>
      </div>
    </li>
  );
}
