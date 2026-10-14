"use client";

import { Award, ChevronDown, CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffLabel, StaffSelect, StaffTextarea } from "@/components/staff-shell/ui/staff-fields";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { LoadingState } from "@/components/ui/loading-state";
import { useRankOptions } from "@/hooks/use-administration";
import { useCreatePromotionEvaluation, useHrPromotionEmployee, usePromotionCriteria, usePromotionReadiness } from "@/hooks/use-promotion-eligibility";
import { cn } from "@/lib/utils";

import { PerformanceEvaluation } from "./performance-evaluation";

const RECOMMENDATIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "not_recommended", label: "Not recommended" },
  { value: "deferred", label: "Deferred" },
] as const;

function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

function ChecklistRow({ met, title, detail }: { met: boolean; title: string; detail: string }) {
  const Icon = met ? CircleCheck : CircleX;
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl border p-3 text-xs", met ? "border-emerald-200/80 bg-emerald-50/60" : "border-rose-200/80 bg-rose-50/60")}>
      <div className="flex items-center gap-2.5">
        <Icon aria-hidden="true" className={cn("size-4 shrink-0", met ? "text-emerald-600" : "text-rose-600")} />
        <div>
          <p className={cn("font-bold", met ? "text-emerald-950" : "text-rose-950")}>{title}</p>
          <p className={cn("text-[10px]", met ? "text-emerald-700" : "text-rose-700")}>{detail}</p>
        </div>
      </div>
      <span className={cn("font-mono font-bold", met ? "text-emerald-700" : "text-rose-700")}>{met ? "PASSED" : "NOT MET"}</span>
    </div>
  );
}

