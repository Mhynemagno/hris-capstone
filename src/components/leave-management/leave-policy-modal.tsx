"use client";

import { type FormEvent, useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffInput, StaffLabel, StaffTextarea } from "@/components/staff-shell/ui/staff-fields";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { useSetLeaveTypeAllotment, useUpdateLeaveType } from "@/hooks/use-leave-management";
import type { LeaveType } from "@/lib/types/database";
import { leaveTypeAllotmentSchema } from "@/schemas/leave-management";

const FORM_ID = "leave-policy-form";

/** "Update Policy: {type}" (Capstone UI leave.html policy modal). Name and description stay editable, as before. */
export function LeavePolicyModal({ type, onClose }: { type: LeaveType | null; onClose: () => void }) {
  const update = useUpdateLeaveType();
  const setAllotment = useSetLeaveTypeAllotment();
  const [error, setError] = useState<string | null>(null);
  const saving = update.isPending || setAllotment.isPending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type || saving) return;
    setError(null);
    const data = new FormData(event.currentTarget);
    const daysText = String(data.get("daysPerYear") ?? "").trim();
    const allotment = leaveTypeAllotmentSchema.safeParse({ id: type.id, daysPerYear: daysText ? Number(daysText) : null, excessDeductedFromRetirement: type.excess_deducted_from_retirement && Boolean(daysText) });
    if (!allotment.success) { setError(allotment.error.issues[0]?.message ?? "Enter valid days per year."); return; }
    try {
      await update.mutateAsync({ id: type.id, name: String(data.get("name") ?? type.name), description: String(data.get("description") ?? ""), requiresAttachment: type.requires_attachment, isActive: type.is_active });
      await setAllotment.mutateAsync(allotment.data);
      notifyStaff({ title: "Leave policy updated" });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the leave type.");
    }
  }

  return (
    <StaffModal
      footer={(
        <>
          <button className={staffButton.secondary} onClick={onClose} type="button">Cancel</button>
          <button className={staffButton.primary} disabled={saving} form={FORM_ID} type="submit">{saving ? "Saving…" : "Save Changes"}</button>
        </>
      )}
      onClose={onClose}
      open={type !== null}
      size="md"
      title={type ? `Update Policy: ${type.name}` : "Update Entitlement Policy"}
    >
      {type ? (
        <form className="space-y-3 font-semibold text-slate-700" id={FORM_ID} key={type.id} noValidate onSubmit={submit}>
          <div className="space-y-1">
            <StaffLabel htmlFor="policy-days" required>Allowed Days Per Year</StaffLabel>
            <StaffInput className="font-mono font-bold" defaultValue={type.days_per_year ?? ""} id="policy-days" max={366} min={1} name="daysPerYear" type="number" />
            <p className="text-[10px] font-normal text-slate-500">Leave blank for no yearly limit.</p>
          </div>
          <div className="space-y-1">
            <StaffLabel htmlFor="policy-name" required>Name</StaffLabel>
            <StaffInput defaultValue={type.name} id="policy-name" maxLength={120} name="name" />
          </div>
          <div className="space-y-1">
            <StaffLabel htmlFor="policy-description">Description</StaffLabel>
            <StaffTextarea defaultValue={type.description ?? ""} id="policy-description" maxLength={500} name="description" rows={2} />
          </div>
          {error ? <p className="text-[10px] font-bold text-rose-500" role="alert">{error}</p> : null}
        </form>
      ) : null}
    </StaffModal>
  );
}
