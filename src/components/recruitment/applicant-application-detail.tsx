"use client";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { getApplicantDocumentUrl } from "@/queries/recruitment";
import { useMyApplication } from "@/hooks/use-recruitment";
import { useEffect, useState } from "react";

export function ApplicantApplicationDetail({ applicationId }: { applicationId: string }) {
  const result = useMyApplication(applicationId);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => { const documents = result.data?.documents ?? []; void Promise.all(documents.map(async (document) => { const url = await getApplicantDocumentUrl(document.object_path).catch(() => null); return [document.id, url] as const; })).then((entries) => setUrls(Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1]))))); }, [result.data?.documents]);
  if (result.isLoading) return <LoadingState label="Loading application…" />;
  if (result.error) return <ErrorState message={result.error.message} />;
  if (!result.data) return <ErrorState message="This application is unavailable." />;
  return <section className="max-w-3xl space-y-5"><div className="rounded-xl border p-5"><h1 className="text-2xl font-semibold">Application status: {result.data.application.status}</h1><p className="mt-2 text-sm text-muted-foreground">Submitted {new Date(result.data.application.submitted_at).toLocaleString()}</p></div><div className="rounded-xl border p-5"><h2 className="font-semibold">Status history</h2><ol className="mt-3 space-y-2 text-sm">{result.data.history.map((entry) => <li key={entry.id}>{entry.next_status}{entry.note ? ` — ${entry.note}` : ""}</li>)}</ol></div><div className="rounded-xl border p-5"><h2 className="font-semibold">Documents</h2><ul className="mt-3 space-y-2 text-sm">{result.data.documents.map((document) => <li key={document.id}>{urls[document.id] ? <a className="text-primary underline" href={urls[document.id]} rel="noreferrer" target="_blank">{document.file_name}</a> : document.file_name}</li>)}</ul></div></section>;
}
