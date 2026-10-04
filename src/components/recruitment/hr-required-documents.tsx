"use client";

import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useApplicantProfileDocumentsFor } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { getApplicantProfileDocumentUrl } from "@/queries/recruitment";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

/** The five documents the applicant saved before applying, for HR to open while reviewing. */
export function HrRequiredDocuments({ applicantId }: { applicantId: string }) {
  const documents = useApplicantProfileDocumentsFor(applicantId);
  const [error, setError] = useState<string | null>(null);

  async function open(objectPath: string) {
    setError(null);
    try {
      window.open(await getApplicantProfileDocumentUrl(objectPath), "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not open this document.");
    }
  }

  return <section aria-labelledby="hr-required-documents" className="rounded-xl border p-5">
    <h2 className="font-semibold" id="hr-required-documents">Required documents</h2>
    {documents.isLoading ? <LoadingState label="Loading required documents…" /> : documents.error ? <ErrorState message={documents.error.message} /> : (
      <ul className="mt-3 divide-y text-sm">
        {APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, label }) => {
          const document = documents.data?.find((item) => item.kind === kind);
          return <li className="flex flex-wrap items-center justify-between gap-2 py-2" key={kind}>
            <span className="font-medium">{label}</span>
            {document
              ? <span className="flex items-center gap-3"><span className="text-muted-foreground">{formatDate(document.updated_at)}</span><button aria-label={`Open ${label}: ${document.file_name}`} className="inline-flex min-h-11 items-center text-primary underline" onClick={() => void open(document.object_path)} type="button">{document.file_name}</button></span>
              : <span className="text-muted-foreground">Not uploaded</span>}
          </li>;
        })}
      </ul>
    )}
    {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
  </section>;
}
