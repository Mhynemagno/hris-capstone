"use client";

import { CheckCircle2, CircleDashed, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useRemoveMyApplicantProfileDocument } from "@/hooks/use-applicant-portal";
import { useApplicantProfileDocuments, useSaveApplicantProfileDocuments } from "@/hooks/use-recruitment";
import { getApplicantProfileDocumentUrl } from "@/queries/recruitment";
import { applicantProfileDocumentFileSchema } from "@/schemas/recruitment";

const documentKinds = [
  { kind: "eligibility" as const, label: "Eligibility" },
  { kind: "diploma" as const, label: "Diploma" },
];

type DocumentKind = (typeof documentKinds)[number]["kind"];

const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

export function ApplicantProfileDocuments() {
  const documents = useApplicantProfileDocuments();
  const save = useSaveApplicantProfileDocuments();
  const remove = useRemoveMyApplicantProfileDocument();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = save.isPending || remove.isPending;

  async function uploadDocument(kind: DocumentKind, file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    const validated = applicantProfileDocumentFileSchema.safeParse(file);
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "Choose a valid document.");
      return;
    }
    try {
      await save.mutateAsync([{ kind, file: validated.data }]);
      setNotice(`${kind === "eligibility" ? "Eligibility" : "Diploma"} document saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the document.");
    }
  }

  async function removeDocument(kind: DocumentKind, label: string) {
    setError(null);
    setNotice(null);
    if (!window.confirm(`Remove your ${label} document?`)) return;
    try {
      await remove.mutateAsync(kind);
      setNotice(`${label} document removed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove the document.");
    }
  }

  async function openDocument(objectPath: string) {
    setError(null);
    try {
      window.open(await getApplicantProfileDocumentUrl(objectPath), "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open the document.");
    }
  }

  if (documents.isLoading) return <LoadingState label="Loading documents…" />;
  if (documents.error) return <p className="text-sm text-destructive" role="alert">{documents.error.message}</p>;

  return <section aria-labelledby="applicant-documents" className="rounded-2xl border bg-card p-5 sm:p-6">
    <h2 className="text-lg font-semibold" id="applicant-documents">Required documents</h2>
    <p className="mt-1 text-sm text-muted-foreground">Upload your Eligibility and Diploma (PDF, PNG, or JPEG, up to 10 MiB) before submitting an application.</p>
    <ul className="mt-4 grid gap-4 sm:grid-cols-2">
      {documentKinds.map(({ kind, label }) => {
        const document = documents.data?.find((item) => item.kind === kind);
        return <li className="rounded-xl border p-4" key={kind}>
          <div className="flex items-center gap-2">
            {document ? <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-600" /> : <CircleDashed aria-hidden="true" className="size-5 text-muted-foreground" />}
            <p className="font-medium">{label}</p>
          </div>
          {document ? <div className="mt-2 space-y-2">
            <p className="break-all text-sm">{document.file_name}</p>
            <p className="text-xs text-muted-foreground">Uploaded {dateFormat.format(new Date(document.updated_at))}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void openDocument(document.object_path)} size="sm" type="button" variant="outline"><ExternalLink aria-hidden="true" /> View</Button>
              <Button aria-label={`Remove ${label.toLowerCase()} document`} disabled={busy} onClick={() => void removeDocument(kind, label)} size="sm" type="button" variant="outline"><Trash2 aria-hidden="true" /> Remove</Button>
            </div>
          </div> : <p className="mt-2 text-sm text-muted-foreground">Not uploaded</p>}
          <p aria-hidden="true" className="mt-3 text-sm font-medium">{document ? "Replace file" : "Upload file"}</p>
          <Input accept="application/pdf,image/png,image/jpeg" aria-label={`Upload ${label.toLowerCase()} document`} className="mt-1" disabled={busy} id={`upload-${kind}`} onChange={(event) => { void uploadDocument(kind, event.target.files?.[0]); event.target.value = ""; }} type="file" />
        </li>;
      })}
    </ul>
    {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
    {notice ? <p className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </section>;
}
