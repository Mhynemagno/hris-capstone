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
import { PNP_CREDENTIALS_BY_KIND, SERVICE_YEAR_CHOICES } from "@/lib/pnp-catalogue";
import { rankLabel } from "@/lib/ranks";
import { useCreatePromotionCriterion, usePromotionCriteria, useSetPromotionCriterionActive } from "@/hooks/use-promotion-eligibility";
import type { PromotionCriterionRequirement } from "@/lib/types/database";
import { promotionCriterionSchema } from "@/schemas/promotion-eligibility";

export const PERFORMANCE_RATING_OPTIONS = [
  { value: 1, label: "1 – Poor" },
  { value: 2, label: "2 – Needs improvement" },
  { value: 3, label: "3 – Satisfactory" },
  { value: 4, label: "4 – Very satisfactory" },
  { value: 5, label: "5 – Outstanding" },
] as const;

const recordKindLabels = { certification: "Certification", qualification: "Qualification", training: "Training" } as const;

type FieldErrors = Partial<Record<"targetRankId" | "minimumYearsOfService" | "minimumPerformanceRating" | "requiredName" | "form", string>>;

function CriterionForm({ rankOptions, takenRankIds }: { rankOptions: { value: string; label: string; description?: string }[]; takenRankIds: Set<number> }) {
  const create = useCreatePromotionCriterion();
  const [rankId, setRankId] = useState<string | null>(null);
  const [recordKind, setRecordKind] = useState<keyof typeof PNP_CREDENTIALS_BY_KIND>("training");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const available = rankOptions.filter((option) => !takenRankIds.has(Number(option.value)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setNotice(null);
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const requiredName = String(form.requiredName ?? "").trim();
    const parsed = promotionCriterionSchema.safeParse({
      targetRankId: rankId ?? "",
      minimumYearsOfService: form.minimumYearsOfService,
      minimumPerformanceRating: form.minimumPerformanceRating,
      requirements: requiredName
        ? [{ recordKind, requiredName, label: requiredName, isMandatory: true }]
        : [],
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        const field = key === "requirements" ? "requiredName" : (key as keyof FieldErrors);
        next[field] ??= key === "targetRankId" ? "Choose the rank these criteria apply to." : issue.message;
      }
      setErrors(next);
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      formElement.reset();
      setRankId(null);
      setRecordKind("training");
      setNotice("Promotion criteria saved.");
    } catch (cause) {
      setErrors({ form: cause instanceof Error ? cause.message : "Unable to save criteria." });
    }
  }

  return (
    <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2" noValidate onSubmit={submit}>
      <h2 className="font-heading text-xl font-semibold sm:col-span-2">Add promotion criteria</h2>
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
      <FormField error={errors.minimumYearsOfService} htmlFor="minimum-years" label="Minimum years of service" required>
        <select className={nativeSelectClassName} defaultValue="0" id="minimum-years" name="minimumYearsOfService" required>
          {SERVICE_YEAR_CHOICES.map((years) => <option key={years} value={years}>{years === 0 ? "No minimum" : `${years} ${years === 1 ? "year" : "years"}`}</option>)}
        </select>
      </FormField>
      <FormField description="Leave as “No minimum” if ratings are not required." error={errors.minimumPerformanceRating} htmlFor="minimum-rating" label="Minimum performance rating">
        <select className={nativeSelectClassName} defaultValue="" id="minimum-rating" name="minimumPerformanceRating">
          <option value="">No minimum</option>
          {PERFORMANCE_RATING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>
      <fieldset className="grid gap-4 rounded-lg border p-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Required credential (optional)</legend>
        <FormField htmlFor="record-kind" label="Record type">
          <select
            className={nativeSelectClassName}
            id="record-kind"
            name="recordKind"
            onChange={(event) => setRecordKind(event.target.value as keyof typeof PNP_CREDENTIALS_BY_KIND)}
            value={recordKind}
          >
            <option value="certification">Certification</option>
            <option value="qualification">Qualification</option>
            <option value="training">Training</option>
          </select>
        </FormField>
        <FormField description="Employees meet this when the same record is on their file." error={errors.requiredName} htmlFor="required-name" label="Required record name">
          <select className={nativeSelectClassName} defaultValue="" id="required-name" key={recordKind} name="requiredName">
            <option value="">No required credential</option>
            {PNP_CREDENTIALS_BY_KIND[recordKind].map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </FormField>
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
        <h2 className="font-heading text-xl font-semibold" id="existing-criteria">Existing criteria</h2>
        <p className="text-sm text-muted-foreground">
          Deactivate criteria to stop using them for new evaluations. Criteria can only be deleted before any employee has been evaluated against them.
        </p>
        {actionError ? <ErrorState message={actionError} /> : null}
        <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
        {criteria.isLoading ? <LoadingState label="Loading promotion criteria…" /> : criteria.error ? <ErrorState message={criteria.error.message} /> : criteria.data?.length ? (
          <ul className="grid gap-3">
            {criteria.data.map((criterion) => {
              const title = rankTitles.get(criterion.target_rank_id) ?? `Rank #${criterion.target_rank_id}`;
              const requirements = (criterion.promotion_criteria_requirements ?? []) as PromotionCriterionRequirement[];
              const rating = PERFORMANCE_RATING_OPTIONS.find((option) => option.value === criterion.minimum_performance_rating);
              return (
                <li className="rounded-xl border bg-card p-4" key={criterion.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                        {title}
                        <Badge variant={criterion.is_active ? "secondary" : "outline"}>{criterion.is_active ? "Active" : "Inactive"}</Badge>
                      </p>
                      <p className="text-muted-foreground">
                        At least {criterion.minimum_years_of_service} {criterion.minimum_years_of_service === 1 ? "year" : "years"} of service
                        {rating ? ` · minimum rating ${rating.label}` : " · no rating minimum"}
                      </p>
                      {requirements.length ? (
                        <ul className="list-disc pl-5 text-sm">
                          {requirements.toSorted((a, b) => a.ordinal - b.ordinal).map((requirement) => (
                            <li key={requirement.id}>{recordKindLabels[requirement.record_kind]}: {requirement.label}</li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-muted-foreground">No required credentials.</p>}
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
        onDeleted={() => setNotice("The promotion criteria were permanently deleted.")}
      />
    </div>
  );
}
