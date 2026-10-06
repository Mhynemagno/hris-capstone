"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyApplication, useResubmitApplication, useSubmitBmiProof } from "@/hooks/use-recruitment";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { getApplicantDocumentUrl } from "@/queries/recruitment";

import { documentKindLabels, historyEntryLabel } from "./application-status-tracker";
import { AppliedJobSummary } from "./applied-job-summary";

function isNonEmptyFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "size" in value && value.size > 0;
}

export function ApplicantApplicationDetail({ applicationId }: { applicationId: string }) {
  const result = useMyApplication(applicationId);
  const resubmit = useResubmitApplication();
  const bmiProof = useSubmitBmiProof();
  const [bmiError, setBmiError] = useState<string | null>(null);
  const [bmiNotice, setBmiNotice] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [revisionNotice, setRevisionNotice] = useState<string | null>(null);

  useEffect(() => {
    const documents = result.data?.documents ?? [];
    void Promise.all(documents.map(async (document) => {
      const url = await getApplicantDocumentUrl(document.object_path).catch(() => null);
      return [document.id, url] as const;
    })).then((entries) => setUrls(Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1])))));
  }, [result.data?.documents]);

  if (result.isLoading) return <LoadingState label="Loading application…" />;
  if (result.error) return <ErrorState message={result.error.message} />;
  if (!result.data) return <ErrorState message="This application is unavailable." />;
  const { application, history, documents } = result.data;
  const canResubmit = application.status === "Needs Revision";
  const canUploadBmiProof = application.status === "Endorsed to Crame";
  const currentBmiProof = documents.find((document) => document.kind === "bmi_proof");

  async function submitBmiProof(form: HTMLFormElement) {
    setBmiError(null);
    setBmiNotice(null);
    const file = new FormData(form).get("bmiProof");
    if (!isNonEmptyFile(file)) {
      setBmiError("Choose your BMI proof file first.");
      return;
    }
    try {
      await bmiProof.mutateAsync({ applicationId, file });
      form.reset();
      setBmiNotice("BMI proof uploaded. HR will check it and update your progress.");
    } catch (cause) {
      setBmiError(cause instanceof Error ? cause.message : "We could not upload your BMI proof.");
    }
  }

  async function submitRevision(form: HTMLFormElement) {
    setRevisionError(null);
    setRevisionNotice(null);
    const data = new FormData(form);
    const cv = data.get("cv");
    const credentials = Array.from(data.getAll("credentials")).filter(isNonEmptyFile);
    if (!isNonEmptyFile(cv) || (cv.type !== "application/pdf" && !/\.pdf$/i.test(cv.name))) {
      setRevisionError("Attach your replacement CV as a PDF before resubmitting.");
      return;
    }
    try {
      await resubmit.mutateAsync({ applicationId, documents: [{ kind: "cv", file: cv }, ...credentials.map((file) => ({ kind: "credential" as const, file }))] });
      form.reset();
      setRevisionNotice("Your application has been resubmitted for review.");
    } catch (cause) {
      setRevisionError(cause instanceof Error ? cause.message : "We could not resubmit your application.");
    }
  }

  return <section className="max-w-3xl space-y-5">
    <div className="rounded-xl border p-5"><h1 className="text-3xl font-bold tracking-tight">Application status: {application.status}</h1><p className="mt-2 text-sm text-muted-foreground">Submitted {formatDateTime(application.submitted_at)}</p></div>
    <AppliedJobSummary job={application.job_openings} status={application.status} submittedAt={application.submitted_at} />
    {canResubmit ? <form className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5" noValidate onSubmit={(event) => { event.preventDefault(); void submitRevision(event.currentTarget); }}>
      <div><h2 className="font-bold">Update and resubmit</h2><p className="mt-1 text-sm text-muted-foreground">HR requested revisions. Upload a replacement CV and any supporting credentials.</p></div>
      <FormField htmlFor="revision-cv" label="Replacement CV (PDF)"><Input accept=".pdf,application/pdf" id="revision-cv" name="cv" required type="file" /></FormField>
      <FormField htmlFor="revision-credentials" label="Replacement credentials (optional)"><Input accept=".pdf,.png,.jpg,.jpeg" id="revision-credentials" multiple name="credentials" type="file" /></FormField>
      {revisionError ? <ErrorState message={revisionError} /> : null}
      {revisionNotice ? <p className="text-sm text-emerald-700" role="status">{revisionNotice}</p> : null}
      <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={resubmit.isPending} type="submit">{resubmit.isPending ? "Resubmitting…" : "Resubmit application"}</button>
    </form> : null}
    {canUploadBmiProof ? <form className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5" noValidate onSubmit={(event) => { event.preventDefault(); void submitBmiProof(event.currentTarget); }}>
      <div><h2 className="font-bold">Proof of passing the BMI</h2><p className="mt-1 text-sm text-muted-foreground">You are endorsed to Crame. Upload proof that you passed the BMI so HR can move you to the neuro-psychiatric exam.{currentBmiProof ? ` You already uploaded ${currentBmiProof.file_name}; a new file replaces it.` : ""}</p></div>
      <FormField htmlFor="bmi-proof" label="BMI proof (PDF, PNG or JPEG)"><Input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" id="bmi-proof" name="bmiProof" required type="file" /></FormField>
      {bmiError ? <ErrorState message={bmiError} /> : null}
      {bmiNotice ? <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">{bmiNotice}</p> : null}
      <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={bmiProof.isPending} type="submit">{bmiProof.isPending ? "Uploading…" : "Upload BMI proof"}</button>
    </form> : null}
    <div className="rounded-xl border p-5"><h2 className="font-bold" id="application-history-heading">Status history</h2><ol aria-labelledby="application-history-heading" className="mt-3 space-y-2 text-sm">{history.map((entry) => <li key={entry.id}><span className="text-muted-foreground">{formatDate(entry.created_at)}</span> · <span className="font-medium">{historyEntryLabel(entry)}</span>{entry.note ? ` — ${entry.note}` : ""}</li>)}</ol></div>
    <div className="rounded-xl border p-5"><h2 className="font-bold" id="application-documents-heading">Documents</h2><ul aria-labelledby="application-documents-heading" className="mt-3 space-y-2 text-sm">{documents.map((document) => <li key={document.id}><span className="text-muted-foreground">{documentKindLabels[document.kind]}</span> · {urls[document.id] ? <a className="text-primary underline" href={urls[document.id]} rel="noreferrer" target="_blank">{document.file_name}</a> : document.file_name}</li>)}</ul></div>
  </section>;
}
