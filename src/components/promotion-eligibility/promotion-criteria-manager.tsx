"use client";

import { useMemo, useState, type FormEvent } from "react";

import { DeleteRecordDialog } from "@/components/deletion/delete-record-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { useRankOptions } from "@/hooks/use-administration";
import { PNP_CERTIFICATION_GROUPS, PNP_CERTIFICATIONS } from "@/lib/pnp-catalogue";
import { rankLabel } from "@/lib/ranks";
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

function CriterionForm({ rankOptions, takenRankIds }: { rankOptions: { value: string; label: string; description?: string }[]; takenRankIds: Set<number> }) {
  const create = useCreatePromotionCriterion();
  const [rankId, setRankId] = useState<string | null>(null);
  const [rows, setRows] = useState<RequirementRow[]>([{ key: 0, name: "" }]);
  const [nextKey, setNextKey] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
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
    setErrors({});
    setRowErrors({});
    setNotice(null);
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
      setNotice("Promotion criteria saved.");
    } catch (cause) {
      setErrors({ form: cause instanceof Error ? cause.message : "Unable to save criteria." });
    }
  }

  return (
    <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2" noValidate onSubmit={submit}>
      <h2 className="text-xl font-bold tracking-tight sm:col-span-2">Add promotion criteria</h2>
      <FormField description="Each rank can have one set of criteria." error={errors.targetRankId} htmlFor="target-rank" label="Target rank" required>
        <Combobox
          emptyMessage="No rank without criteria matches that search."
          id="target-rank"
          onValueChange={setRankId}
          options={available}
          placeholder="Search ranks"
          value={rankId}
        />
      </FormField>
      <FormField error={errors.minimumYearsOfService} htmlFor="minimum-years" label="Years of service" required>
        <select className={nativeSelectClassName} defaultValue="1" id="minimum-years" name="minimumYearsOfService" required>
          {SERVICE_YEAR_CHOICES.map((years) => <option key={years} value={years}>{`${years} ${years === 1 ? "year" : "years"}`}</option>)}
        </select>
      </FormField>
      <fieldset aria-describedby={errors.requirements ? "requirements-error" : undefined} className="grid gap-4 rounded-lg border p-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">
          Requirements
          <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>
        </legend>
        <div className="space-y-3 sm:col-span-2">
          {rows.map((row, index) => (
            <div className="flex items-end gap-2" key={row.key}>
              <div className="min-w-0 flex-1">
                <FormField error={rowErrors[row.key] || undefined} htmlFor={`requirement-${row.key}`} label={rows.length > 1 ? `Certification / Training ${index + 1}` : "Certification / Training"} required>
                  <select
                    className={nativeSelectClassName}
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
                  </select>
                </FormField>
              </div>
              {rows.length > 1 ? (
                <Button aria-label={`Remove requirement ${index + 1}`} onClick={() => removeRow(row.key)} type="button" variant="outline">Remove</Button>
              ) : null}
            </div>
          ))}
          {errors.requirements ? <p className="text-sm font-medium text-destructive" id="requirements-error" role="alert">{errors.requirements}</p> : null}
          <Button disabled={!canAddRow} onClick={addRow} size="sm" type="button" variant="outline">Add another certification / training</Button>
        </div>
      </fieldset>
      {errors.form ? <div className="sm:col-span-2"><ErrorState message={errors.form} /></div> : null}
      <p aria-live="polite" className="text-sm font-medium text-emerald-700 sm:col-span-2 dark:text-emerald-400" role="status">{notice ?? ""}</p>
      <div className="sm:col-span-2">
        <Button disabled={create.isPending} type="submit">{create.isPending ? "Saving…" : "Save criteria"}</Button>
      </div>
    </form>
  );
}

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
        <h2 className="text-xl font-bold tracking-tight" id="existing-criteria">Existing criteria</h2>
        <p className="text-base text-muted-foreground">
          Deactivate criteria to stop using them for new evaluations. Criteria can only be deleted before any employee has been evaluated against them.
        </p>
        {actionError ? <ErrorState message={actionError} /> : null}
        <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
        {criteria.isLoading ? <LoadingState label="Loading promotion criteria…" /> : criteria.error ? <ErrorState message={criteria.error.message} /> : criteria.data?.length ? (
          <ul className="grid gap-3">
            {criteria.data.map((criterion) => {
              const title = rankTitles.get(criterion.target_rank_id) ?? `Rank #${criterion.target_rank_id}`;
              const requirements = (criterion.promotion_criteria_requirements ?? []) as PromotionCriterionRequirement[];
              return (
                <li className="rounded-xl border bg-card p-4" key={criterion.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
                        {title}
                        <Badge variant={criterion.is_active ? "secondary" : "outline"}>{criterion.is_active ? "Active" : "Inactive"}</Badge>
                        {criterion.minimum_years_of_service > 3 ? <Badge variant="destructive">Update to 1–3 years</Badge> : null}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        At least {criterion.minimum_years_of_service} {criterion.minimum_years_of_service === 1 ? "year" : "years"} of service
                      </p>
                      {requirements.length ? (
                        <ul className="list-disc space-y-0.5 pl-5 text-sm">
                          {requirements.toSorted((a, b) => a.ordinal - b.ordinal).map((requirement) => (
                            <li key={requirement.id}>{recordKindLabels[requirement.record_kind]}: {requirement.label}</li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-muted-foreground">No requirements.</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        aria-label={`${criterion.is_active ? "Deactivate" : "Activate"} criteria for ${title}`}
                        disabled={setActive.isPending}
                        onClick={() => void toggle(criterion.id, !criterion.is_active, title).catch(() => undefined)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {criterion.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button aria-label={`Delete criteria for ${title}`} onClick={() => setDeletingId(criterion.id)} size="sm" type="button" variant="destructive">Delete</Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-muted-foreground">No promotion criteria yet. Add the first set above.</p>
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
