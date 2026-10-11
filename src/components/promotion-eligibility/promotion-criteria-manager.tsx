"use client";

import { CirclePlus, Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { DeleteRecordDialog } from "@/components/deletion/delete-record-dialog";
import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffLabel, StaffSelect } from "@/components/staff-shell/ui/staff-fields";
import { Combobox } from "@/components/ui/combobox";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useRankOptions } from "@/hooks/use-administration";
import { PNP_CERTIFICATION_GROUPS, PNP_CERTIFICATIONS } from "@/lib/pnp-catalogue";
import { rankLabel } from "@/lib/ranks";
import { cn } from "@/lib/utils";
import { useCreatePromotionCriterion, usePromotionCriteria, useSetPromotionCriterionActive } from "@/hooks/use-promotion-eligibility";
import type { PromotionCriterionRequirement } from "@/lib/types/database";
import { promotionCriterionSchema } from "@/schemas/promotion-eligibility";

const recordKindLabels = { certification: "Certification / Training", qualification: "Eligibility", training: "Training" } as const;

/**
 * Promotion requirements are the Certification / Training courses HR records on personnel files,
 * so an employee meets one when the same course is on their Certification / Training list.
 */
const REQUIREMENT_RECORD_KIND = "certification" as const;
const MAX_REQUIREMENTS = 30;
const SERVICE_YEAR_CHOICES = [1, 2, 3] as const;

type RequirementRow = { key: number; name: string };
type FieldErrors = Partial<Record<"targetRankId" | "minimumYearsOfService" | "requirements" | "form", string>>;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-[10px] font-bold text-rose-500" role="alert">{message}</p> : null;
}

