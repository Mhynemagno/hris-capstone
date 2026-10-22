"use client";

import { ClipboardCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffInput, StaffLabel, StaffSelect } from "@/components/staff-shell/ui/staff-fields";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { usePromotionEmployees, useRecordIperRating, useRecordPftResult } from "@/hooks/use-promotion-eligibility";
import { IPER_RATINGS, iperEntrySchema, pftEntrySchema } from "@/schemas/promotion-eligibility";

function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

/** Last day of a 6-month rating period that starts on `start` (YYYY-MM-DD). */
export function sixMonthPeriodEnd(start: string) {
  const date = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() + 6);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** HR records the supervisor's IPER (adjectival, every 6 months) and/or a PFT result for one employee. */
export function RecordIperPftDialog({ onClose, initialEmployeeId = null }: { onClose: () => void; initialEmployeeId?: string | null }) {
  const employees = usePromotionEmployees();
  const recordIper = useRecordIperRating();
  const recordPft = useRecordPftResult();
  const [employeeId, setEmployeeId] = useState<string | null>(initialEmployeeId);
  const [periodStartsOn, setPeriodStartsOn] = useState("");
  const [periodEndsOn, setPeriodEndsOn] = useState("");
  const [rating, setRating] = useState("");
  const [pftResult, setPftResult] = useState("");
  const [assessedOn, setAssessedOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = recordIper.isPending || recordPft.isPending;
  const today = manilaToday();

  const options = useMemo<ComboboxOption[]>(
    () => (employees.data ?? []).map((employee) => ({ value: employee.id, label: `${employee.last_name}, ${employee.first_name}`, description: employee.employee_number })),
    [employees.data],
  );

  async function submit() {
    if (pending) return;
    setError(null);
    const wantsIper = Boolean(rating || periodStartsOn || periodEndsOn);
    const wantsPft = Boolean(pftResult || assessedOn);
    if (!employeeId) { setError("Choose an employee."); return; }
    if (!wantsIper && !wantsPft) { setError("Enter an IPER rating, a PFT result, or both."); return; }
    const iper = wantsIper ? iperEntrySchema.safeParse({ employeeId, periodStartsOn, periodEndsOn, rating }) : null;
    if (iper && !iper.success) {
      const issue = iper.error.issues[0];
      setError(issue?.code === "custom" ? issue.message : "Enter the IPER rating period and choose the adjectival rating.");
      return;
    }
    const pft = wantsPft ? pftEntrySchema.safeParse({ employeeId, assessedOn, passed: pftResult === "passed" ? true : pftResult === "failed" ? false : undefined }) : null;
    if (pft && !pft.success) { setError("Enter the PFT date and choose Passed or Failed."); return; }
    try {
      if (iper?.success) await recordIper.mutateAsync(iper.data);
      if (pft?.success) await recordPft.mutateAsync(pft.data);
      notifyStaff({ title: iper && pft ? "IPER and PFT recorded" : iper ? "IPER recorded" : "PFT result recorded" });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the record.");
    }
  }

  return (
    <StaffModal
      footer={<>
        <button className={staffButton.secondary} onClick={onClose} type="button">Cancel</button>
        <button className={staffButton.primary} disabled={pending} onClick={() => void submit()} type="button">{pending ? "Saving…" : "Save"}</button>
      </>}
      icon={<ClipboardCheck aria-hidden="true" className="size-4" />}
      iconClassName="bg-blue-900 text-amber-400 shadow-sm"
      onClose={onClose}
      open
      size="lg"
      subtitle="The supervisor's Individual Performance Evaluation Rating (every 6 months) and the Physical Fitness Test result."
      title="Record IPER / PFT"
    >
      <div>
        <StaffLabel htmlFor="iper-pft-employee" required>Employee</StaffLabel>
        <Combobox
          emptyMessage="No active personnel match that name or badge number."
          id="iper-pft-employee"
          onValueChange={setEmployeeId}
          options={options}
          placeholder={employees.isLoading ? "Loading personnel…" : "Type a name or badge number"}
          value={employeeId}
        />
      </div>

      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-[11px] font-bold tracking-wide text-slate-600 uppercase">IPER (supervisor&apos;s rating)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <StaffLabel htmlFor="iper-period-start">Rating period start</StaffLabel>
            <StaffInput id="iper-period-start" max={today} onChange={(event) => { setPeriodStartsOn(event.target.value); if (!periodEndsOn && event.target.value) setPeriodEndsOn(sixMonthPeriodEnd(event.target.value)); }} type="date" value={periodStartsOn} />
          </div>
          <div>
            <StaffLabel htmlFor="iper-period-end">Rating period end</StaffLabel>
            <StaffInput id="iper-period-end" min={periodStartsOn || undefined} onChange={(event) => setPeriodEndsOn(event.target.value)} type="date" value={periodEndsOn} />
          </div>
        </div>
        <div>
          <StaffLabel htmlFor="iper-rating">Adjectival rating</StaffLabel>
          <StaffSelect id="iper-rating" onChange={(event) => setRating(event.target.value)} value={rating}>
            <option value="">Choose a rating</option>
            {IPER_RATINGS.map((option) => <option key={option} value={option}>{option}</option>)}
          </StaffSelect>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-[11px] font-bold tracking-wide text-slate-600 uppercase">PFT (Physical Fitness Test)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <StaffLabel htmlFor="pft-date">Date taken</StaffLabel>
            <StaffInput id="pft-date" max={today} onChange={(event) => setAssessedOn(event.target.value)} type="date" value={assessedOn} />
          </div>
          <div>
            <StaffLabel htmlFor="pft-result">Result</StaffLabel>
            <StaffSelect id="pft-result" onChange={(event) => setPftResult(event.target.value)} value={pftResult}>
              <option value="">Choose a result</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
            </StaffSelect>
          </div>
        </div>
      </fieldset>

      {error ? <p className="font-semibold text-rose-700" role="alert">{error}</p> : null}
    </StaffModal>
  );
}
