"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useState } from "react";
import type { z } from "zod";

import { DepartmentRankFields } from "@/components/personnel-records/department-rank-fields";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDepartmentOptions, useRankOptions } from "@/hooks/use-administration";
import { useSaveJobOpening } from "@/hooks/use-recruitment";
import { PNP_JOB_CRITERIA, withSavedValue, type PnpJobCriterionKind } from "@/lib/pnp-catalogue";
import { jobOpeningSchema, type JobOpeningInput } from "@/schemas/recruitment";
import type { JobOpening, JobQualificationCriterion } from "@/lib/types/database";

type HrJobFormProps = {
  job?: JobOpening & { job_qualification_criteria?: JobQualificationCriterion[]; applications?: Array<{ count: number }> };
};

type JobFormValues = z.input<typeof jobOpeningSchema>;

function defaults(job?: HrJobFormProps["job"]): JobFormValues {
  const criteria = (job?.job_qualification_criteria ?? [])
    .map((criterion) => ({
      id: criterion.id,
      ordinal: criterion.ordinal,
      kind: criterion.kind,
      requirement: criterion.requirement,
      isRequired: criterion.is_required,
    }))
    .sort((left, right) => left.ordinal - right.ordinal);
  return {
    // No silent default: HR must choose an active department and rank.
    departmentId: job?.department_id ?? undefined,
    rankId: job?.rank_id ?? undefined,
    title: job?.title ?? "",
    description: job?.description ?? "",
    location: job?.location ?? "",
    closesOn: job?.closes_on ?? undefined,
    status: job?.status ?? "draft",
    criteria: criteria.length ? criteria : [{ ordinal: 1, kind: "experience", requirement: "", isRequired: true }],
  };
}

function toSelectValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value : "";
}

