"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveJobOpening } from "@/hooks/use-recruitment";
import { OTHERS_CHOICE, PNP_GENERAL_REQUIREMENTS, RECRUITMENT_RANK, withSavedValue } from "@/lib/pnp-catalogue";
import { rankLabel } from "@/lib/ranks";
import { criteriaFromGeneralRequirements, generalRequirementsFromCriteria } from "@/lib/recruitment/general-requirements";
import { jobPostingImageUrl } from "@/lib/recruitment/job-posting-image";
import { jobOpeningFormSchema, jobOpeningSchema, jobPostingImageFileSchema, type JobOpeningFormInput, type JobOpeningInput } from "@/schemas/recruitment";
import type { JobOpening, JobQualificationCriterion } from "@/lib/types/database";

type HrJobFormProps = {
  job?: JobOpening & { job_qualification_criteria?: JobQualificationCriterion[]; applications?: Array<{ count: number }> };
};

type JobFormValues = z.input<typeof jobOpeningFormSchema>;

function defaults(job?: HrJobFormProps["job"]): JobFormValues {
  return {
    title: job?.title ?? "",
    description: job?.description ?? "",
    location: job?.location ?? "",
    closesOn: job?.closes_on ?? "",
    status: job?.status ?? "draft",
    requirements: generalRequirementsFromCriteria(job?.job_qualification_criteria),
  };
}

