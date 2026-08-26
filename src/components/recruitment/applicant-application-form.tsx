"use client";

import Link from "next/link";
import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useSubmitApplication } from "@/hooks/use-recruitment";
import { ApplicantProfileRequiredError } from "@/queries/recruitment";

export function ApplicantApplicationForm({ jobId }: { jobId: number }) {
  const submit = useSubmitApplication();
  const [error, setError] = useState<string | null>(null);
  const [profileRequired, setProfileRequired] = useState(false);

  async function onSubmit(form: HTMLFormElement) {
    setError(null);
    setProfileRequired(false);

    const data = new FormData(form);
    const files = Array.from(data.getAll("documents")).filter(
      (value): value is File => value instanceof File && value.size > 0,
    );

    if (!files.some((file) => file.type === "application/pdf" || /\.(pdf)$/i.test(file.name))) {
      setError("Attach a CV before submitting.");
      return;
    }

    try {
      await submit.mutateAsync({
        applicationId: crypto.randomUUID(),
        jobId,
        coverNote: String(data.get("coverNote") ?? ""),
        documents: files.map((file, index) => ({
          kind: index === 0 ? "cv" as const : "credential" as const,
          file,
        })),
      });
      form.reset();
    } catch (cause) {
      if (cause instanceof ApplicantProfileRequiredError) {
        setProfileRequired(true);
        setError(cause.message);
        return;
      }

      setError(cause instanceof Error ? cause.message : "We could not submit your application.");
    }
  }

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
      <FormField htmlFor="application-documents" label="CV and credentials">
        <Input accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" aria-describedby="application-documents-help" id="application-documents" multiple name="documents" type="file" />
      </FormField>
      <p className="text-sm text-muted-foreground" id="application-documents-help">Upload your CV first. You can add certificates or other supporting documents. Files must be 10 MB or smaller.</p>
      {profileRequired && error ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4" role="alert">
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Link className="mt-2 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline" href="/applicant/profile">Complete profile</Link>
        </div>
      ) : error ? <ErrorState message={error} /> : null}
      <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={submit.isPending} type="submit">{submit.isPending ? "Submitting…" : "Submit application"}</button>
    </form>
  );
}
