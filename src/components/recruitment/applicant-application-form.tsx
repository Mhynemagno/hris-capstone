"use client";

import Link from "next/link";
import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useMyApplicationForJob, useSubmitApplication } from "@/hooks/use-recruitment";
import { ApplicantProfileRequiredError } from "@/queries/recruitment";

function isNonEmptyFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "size" in value && value.size > 0;
}

export function ApplicantApplicationForm({ jobId }: { jobId: number }) {
  const existing = useMyApplicationForJob(jobId);
  const submit = useSubmitApplication();
  const [error, setError] = useState<string | null>(null);
  const [profileRequired, setProfileRequired] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<string | null>(null);

  async function onSubmit(form: HTMLFormElement) {
    setError(null);
    setProfileRequired(false);
    setSubmittedApplicationId(null);

    const data = new FormData(form);
    const cvValue = data.get("cv");
    const cv = isNonEmptyFile(cvValue) ? cvValue : null;
    const credentials = Array.from(data.getAll("credentials")).filter(
      isNonEmptyFile,
    );

    if (!cv || (cv.type !== "application/pdf" && !/\.pdf$/i.test(cv.name))) {
      setError("Attach your CV as a PDF before submitting.");
      return;
    }

    try {
      const applicationId = await submit.mutateAsync({
        applicationId: crypto.randomUUID(),
        jobId,
        coverNote: String(data.get("coverNote") ?? ""),
        documents: [
          { kind: "cv" as const, file: cv },
          ...credentials.map((file) => ({ kind: "credential" as const, file })),
        ],
      });
      form.reset();
      setSubmittedApplicationId(applicationId);
    } catch (cause) {
      if (cause instanceof ApplicantProfileRequiredError) {
        setProfileRequired(true);
        setError(cause.message);
        return;
      }

      setError(cause instanceof Error ? cause.message : "We could not submit your application.");
    }
  }

  if (existing.isLoading) return <p className="text-sm text-muted-foreground">Checking for an existing application…</p>;
  if (existing.error) return <ErrorState message={existing.error.message} />;
  if (existing.data) return <section className="rounded-xl border bg-card p-5 shadow-sm"><h2 className="font-heading text-lg font-semibold">Application already submitted</h2><p className="mt-1 text-sm text-muted-foreground">Your current application status is {existing.data.status}.</p><Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/applicant/applications/${existing.data.id}`}>Open existing application</Link></section>;

  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-5 shadow-sm"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(event.currentTarget);
      }}
    >
      <div>
        <h2 className="font-heading text-lg font-semibold">Submit application</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your saved profile details will be included with this application.</p>
      </div>
      <FormField htmlFor="application-cover-note" label="Cover note">
        <textarea className="min-h-28 w-full rounded-lg border bg-background p-3 text-base leading-6" id="application-cover-note" name="coverNote" />
      </FormField>
      <FormField htmlFor="application-cv" label="CV (PDF)">
        <Input accept=".pdf,application/pdf" aria-describedby="application-cv-help" id="application-cv" name="cv" required type="file" />
      </FormField>
      <p className="text-sm text-muted-foreground" id="application-cv-help">Required. Upload one PDF no larger than 10 MB.</p>
      <FormField htmlFor="application-credentials" label="Credentials (optional)">
        <Input accept=".pdf,.png,.jpg,.jpeg" aria-describedby="application-credentials-help" id="application-credentials" multiple name="credentials" type="file" />
      </FormField>
      <p className="text-sm text-muted-foreground" id="application-credentials-help">Add certificates or other supporting documents as PDF, PNG, or JPEG files up to 10 MB each.</p>
      {profileRequired && error ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4" role="alert">
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Link className="mt-2 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline" href="/applicant/profile">Complete profile</Link>
        </div>
      ) : error ? <ErrorState message={error} /> : null}
      {submittedApplicationId ? <div aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" role="status"><p className="font-semibold">Application submitted</p><p className="mt-1 text-sm">Your application and documents were received.</p><Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" href={`/applicant/applications/${submittedApplicationId}`}>Track application</Link></div> : null}
      <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={submit.isPending} type="submit">{submit.isPending ? "Submitting…" : "Submit application"}</button>
    </form>
  );
}