/** Capstone UI promotions.html "Add Promotion Criteria" card. */
function CriterionForm({ rankOptions, takenRankIds }: { rankOptions: { value: string; label: string; description?: string }[]; takenRankIds: Set<number> }) {
  const create = useCreatePromotionCriterion();
  const [rankId, setRankId] = useState<string | null>(null);
  const [rows, setRows] = useState<RequirementRow[]>([{ key: 0, name: "" }]);
  const [nextKey, setNextKey] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const available = rankOptions.filter((option) => !takenRankIds.has(Number(option.value)));
  const chosenNames = new Set(rows.map((row) => row.name).filter(Boolean));
  const canAddRow = rows.length < MAX_REQUIREMENTS && rows.length < PNP_CERTIFICATIONS.length;

  function updateRow(key: number, name: string) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, name } : row));
    setRowErrors((current) => ({ ...current, [key]: "" }));
    setErrors((current) => ({ ...current, requirements: undefined }));
  }

  function addRow() {
    setRows((current) => [...current, { key: nextKey, name: "" }]);
    setNextKey((key) => key + 1);
  }

  function removeRow(key: number) {
    setRows((current) => current.length > 1 ? current.filter((row) => row.key !== key) : current);
    setRowErrors((current) => ({ ...current, [key]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    setErrors({});
    setRowErrors({});
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const parsed = promotionCriterionSchema.safeParse({
      targetRankId: rankId ?? "",
      minimumYearsOfService: form.minimumYearsOfService,
      requirements: rows.map((row) => ({ recordKind: REQUIREMENT_RECORD_KIND, requiredName: row.name, label: row.name, isMandatory: true })),
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      const nextRows: Record<number, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        const row = key === "requirements" && typeof issue.path[1] === "number" ? rows[issue.path[1]] : undefined;
        if (row) {
          nextRows[row.key] ??= "Choose a certification / training.";
          continue;
        }
        next[key as keyof FieldErrors] ??= key === "targetRankId" ? "Choose the rank these criteria apply to." : issue.message;
      }
      setErrors(next);
      setRowErrors(nextRows);
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      formElement.reset();
      setRankId(null);
      setRows([{ key: nextKey, name: "" }]);
      setNextKey((key) => key + 1);
      notifyStaff({ title: "Promotion criteria saved" });
    } catch (cause) {
      setErrors({ form: cause instanceof Error ? cause.message : "Unable to save criteria." });
    }
  }

  return (
    <form className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" noValidate onSubmit={submit}>
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CirclePlus aria-hidden="true" className="size-4 text-blue-700" /> Add Promotion Criteria</h3>
      <div className="space-y-1">
        <StaffLabel htmlFor="target-rank" required>Target Rank</StaffLabel>
        <Combobox
          aria-label="Target Rank"
          className="rounded-xl border-slate-200 bg-slate-50"
          inputClassName="text-xs font-medium text-slate-900 placeholder:text-slate-400"
          emptyMessage="No rank without criteria matches that search."
          id="target-rank"
          onValueChange={setRankId}
          options={available}
          placeholder="Search ranks"
          value={rankId}
        />
        <p className="text-[10px] font-normal text-slate-500">Each rank can have one set of criteria.</p>
        <FieldError message={errors.targetRankId} />
      </div>
      <div className="space-y-1">
        <StaffLabel htmlFor="minimum-years" required>Years of Service</StaffLabel>
        <StaffSelect defaultValue="1" id="minimum-years" name="minimumYearsOfService" required>
          {SERVICE_YEAR_CHOICES.map((years) => <option key={years} value={years}>{`${years} ${years === 1 ? "year" : "years"}`}</option>)}
        </StaffSelect>
        <FieldError message={errors.minimumYearsOfService} />
      </div>
      <fieldset aria-describedby={errors.requirements ? "requirements-error" : undefined} className="space-y-3 border-t border-slate-200 pt-3">
        <legend className="text-xs font-semibold text-slate-700">
          Certification / Training Requirements
          <span aria-hidden="true" className="ml-0.5 text-rose-500">*</span>
        </legend>
        {rows.map((row, index) => (
          <div className="flex items-end gap-2" key={row.key}>
            <div className="min-w-0 flex-1 space-y-1">
              <label className="sr-only" htmlFor={`requirement-${row.key}`}>{rows.length > 1 ? `Certification / Training ${index + 1}` : "Certification / Training"}</label>
              <StaffSelect
                id={`requirement-${row.key}`}
                name="requiredName"
                onChange={(event) => updateRow(row.key, event.target.value)}
                required
                value={row.name}
              >
                <option value="">Choose a certification / training</option>
                {row.name && !(PNP_CERTIFICATIONS as readonly string[]).includes(row.name) ? <option value={row.name}>{row.name}</option> : null}
                {PNP_CERTIFICATION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.choices.filter((name) => name === row.name || !chosenNames.has(name)).map((name) => <option key={name} value={name}>{name}</option>)}
                  </optgroup>
                ))}
              </StaffSelect>
              <FieldError message={rowErrors[row.key] || undefined} />
            </div>
            {rows.length > 1 ? (
              <button aria-label={`Remove requirement ${index + 1}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100" onClick={() => removeRow(row.key)} type="button">Remove</button>
            ) : null}
          </div>
        ))}
        {errors.requirements ? <p className="text-[10px] font-bold text-rose-500" id="requirements-error" role="alert">{errors.requirements}</p> : null}
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60" disabled={!canAddRow} onClick={addRow} type="button">
          <Plus aria-hidden="true" className="size-2.5" /> Add another certification / training
        </button>
      </fieldset>
      {errors.form ? <ErrorState message={errors.form} /> : null}
      <button className={cn(staffButton.primary, "w-full")} disabled={create.isPending} type="submit">{create.isPending ? "Saving…" : "Save Criteria"}</button>
    </form>
  );
}

/** Capstone UI promotions.html criteria drawer body: add criteria, then the existing policies. */
export function PromotionCriteriaManager() {
  const criteria = usePromotionCriteria();
  const ranks = useRankOptions();
  const setActive = useSetPromotionCriterionActive();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rankTitles = useMemo(() => new Map((ranks.data ?? []).map((rank) => [rank.id, rankLabel(rank)])), [ranks.data]);
  const rankOptions = useMemo(
    () => (ranks.data ?? []).filter((rank) => rank.is_active).map((rank) => ({ value: String(rank.id), label: rankLabel(rank) })),
    [ranks.data],
  );
  const takenRankIds = useMemo(() => new Set((criteria.data ?? []).map((criterion) => criterion.target_rank_id)), [criteria.data]);
  const deletingCriterion = criteria.data?.find((criterion) => criterion.id === deletingId);

  async function toggle(id: string, isActive: boolean, title: string) {
    setActionError(null);
    setNotice(null);
    try {
      await setActive.mutateAsync({ id, isActive });
      setNotice(`Criteria for ${title} ${isActive ? "reactivated" : "deactivated"}.`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update the criteria.");
      throw cause;
    }
  }

  return (
    <div className="space-y-6">
      <CriterionForm rankOptions={rankOptions} takenRankIds={takenRankIds} />

      <section aria-labelledby="existing-criteria" className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900" id="existing-criteria">Existing Criteria Policies</h3>
        <p className="text-[11px] font-normal text-slate-500">Deactivate criteria to stop using them for new evaluations.</p>
        {actionError ? <ErrorState message={actionError} /> : null}
        <p aria-live="polite" className="text-[11px] font-medium text-emerald-700" role="status">{notice ?? ""}</p>
        {criteria.isLoading ? <LoadingState label="Loading promotion criteria…" /> : criteria.error ? <ErrorState message={criteria.error.message} /> : criteria.data?.length ? (
          <ul className="space-y-3">
            {criteria.data.map((criterion) => {
              const title = rankTitles.get(criterion.target_rank_id) ?? `Rank #${criterion.target_rank_id}`;
              const requirements = (criterion.promotion_criteria_requirements ?? []) as PromotionCriterionRequirement[];
              return (
                <li className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={criterion.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                      {title}
                      <span className={cn("rounded px-1.5 text-[10px] font-bold", criterion.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{criterion.is_active ? "Active" : "Inactive"}</span>
                      {criterion.minimum_years_of_service > 3 ? <span className="rounded bg-rose-50 px-1.5 text-[10px] font-bold text-rose-700">Update to 1–3 years</span> : null}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        aria-label={`${criterion.is_active ? "Deactivate" : "Activate"} criteria for ${title}`}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        disabled={setActive.isPending}
                        onClick={() => void toggle(criterion.id, !criterion.is_active, title).catch(() => undefined)}
                        type="button"
                      >
                        {criterion.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button aria-label={`Delete criteria for ${title}`} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100" onClick={() => setDeletingId(criterion.id)} type="button">Delete</button>
                    </div>
                  </div>
                  <p className="text-[11px] font-normal text-slate-600">
                    At least {criterion.minimum_years_of_service} {criterion.minimum_years_of_service === 1 ? "year" : "years"} of service
                  </p>
                  {requirements.length ? (
                    <ul className="list-disc space-y-0.5 pl-5 text-[11px] font-normal text-slate-600">
                      {requirements.toSorted((a, b) => a.ordinal - b.ordinal).map((requirement) => (
                        <li key={requirement.id}>{recordKindLabels[requirement.record_kind]}: {requirement.label}</li>
                      ))}
                    </ul>
                  ) : <p className="text-[11px] text-slate-500">No requirements.</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-xs text-slate-500">No promotion criteria yet. Add the first set above.</p>
        )}
      </section>

      <DeleteRecordDialog
        alternative={deletingCriterion?.is_active ? {
          label: "Deactivate instead",
          onSelect: () => toggle(deletingCriterion.id, false, rankTitles.get(deletingCriterion.target_rank_id) ?? "this rank"),
        } : undefined}
        entityId={deletingId}
        entityType="promotion_criterion"
        noun="promotion criteria"
        onClose={() => setDeletingId(null)}
        onDeleted={() => setNotice("The promotion criteria were deleted successfully.")}
      />
    </div>
  );
}