export function HrJobForm({ job }: HrJobFormProps) {
  const router = useRouter();
  const departments = useDepartmentOptions();
  const ranks = useRankOptions();
  const save = useSaveJobOpening();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const form = useForm<JobFormValues, unknown, JobOpeningInput>({
    resolver: zodResolver(jobOpeningSchema),
    defaultValues: defaults(job),
  });
  const criteria = useFieldArray({ control: form.control, name: "criteria" });
  const criteriaValues = useWatch({ control: form.control, name: "criteria" });
  const hasApplications = (job?.applications?.[0]?.count ?? 0) > 0;
  const optionsLoading = departments.isLoading || ranks.isLoading;
  const departmentValue = toSelectValue(useWatch({ control: form.control, name: "departmentId" }));
  const rankValue = toSelectValue(useWatch({ control: form.control, name: "rankId" }));
  const errors = form.formState.errors;

  function setDepartment(value: string) {
    form.setValue("departmentId", value ? Number(value) : undefined, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  }
  function setRank(value: string) {
    form.setValue("rankId", value ? Number(value) : undefined, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  }

  /** The save RPC only accepts an active department and an active rank. */
  function checkActiveSelection(values: JobFormValues) {
    let ok = true;
    const department = departments.data?.find((row) => row.id === Number(values.departmentId));
    const rank = ranks.data?.find((row) => row.id === Number(values.rankId));
    if (department && !department.is_active) {
      form.setError("departmentId", { message: "This department is inactive. Choose an active department." });
      ok = false;
    }
    if (rank && !rank.is_active) {
      form.setError("rankId", { message: "This rank is inactive. Choose an active rank." });
      ok = false;
    }
    return ok;
  }

  async function saveAs(status: JobOpeningInput["status"]) {
    setError(null);
    setSuccess(null);
    const valid = await form.trigger();
    if (!valid || !checkActiveSelection(form.getValues())) return;
    try {
      const input = jobOpeningSchema.parse({ ...form.getValues(), status, criteria: form.getValues("criteria").map((criterion, index) => ({ ...criterion, ordinal: index + 1 })) });
      await save.mutateAsync({ input, jobId: job?.id });
      if (status === "published") {
        router.replace("/hr/jobs");
        return;
      }
      setSuccess(hasApplications ? "Changes saved." : "Draft saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save this job opening.");
    }
  }

  const submitDisabled = save.isPending || optionsLoading;

  return (
    <form className="max-w-3xl space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); void saveAs(hasApplications && job ? job.status : "draft"); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <DepartmentRankFields
          departmentError={errors.departmentId ? (errors.departmentId.type === "custom" || errors.departmentId.type === undefined ? errors.departmentId.message : "Select a department.") : undefined}
          departmentId={departmentValue}
          idPrefix="job"
          onDepartmentChange={setDepartment}
          onRankChange={setRank}
          rankError={errors.rankId ? (errors.rankId.type === "custom" || errors.rankId.type === undefined ? errors.rankId.message : "Select a rank.") : undefined}
          rankId={rankValue}
          required
          savedDepartmentId={job?.department_id}
          savedRankId={job?.rank_id}
        />
        <FormField error={errors.title?.message} htmlFor="job-title" label="Title" required>
          <Input id="job-title" required {...form.register("title")} />
        </FormField>
        <FormField error={errors.location?.message} htmlFor="job-location" label="Location">
          <Input id="job-location" {...form.register("location")} />
        </FormField>
        <FormField error={errors.closesOn?.message} htmlFor="job-closes-on" label="Applications close">
          <Input id="job-closes-on" type="date" {...form.register("closesOn", { setValueAs: (value) => value || undefined })} />
        </FormField>
      </div>
      <FormField description="At least 20 characters." error={errors.description?.message} htmlFor="job-description" label="Description" required>
        <Textarea className="min-h-40" id="job-description" required rows={8} {...form.register("description")} />
      </FormField>
      <section aria-labelledby="job-criteria-heading" className="space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold" id="job-criteria-heading">Qualification criteria</h2>
          <Button onClick={() => criteria.append({ ordinal: criteria.fields.length + 1, kind: "other", requirement: "", isRequired: true })} size="sm" type="button" variant="outline">Add criterion</Button>
        </div>
        {typeof errors.criteria?.message === "string" ? <p className="text-sm font-medium text-destructive" role="alert">{errors.criteria.message}</p> : null}
        {criteria.fields.map((field, index) => {
          const kind = (criteriaValues?.[index]?.kind ?? field.kind) as PnpJobCriterionKind;
          // Keeps a saved requirement that is no longer in the catalogue selectable.
          const choices = withSavedValue(PNP_JOB_CRITERIA[kind] ?? [], criteriaValues?.[index]?.requirement);
          return (
            <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-[12rem_1fr_auto]" key={field.id}>
              <FormField htmlFor={`criterion-kind-${field.id}`} label={`Criterion ${index + 1} type`}>
                <NativeSelect
                  id={`criterion-kind-${field.id}`}
                  {...form.register(`criteria.${index}.kind`, {
                    // A requirement belongs to its type, so changing the type clears it.
                    onChange: () => form.setValue(`criteria.${index}.requirement`, "", { shouldValidate: form.formState.isSubmitted }),
                  })}
                >
                  <option value="education">Education</option>
                  <option value="eligibility">Eligibility</option>
                  <option value="experience">Experience</option>
                  <option value="skill">Skill</option>
                  <option value="certification">Certification / Training</option>
                  <option value="other">Other</option>
                </NativeSelect>
              </FormField>
              <FormField error={errors.criteria?.[index]?.requirement ? "Choose a qualification." : undefined} htmlFor={`criterion-${field.id}`} label={`Qualification ${index + 1}`}>
                <NativeSelect id={`criterion-${field.id}`} {...form.register(`criteria.${index}.requirement`)}>
                  <option value="">Select a qualification</option>
                  {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                </NativeSelect>
              </FormField>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input className="size-4" type="checkbox" {...form.register(`criteria.${index}.isRequired`)} /> Required
                </label>
                {criteria.fields.length > 1 ? (
                  <Button aria-label={`Remove qualification ${index + 1}`} onClick={() => criteria.remove(index)} size="sm" type="button" variant="ghost">Remove</Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>
      {error ? <ErrorState message={error} /> : null}
      {hasApplications ? <p className="rounded-lg border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">This opening has applications. Its status can only be changed by withdrawing it from the job list.</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={submitDisabled} type="submit" variant="outline">{save.isPending ? "Saving…" : optionsLoading ? "Loading options…" : hasApplications ? "Save changes" : "Save draft"}</Button>
        {!hasApplications ? <Button disabled={submitDisabled} onClick={() => void saveAs("published")} type="button">Publish opening</Button> : null}
        {success && !save.isPending ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{success}</p> : null}
      </div>
    </form>
  );
}