/** "Promotion Eligibility Evaluation" (Capstone UI promotions.html Open Review, PDF p. 30), with the Round 5 rubric kept inside. */
export function PromotionReviewModal({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const detail = useHrPromotionEmployee(employeeId);
  const criteria = usePromotionCriteria({ isActive: true });
  const readiness = usePromotionReadiness(employeeId);
  const ranks = useRankOptions();
  const create = useCreatePromotionEvaluation();
  const [criterionId, setCriterionId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<(typeof RECOMMENDATIONS)[number]["value"]>("recommended");
  const [notes, setNotes] = useState("");
  const [rubricOpen, setRubricOpen] = useState(false);

  const data = detail.data;
  const active = criteria.data ?? [];
  const latest = readiness.data?.[0];
  const defaultCriterion = latest ? active.find((criterion) => criterion.target_rank_id === latest.target_rank_id) : undefined;
  const chosen = active.find((criterion) => criterion.id === criterionId)
    ?? defaultCriterion;
  const rankById = (id: number | null | undefined) => ranks.data?.find((rank) => rank.id === id);
  const targetRank = rankById(chosen?.target_rank_id);
  const currentRank = rankById(data?.employee.rank_id);
  const entry = readiness.data?.find((row) => row.target_rank_id === chosen?.target_rank_id);
  const ready = entry?.readiness.isReady ?? false;

  async function submit() {
    if (!chosen || create.isPending || readiness.isLoading) return;
    try {
      await create.mutateAsync({ employeeId, targetRankId: chosen.target_rank_id, criterionId: chosen.id, evaluatedOn: manilaToday(), recommendation, notes: notes.trim() || undefined, evidence: [] });
      notifyStaff({ title: "Board endorsement submitted" });
      onClose();
    } catch (cause) {
      notifyStaff({ title: "Could not submit the endorsement", description: cause instanceof Error ? cause.message : undefined, tone: "error" });
    }
  }

  const loading = detail.isLoading || criteria.isLoading;
  const missing = !loading && (!data || detail.error);

  return (
    <StaffModal
      footer={missing || loading ? <button className={staffButton.secondary} onClick={onClose} type="button">Close</button> : (
        <>
          <button className={staffButton.secondary} onClick={onClose} type="button">Close</button>
          <button className={staffButton.primary} disabled={create.isPending || readiness.isLoading || !chosen} onClick={() => void submit()} type="button">{create.isPending ? "Submitting…" : "Submit Endorsement"}</button>
        </>
      )}
      icon={<Award aria-hidden="true" className="size-4" />}
      iconClassName="bg-blue-900 text-amber-400 shadow-sm"
      onClose={onClose}
      open
      size="2xl"
      subtitle={targetRank ? `Review candidate criteria checklist for ${targetRank.code} rank` : "Review candidate criteria checklist"}
      title="Promotion Eligibility Evaluation"
    >
      {loading ? <LoadingState label="Loading promotion review…" /> : missing || !data ? (
        <p className="font-semibold text-slate-600">This employee could not be found.</p>
      ) : (
        <>
          {active.length > 1 || !defaultCriterion ? (
            <div className="space-y-1">
              <StaffLabel htmlFor="review-criterion">Target Rank</StaffLabel>
              <StaffSelect id="review-criterion" onChange={(event) => setCriterionId(event.target.value || null)} required={!defaultCriterion} value={chosen?.id ?? ""}>
                {!defaultCriterion ? <option value="">Choose target rank</option> : null}
                {active.map((criterion) => {
                  const rank = rankById(criterion.target_rank_id);
                  return <option key={criterion.id} value={criterion.id}>{rank ? `${rank.code} — ${rank.name}` : `Rank #${criterion.target_rank_id}`}</option>;
                })}
              </StaffSelect>
            </div>
          ) : null}
          {criteria.error ? <p className="text-[11px] font-semibold text-rose-700" role="alert">{criteria.error.message}</p> : !chosen ? <p className="text-[11px] font-semibold text-amber-700">No active promotion criteria exist. Add criteria first.</p> : null}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
            <div>
              <p className="text-sm font-bold text-slate-900">{data.employee.last_name}, {data.employee.first_name}</p>
              <p className="font-mono text-[10px] text-slate-500">{`Current Rank: ${currentRank ? `${currentRank.name} (${currentRank.code})` : "Not set"} • Badge ${data.employee.employee_number}`}</p>
            </div>
            <span className={cn("rounded-full border px-3 py-1 text-[10px] font-bold", ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
              {ready ? "Ready for Board Review" : "Not Yet Ready"}
            </span>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Criteria Requirements Checklist</h4>
            {entry ? (
              <>
                <ChecklistRow
                  detail={`At least ${entry.readiness.minimumYearsOfService} years in current ${currentRank?.code ?? ""} rank (Actual: ${entry.readiness.yearsOfService} Years)`.replace("  ", " ")}
                  met={entry.readiness.yearsOfService >= entry.readiness.minimumYearsOfService}
                  title="Time-In-Grade / Years of Service"
                />
                {entry.readiness.requirements.filter((requirement) => !/year/i.test(requirement.label)).map((requirement) => (
                  <ChecklistRow detail={`${requirement.label} (${requirement.met ? "Completed" : "Not yet completed"})`} key={requirement.label} met={requirement.met} title="Mandatory Training Course" />
                ))}
              </>
            ) : <p className="text-[11px] text-slate-500">The checklist appears after the first endorsement for this rank.</p>}
          </div>

          <div className="rounded-xl border border-slate-200">
            <button aria-expanded={rubricOpen} className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setRubricOpen((open) => !open)} type="button">
              Performance evaluation
              <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", rubricOpen && "rotate-180")} />
            </button>
            {rubricOpen ? (
              <div className="workspace border-t border-slate-200 p-4">
                <PerformanceEvaluation certifications={data.certifications} employeeId={employeeId} employmentStartedOn={data.employee.employment_started_on} ratings={data.ratings} />
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-2">
            <div className="space-y-1">
              <StaffLabel htmlFor="review-recommendation">Recommendation</StaffLabel>
              <StaffSelect id="review-recommendation" onChange={(event) => setRecommendation(event.target.value as typeof recommendation)} value={recommendation}>
                {RECOMMENDATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </StaffSelect>
            </div>
            <div className="space-y-1">
              <StaffLabel htmlFor="review-remarks">Remarks</StaffLabel>
              <StaffTextarea id="review-remarks" maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder="Enter promotion board endorsement remarks..." rows={3} value={notes} />
            </div>
          </div>
        </>
      )}
    </StaffModal>
  );
}