export function HrJobForm({ job }: HrJobFormProps) {
  const router = useRouter();
  const save = useSaveJobOpening();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedImagePath, setSavedImagePath] = useState(job?.image_path ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const form = useForm<JobFormValues, unknown, JobOpeningFormInput>({
    resolver: zodResolver(jobOpeningFormSchema),
    defaultValues: defaults(job),
  });
  const requirements = useWatch({ control: form.control, name: "requirements" });
  const hasApplications = (job?.applications?.[0]?.count ?? 0) > 0;
  const errors = form.formState.errors;
  const shownImage = previewUrl ?? (removeImage ? null : jobPostingImageUrl(savedImagePath));

  // Revoke the local preview's object URL when it is replaced and when the form unmounts.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function selectImage(file: File | null) {
    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    if (!file && imageInput.current) imageInput.current.value = "";
  }

  function chooseImage(file: File | undefined) {
    setImageError(null);
    if (!file) return;
    const validated = jobPostingImageFileSchema.safeParse(file);
    if (!validated.success) {
      setImageError(validated.error.issues[0]?.message ?? "Choose a valid image.");
      if (imageInput.current) imageInput.current.value = "";
      return;
    }
    selectImage(validated.data);
    setRemoveImage(false);
  }

  function clearImage() {
    selectImage(null);
    setRemoveImage(Boolean(savedImagePath));
    setImageError(null);
  }

  async function saveAs(status: JobOpeningInput["status"]) {
    setError(null);
    setSuccess(null);
    const valid = await form.trigger();
    if (!valid) return;
    try {
      const { requirements: values, ...details } = jobOpeningFormSchema.parse({ ...form.getValues(), status });
      const input = jobOpeningSchema.parse({ ...details, criteria: criteriaFromGeneralRequirements(values) });
      const image = imageFile ? { file: imageFile } : removeImage && savedImagePath ? { remove: true as const } : undefined;
      const saved = await save.mutateAsync({ input, jobId: job?.id, image });
      if (image) {
        setSavedImagePath(saved?.image_path ?? null);
        selectImage(null);
        setRemoveImage(false);
      }
      if (status === "published") {
        router.replace("/hr/jobs");
        return;
      }
      setSuccess(hasApplications ? "Changes saved." : "Draft saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save this job opening.");
    }
  }

  const submitDisabled = save.isPending;

  return (
    <form className="max-w-3xl space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); void saveAs(hasApplications && job ? job.status : "draft"); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField error={errors.title?.message} htmlFor="job-title" label="Title" required>
          <Input id="job-title" required {...form.register("title")} />
        </FormField>
        <FormField error={errors.location?.message} htmlFor="job-location" label="Location" required>
          <Input id="job-location" required {...form.register("location")} />
        </FormField>
        <FormField error={errors.closesOn?.message} htmlFor="job-closes-on" label="Deadline of Application" required>
          <Input id="job-closes-on" required type="date" {...form.register("closesOn")} />
        </FormField>
        <FormField description="Every recruitment is for this rank." htmlFor="job-position" label="Position">
          <Input id="job-position" readOnly value={rankLabel(RECRUITMENT_RANK)} />
        </FormField>
      </div>
      <FormField description="At least 20 characters." error={errors.description?.message} htmlFor="job-description" label="Description" required>
        <Textarea className="min-h-40" id="job-description" required rows={8} {...form.register("description")} />
      </FormField>
      <FormField description="Optional. PNG, JPEG, or WebP up to 5 MB." error={imageError ?? undefined} htmlFor="job-image" label="Image">
        <div className="space-y-3">
          {shownImage ? <Image alt="Job posting image preview" className="max-h-72 w-full rounded-lg border object-contain" height={450} src={shownImage} unoptimized width={800} /> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Input accept="image/png,image/jpeg,image/webp" className="max-w-sm" id="job-image" onChange={(event) => chooseImage(event.target.files?.[0])} ref={imageInput} type="file" />
            {shownImage ? <Button onClick={clearImage} size="sm" type="button" variant="outline">Remove image</Button> : null}
          </div>
        </div>
      </FormField>
      <section aria-labelledby="job-requirements-heading" className="space-y-4 rounded-xl border p-4">
        <h2 className="font-semibold" id="job-requirements-heading">General Requirements</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["education", "eligibility"] as const).map((kind, index) => {
            const label = kind === "education" ? "Education" : "Eligibility";
            const fieldErrors = errors.requirements?.[kind];
            // A saved requirement that is not listed (older openings) stays selectable as its own choice.
            const choices = withSavedValue(PNP_GENERAL_REQUIREMENTS[kind], requirements?.[kind]?.choice);
            return (
              <div className="space-y-3 rounded-lg bg-muted/50 p-3" key={kind}>
                <FormField error={fieldErrors?.choice?.message} htmlFor={`requirement-${kind}`} label={`Requirement ${index + 1}: ${label}`} required>
                  <NativeSelect id={`requirement-${kind}`} required {...form.register(`requirements.${kind}.choice`)}>
                    <option value="">Select {label.toLowerCase()}</option>
                    {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                  </NativeSelect>
                </FormField>
                {requirements?.[kind]?.choice === OTHERS_CHOICE ? (
                  <FormField error={fieldErrors?.other?.message} htmlFor={`requirement-${kind}-other`} label={`Specify ${label.toLowerCase()}`} required>
                    <Input id={`requirement-${kind}-other`} maxLength={1000} required {...form.register(`requirements.${kind}.other`)} />
                  </FormField>
                ) : null}
              </div>
            );
          })}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Other requirements</legend>
          <p className="text-sm text-muted-foreground">Uncheck a requirement that does not apply to this opening.</p>
          <ul className="space-y-1">
            {(requirements?.otherRequirements ?? []).map((item, index) => (
              <li key={`${item.kind}-${item.requirement}`}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input className="size-4" type="checkbox" {...form.register(`requirements.otherRequirements.${index}.included`)} /> {item.requirement}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </section>
      {error ? <ErrorState message={error} /> : null}
      {hasApplications ? <p className="rounded-lg border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">This opening has applications. Its status can only be changed by withdrawing it from the job list.</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={submitDisabled} type="submit" variant="outline">{save.isPending ? "Saving…" : hasApplications ? "Save changes" : "Save draft"}</Button>
        {!hasApplications ? <Button disabled={submitDisabled} onClick={() => void saveAs("published")} type="button">Publish opening</Button> : null}
        {success && !save.isPending ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{success}</p> : null}
      </div>
    </form>
  );
}
