"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyApplication } from "@/hooks/use-recruitment";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { getApplicantDocumentUrl } from "@/queries/recruitment";

import { documentKindLabels, historyEntryLabel } from "./application-status-tracker";
import { AppliedJobSummary } from "./applied-job-summary";

export function ApplicantApplicationDetail({ applicationId }: { applicationId: string }) {
  const result = useMyApplication(applicationId);
  const [urls, setUrls] = useState<Record<string, string>>({});

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
  return <section className="max-w-3xl space-y-5">
    <div className="rounded-xl border p-5"><h1 className="text-3xl font-bold tracking-tight">Application status: {application.status}</h1><p className="mt-2 text-sm text-muted-foreground">Submitted {formatDateTime(application.submitted_at)}</p></div>
    <AppliedJobSummary job={application.job_openings} status={application.status} submittedAt={application.submitted_at} />
    <div className="rounded-xl border p-5"><h2 className="font-bold" id="application-history-heading">Status history</h2><ol aria-labelledby="application-history-heading" className="mt-3 space-y-2 text-sm">{history.map((entry) => <li key={entry.id}><span className="text-muted-foreground">{formatDate(entry.created_at)}</span> · <span className="font-medium">{historyEntryLabel(entry)}</span>{entry.note ? ` — ${entry.note}` : ""}</li>)}</ol></div>
    <div className="rounded-xl border p-5"><h2 className="font-bold" id="application-documents-heading">Documents</h2><ul aria-labelledby="application-documents-heading" className="mt-3 space-y-2 text-sm">{documents.map((document) => <li className="flex flex-wrap items-center gap-2" key={document.id}><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">SUBMITTED</span><span className="text-muted-foreground">{documentKindLabels[document.kind]}</span> · {urls[document.id] ? <a className="text-primary underline" href={urls[document.id]} rel="noreferrer" target="_blank">{document.file_name}</a> : document.file_name}</li>)}</ul></div>
  </section>;
}
