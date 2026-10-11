"use client";

import { Award } from "lucide-react";
import { useState, type FormEvent } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffLabel, StaffTextarea } from "@/components/staff-shell/ui/staff-fields";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { useSubmitEmployeePromotionDocket } from "@/hooks/use-promotion-eligibility";
import { promotionDocketSchema } from "@/schemas/promotion-eligibility";

/** "Submit Promotion Docket" (Capstone UI empromote.html): remarks plus the rank-matched criterion, sent only through the docket mutation. */
export function EmployeePromotionDocketModal({ criterionId, targetRankName, open, onOpenChange }: { criterionId: string; targetRankName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const submit = useSubmitEmployeePromotionDocket();
  const [remarks, setRemarks] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setError(null); setFieldError(null); onOpenChange(false); };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!remarks.trim()) { setFieldError("Enter your remarks before submitting."); return; }
    const parsed = promotionDocketSchema.safeParse({ criterionId, remarks });
    if (!parsed.success) { setFieldError(parsed.error.issues[0]?.message ?? "Check your remarks."); return; }
    setFieldError(null);
    try {
      await submit.mutateAsync(parsed.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The docket could not be submitted. Try again.");
      return;
    }
    notifyStaff({ title: "Promotion docket submitted", description: `Your docket for ${targetRankName} is with the Promotion Board and HR.` });
    setRemarks("");
    onOpenChange(false);
  }

  return (
    <StaffModal dark icon={<Award aria-hidden="true" className="size-3.5" />} iconClassName="bg-blue-700 text-amber-300" onClose={close} open={open} subtitle="San Juan CPS Promotion Board" title="Submit Promotion Docket">
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900">
          <p className="font-bold">Eligibility Verified</p>
          <p className="text-blue-700">You are applying for promotion to <span className="font-bold">{targetRankName}</span>. Your 201 File records will automatically attach to this docket. This is a request for review, not an automatic promotion.</p>
        </div>
        <div>
          <StaffLabel htmlFor="docket-remarks" required>Applicant Remarks / Personal Statement</StaffLabel>
          <StaffTextarea aria-describedby={fieldError ? "docket-remarks-error" : undefined} aria-invalid={fieldError ? true : undefined} className="resize-none" id="docket-remarks" maxLength={2000} onChange={(event) => setRemarks(event.target.value)} placeholder="State your endorsement request or additional career achievements..." rows={3} value={remarks} />
          {fieldError ? <p className="mt-1 text-[11px] font-medium text-rose-700" id="docket-remarks-error">{fieldError}</p> : null}
        </div>
        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800" role="alert">{error}</p> : null}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
          <button className={staffButton.secondary} onClick={close} type="button">Cancel</button>
          <button className={staffButton.primary} disabled={submit.isPending} type="submit">{submit.isPending ? "Submitting…" : "Submit Application"}</button>
        </div>
      </form>
    </StaffModal>
  );
}
