"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyApplication, useResubmitApplication } from "@/hooks/use-recruitment";
import { getApplicantDocumentUrl } from "@/queries/recruitment";

function isNonEmptyFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "size" in value && value.size > 0;
}

export function ApplicantApplicationDetail({ applicationId }: { applicationId: string }) {
  const result = useMyApplication(applicationId);
  const resubmit = useResubmitApplication();
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
    <div className="rounded-xl border p-5"><h1 className="text-2xl font-semibold">Application status: {application.status}</h1><p className="mt-2 text-sm text-muted-foreground">Submitted {new Date(application.submitted_at).toLocaleString()}</p></div>
    {canResubmit ? <form className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5" noValidate onSubmit={(event) => { event.preventDefault(); void submitRevision(event.currentTarget); }}>
      <div><h2 className="font-semibold">Update and resubmit</h2><p className="mt-1 text-sm text-muted-foreground">HR requested revisions. Upload a replacement CV and any supporting credentials.</p></div>
      <FormField htmlFor="revision-cv" label="Replacement CV (PDF)"><Input accept=".pdf,application/pdf" id="revision-cv" name="cv" required type="file" /></FormField>
      <FormField htmlFor="revision-credentials" label="Replacement credentials (optional)"><Input accept=".pdf,.png,.jpg,.jpeg" id="revision-credentials" multiple name="credentials" type="file" /></FormField>
      {revisionError ? <ErrorState message={revisionError} /> : null}
      {revisionNotice ? <p className="text-sm text-emerald-700" role="status">{revisionNotice}</p> : null}
      <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={resubmit.isPending} type="submit">{resubmit.isPending ? "Resubmitting…" : "Resubmit application"}</button>
    </form> : null}
    <div className="rounded-xl border p-5"><h2 className="font-semibold">Status history</h2><ol className="mt-3 space-y-2 text-sm">{history.map((entry) => <li key={entry.id}>{entry.next_status}{entry.note ? ` — ${entry.note}` : ""}</li>)}</ol></div>
    <div className="rounded-xl border p-5"><h2 className="font-semibold">Documents</h2><ul className="mt-3 space-y-2 text-sm">{documents.map((document) => <li key={document.id}>{urls[document.id] ? <a className="text-primary underline" href={urls[document.id]} rel="noreferrer" target="_blank">{document.file_name}</a> : document.file_name}</li>)}</ul></div>
  </section>;
}
