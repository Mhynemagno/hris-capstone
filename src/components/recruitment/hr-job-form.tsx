"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import type { z } from "zod";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useDepartments, usePositions } from "@/hooks/use-administration";
import { useSaveJobOpening } from "@/hooks/use-recruitment";
import { jobOpeningSchema, type JobOpeningInput } from "@/schemas/recruitment";
import type { JobOpening, JobQualificationCriterion } from "@/lib/types/database";

type HrJobFormProps = {
  job?: JobOpening & { job_qualification_criteria?: JobQualificationCriterion[]; applications?: Array<{ count: number }> };
};

function defaults(job?: HrJobFormProps["job"]): JobOpeningInput {
  return {
    departmentId: job?.department_id ?? 1,
    positionId: job?.position_id ?? 1,
    title: job?.title ?? "",
    description: job?.description ?? "",
    location: job?.location ?? "",
    closesOn: job?.closes_on ?? undefined,
    status: job?.status ?? "draft",
    criteria: (job?.job_qualification_criteria ?? []).map((criterion) => ({
      id: criterion.id,
      ordinal: criterion.ordinal,
      kind: criterion.kind,
      requirement: criterion.requirement,
      isRequired: criterion.is_required,
    })).sort((left, right) => left.ordinal - right.ordinal) || [],
  };
}

export function HrJobForm({ job }: HrJobFormProps) {
  const departments = useDepartments({ pageSize: 20 });
  const positions = usePositions({ pageSize: 20 });
  const save = useSaveJobOpening();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof jobOpeningSchema>, unknown, JobOpeningInput>({
    resolver: zodResolver(jobOpeningSchema),
    defaultValues: { ...defaults(job), criteria: defaults(job).criteria.length ? defaults(job).criteria : [{ ordinal: 1, kind: "experience", requirement: "", isRequired: true }] },
  });
  const criteria = useFieldArray({ control: form.control, name: "criteria" });
  const departmentRows = departments.data?.rows ?? [];
  const positionRows = positions.data?.rows ?? [];
  const defaultDepartmentId = departments.data?.rows?.[0]?.id;
  const defaultPositionId = positions.data?.rows?.[0]?.id;
  const hasApplications = (job?.applications?.[0]?.count ?? 0) > 0;
  useEffect(() => {
    if (job) return;
    if (defaultDepartmentId) form.setValue("departmentId", defaultDepartmentId);
    if (defaultPositionId) form.setValue("positionId", defaultPositionId);
  }, [defaultDepartmentId, defaultPositionId, form, job]);

  async function saveAs(status: JobOpeningInput["status"]) {
    setError(null);
    const valid = await form.trigger();
    if (!valid) return;
    try {
      const input = jobOpeningSchema.parse({ ...form.getValues(), status, criteria: form.getValues("criteria").map((criterion, index) => ({ ...criterion, ordinal: index + 1 })) });
      await save.mutateAsync({ input, jobId: job?.id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save this job opening.");
    }
  }

  return <form className="max-w-3xl space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); void saveAs(hasApplications && job ? job.status : "draft"); }}>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField error={form.formState.errors.departmentId?.message} htmlFor="job-department" label="Department"><select className="h-11 w-full rounded-lg border bg-background px-3" id="job-department" {...form.register("departmentId", { setValueAs: Number })}>{departmentRows.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></FormField>
      <FormField error={form.formState.errors.positionId?.message} htmlFor="job-position" label="Position"><select className="h-11 w-full rounded-lg border bg-background px-3" id="job-position" {...form.register("positionId", { setValueAs: Number })}>{positionRows.map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}</select></FormField>
      <FormField error={form.formState.errors.title?.message} htmlFor="job-title" label="Title"><Input id="job-title" {...form.register("title")} /></FormField>
      <FormField error={form.formState.errors.location?.message} htmlFor="job-location" label="Location"><Input id="job-location" {...form.register("location")} /></FormField>
      <FormField error={form.formState.errors.closesOn?.message} htmlFor="job-closes-on" label="Applications close"><Input id="job-closes-on" type="date" {...form.register("closesOn", { setValueAs: (value) => value || undefined })} /></FormField>
    </div>
    <FormField error={form.formState.errors.description?.message} htmlFor="job-description" label="Description"><textarea className="min-h-40 w-full rounded-lg border bg-background p-3" id="job-description" {...form.register("description")} /></FormField>
    <section className="space-y-3 rounded-xl border p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Qualification criteria</h2><button className="text-sm font-medium text-primary" onClick={() => criteria.append({ ordinal: criteria.fields.length + 1, kind: "other", requirement: "", isRequired: true })} type="button">Add criterion</button></div>{criteria.fields.map((field, index) => <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-[10rem_1fr_auto]" key={field.id}><FormField htmlFor={`criterion-kind-${field.id}`} label={`Criterion ${index + 1} type`}><select className="h-10 w-full rounded-lg border bg-background px-2" id={`criterion-kind-${field.id}`} {...form.register(`criteria.${index}.kind`)}><option value="education">Education</option><option value="eligibility">Eligibility</option><option value="experience">Experience</option><option value="skill">Skill</option><option value="certification">Certification</option><option value="other">Other</option></select></FormField><FormField error={form.formState.errors.criteria?.[index]?.requirement?.message} htmlFor={`criterion-${field.id}`} label={`Qualification ${index + 1}`}><Input id={`criterion-${field.id}`} {...form.register(`criteria.${index}.requirement`)} /></FormField><div className="flex items-end gap-2"><label className="mb-2 flex items-center gap-1 text-sm"><input type="checkbox" {...form.register(`criteria.${index}.isRequired`)} /> Required</label>{criteria.fields.length > 1 ? <button className="mb-1 text-sm text-destructive" onClick={() => criteria.remove(index)} type="button">Remove</button> : null}</div></div>)}</section>
    {error ? <ErrorState message={error} /> : null}
    {hasApplications ? <p className="rounded-lg border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">This opening has applications. Its status can only be changed by withdrawing it from the job list.</p> : null}
    <div className="flex flex-wrap gap-3"><button className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60" disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : hasApplications ? "Save changes" : "Save draft"}</button>{!hasApplications ? <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={save.isPending} onClick={() => void saveAs("published")} type="button">Publish opening</button> : null}</div>
  </form>;
}
