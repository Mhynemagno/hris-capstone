"use client";

import { Award } from "lucide-react";

import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePromotionEvaluation } from "@/hooks/use-promotion-eligibility";
import { formatDateTime } from "@/lib/format-date";
import { PROMOTION_STATUS } from "@/lib/staff/status-maps";
import type { PromotionEvaluationResult } from "@/lib/types/database";

import { PromotionChecklist } from "./promotion-checklist";
import type { PromotionDecisionTarget } from "./promotion-decision-dialog";

const NO_TARGET: Record<NonNullable<PromotionEvaluationResult["reason"]>, string> = {
  no_rank: "No rank is recorded for this employee, so there is no next rank to evaluate.",
  non_uniformed: "Non-Uniformed Personnel (NUP) are not on the uniformed promotion ladder.",
  below_scored_rank: "This rank is not covered by the official promotion scorecards (PCPL to PLTCOL).",
  top_rank: "This employee already holds the highest rank on the promotion ladder.",
  inactive: "Only active personnel are evaluated for promotion.",
};

/** HR details view: the system checklist for the next rank, the decision, and Approve / Reject. */
export function PromotionDetailsModal({ employeeId, onClose, onDecide }: { employeeId: string; onClose: () => void; onDecide: (target: PromotionDecisionTarget) => void }) {
  const query = usePromotionEvaluation(employeeId);
  const detail = query.data;
  const evaluation = detail?.evaluation;
  const decision = detail?.decision ?? null;
  const target = evaluation?.targetRank ?? null;
  const status = decision ? decision.status : evaluation?.isQualified ? "for_approval" : null;
  const canDecide = Boolean(evaluation && target && !decision);

  const decide = (approve: boolean) => {
    if (!evaluation || !target) return;
    onDecide({ employeeId, employeeName: evaluation.employeeName, targetRankCode: target.code, approve });
  };

  return (
    <StaffModal
      footer={<>
        <button className={staffButton.secondary} onClick={onClose} type="button">Close</button>
        {canDecide ? <button className={staffButton.danger} onClick={() => decide(false)} type="button">Reject</button> : null}
        {canDecide ? <button className={staffButton.success} disabled={!evaluation?.isQualified} onClick={() => decide(true)} title={evaluation?.isQualified ? undefined : "Every requirement must be met before approval."} type="button">Approve</button> : null}
      </>}
      icon={<Award aria-hidden="true" className="size-4" />}
      iconClassName="bg-blue-900 text-amber-400 shadow-sm"
      onClose={onClose}
      open
      size="2xl"
      subtitle={target ? `Requirements for promotion to ${target.code} — ${target.name}` : "Promotion requirements"}
      title="Promotion evaluation"
    >
      {query.isLoading ? <LoadingState label="Loading promotion evaluation…" /> : query.error ? <ErrorState message={query.error.message} onRetry={() => void query.refetch()} /> : !evaluation ? (
        <p className="font-semibold text-slate-600">This employee could not be found.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
            <div>
              <p className="text-sm font-bold text-slate-900">{evaluation.employeeName}</p>
              <p className="font-mono text-[10px] text-slate-500">
                {`Badge ${evaluation.employeeNumber} • ${evaluation.currentRank ? evaluation.currentRank.code : "No rank"}${target ? ` → ${target.code}` : ""}`}
              </p>
            </div>
            {status ? <StatusPill tone={PROMOTION_STATUS[status].tone}>{PROMOTION_STATUS[status].label}</StatusPill> : target ? <StatusPill tone="slate">Requirements pending</StatusPill> : null}
          </div>

          {!target ? <p className="text-slate-600">{NO_TARGET[evaluation.reason ?? "no_rank"]}</p> : (
            <section aria-labelledby="promotion-checklist-heading" className="space-y-2.5">
              <h3 className="text-[10px] font-bold tracking-wider text-slate-500 uppercase" id="promotion-checklist-heading">Requirements checklist (evaluated by the system)</h3>
              <PromotionChecklist evaluation={evaluation} />
            </section>
          )}

          {decision ? (
            <section aria-label="HR decision" className="rounded-xl border border-slate-200 p-3.5">
              <p className="font-bold text-slate-900">{decision.status === "approved" ? "Approved" : "Rejected"} on {formatDateTime(decision.decidedAt)}</p>
              {decision.remarks ? <p className="mt-1 text-slate-600">Remarks: {decision.remarks}</p> : null}
              {decision.status === "approved" ? <p className="mt-1 text-[11px] text-slate-500">Approval does not change the rank automatically. Update the rank in the personnel record.</p> : null}
            </section>
          ) : null}
        </>
      )}
    </StaffModal>
  );
}
