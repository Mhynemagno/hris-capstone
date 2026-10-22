"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffLabel, StaffTextarea } from "@/components/staff-shell/ui/staff-fields";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { useDecidePromotion } from "@/hooks/use-promotion-eligibility";

export type PromotionDecisionTarget = { employeeId: string; employeeName: string; targetRankCode: string; approve: boolean };

/** Approve or reject a scored promotion. Rejection needs a reason; approval never changes the rank. */
export function PromotionDecisionDialog({ target, onClose, onDecided }: { target: PromotionDecisionTarget; onClose: () => void; onDecided?: () => void }) {
  const decide = useDecidePromotion();
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { approve } = target;

  async function submit() {
    if (decide.isPending) return;
    if (!approve && !remarks.trim()) { setError("Enter the reason for rejecting this promotion."); return; }
    setError(null);
    try {
      await decide.mutateAsync({ employeeId: target.employeeId, approve, remarks });
      notifyStaff({ title: approve ? "Promotion approved" : "Promotion rejected", description: `${target.employeeName} has been notified.` });
      onDecided?.();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record the decision.");
    }
  }

  return (
    <StaffModal
      footer={<>
        <button className={staffButton.secondary} onClick={onClose} type="button">Cancel</button>
        <button className={approve ? staffButton.success : staffButton.danger} disabled={decide.isPending} onClick={() => void submit()} type="button">
          {decide.isPending ? "Saving…" : approve ? "Approve promotion" : "Reject promotion"}
        </button>
      </>}
      icon={approve ? <CircleCheck aria-hidden="true" className="size-4" /> : <CircleX aria-hidden="true" className="size-4" />}
      iconClassName={approve ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}
      onClose={onClose}
      open
      size="md"
      subtitle={`${target.employeeName} → ${target.targetRankCode}`}
      title={approve ? "Approve promotion" : "Reject promotion"}
    >
      <p className="text-slate-600">
        {approve
          ? "Approval records the decision and notifies the employee. It does not change the rank automatically; update the rank in the personnel record."
          : "The employee is notified with your reason."}
      </p>
      <div>
        <StaffLabel htmlFor="promotion-decision-remarks" required={!approve}>{approve ? "Remarks (optional)" : "Reason for rejection"}</StaffLabel>
        <StaffTextarea aria-invalid={Boolean(error) || undefined} id="promotion-decision-remarks" maxLength={2000} onChange={(event) => setRemarks(event.target.value)} rows={3} value={remarks} />
      </div>
      {error ? <p className="font-semibold text-rose-700" role="alert">{error}</p> : null}
    </StaffModal>
  );
}
