"use client";

import Link from "next/link";
import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { useApplicantProfileDocuments, useMyApplicationForJob, useSubmitApplication } from "@/hooks/use-recruitment";
import { requiredDocumentStatus } from "@/lib/recruitment/required-documents";
import { ApplicantProfileRequiredError, loadMyProfileDocumentFile } from "@/queries/recruitment";

export function ApplicantApplicationForm({ jobId, hasUnsavedDocuments = false, onMissingDocuments }: { jobId: number; hasUnsavedDocuments?: boolean; onMissingDocuments?: () => void }) {
  const existing = useMyApplicationForJob(jobId);
  const documents = useApplicantProfileDocuments();
  const submit = useSubmitApplication();
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [profileAction, setProfileAction] = useState<{ href: string; label: string } | null>(null);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<string | null>(null);
  const status = requiredDocumentStatus(documents.data);
  const savedResume = documents.data?.find((document) => document.kind === "resume");

  async function onSubmit(form: HTMLFormElement) {
    setError(null);
    setProfileAction(null);
    setSubmittedApplicationId(null);
    if (!status.complete || !savedResume) {
      setError(`Please submit all required documents. Still needed: ${status.missing.map(({ label }) => label).join(", ")}.`);
      onMissingDocuments?.();
      return;
    }
    if (hasUnsavedDocuments) {
      setError("Save or cancel the file you chose above before submitting.");
      return;
    }

    setPreparing(true);
    try {
      // The saved CV / Resume becomes this application's CV, so the applicant uploads it only once.
      const cv = await loadMyProfileDocumentFile(savedResume);
      const applicationId = await submit.mutateAsync({
        applicationId: crypto.randomUUID(),
        jobId,
        documents: [{ kind: "cv" as const, file: cv }],
      });
      form.reset();
      setSubmittedApplicationId(applicationId);
    } catch (cause) {
      if (cause instanceof ApplicantProfileRequiredError) {
        setProfileAction({ href: cause.actionHref, label: cause.actionLabel });
        setError(cause.message);
        return;
      }
      setError(cause instanceof Error ? cause.message : "We could not submit your application.");
    } finally {
      setPreparing(false);
    }
  }

  if (existing.isLoading || documents.isLoading) return <p className="text-sm text-muted-foreground">Checking for an existing application…</p>;
  if (existing.error) return <ErrorState message={existing.error.message} />;
  if (existing.data) return <section className="rounded-xl border bg-card p-5 shadow-sm"><h2 className="font-heading text-lg font-bold">Application already submitted</h2><p className="mt-1 text-sm text-muted-foreground">Your current application status is {existing.data.status}.</p><Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/applicant/applications/${existing.data.id}`}>Open existing application</Link></section>;

  const submitting = preparing || submit.isPending;

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
        <h2 className="font-heading text-lg font-bold">Submit application</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your saved CV / Resume and required documents are included.</p>
      </div>
      {profileAction && error ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4" role="alert">
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Link className="mt-2 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline" href={profileAction.href}>{profileAction.label}</Link>
        </div>
      ) : error ? <ErrorState message={error} /> : null}
      {submittedApplicationId ? <div aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" role="status"><p className="font-semibold">Application submitted</p><p className="mt-1 text-sm">Your application and documents were received.</p><Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" href={`/applicant/applications/${submittedApplicationId}`}>Track application</Link></div> : null}
      <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting} type="submit">{submitting ? "Submitting…" : "Submit application"}</button>
    </form>
  );
}
