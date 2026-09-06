"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useApplicantProfileDocuments, useSaveApplicantProfileDocuments } from "@/hooks/use-recruitment";
import { applicantProfileDocumentFileSchema } from "@/schemas/recruitment";

const documentKinds = [
  { kind: "eligibility" as const, label: "Eligibility" },
  { kind: "diploma" as const, label: "Diploma" },
];

export function ApplicantProfileDocuments() {
  const documents = useApplicantProfileDocuments();
  const save = useSaveApplicantProfileDocuments();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function uploadDocument(kind: "eligibility" | "diploma", file: File | undefined) {
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

  if (documents.isLoading) return <LoadingState label="Loading profile documents…" />;
  if (documents.error) return <p className="text-sm text-destructive" role="alert">{documents.error.message}</p>;

  return <section aria-labelledby="applicant-documents" className="rounded-2xl border bg-card p-5 sm:p-6">
    <h2 className="text-lg font-semibold" id="applicant-documents">Required documents</h2>
    <p className="mt-1 text-sm text-muted-foreground">Upload your Eligibility and Diploma documents before submitting an application.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {documentKinds.map(({ kind, label }) => {
        const document = documents.data?.find((item) => item.kind === kind);
        return <div className="rounded-xl border p-4" key={kind}>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{document ? document.file_name : "Not uploaded"}</p>
          <Input accept="application/pdf,image/png,image/jpeg" aria-label={`Upload ${label.toLowerCase()} document`} className="mt-3" disabled={save.isPending} onChange={(event) => void uploadDocument(kind, event.target.files?.[0])} type="file" />
        </div>;
      })}
    </div>
    {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
    {notice ? <p className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </section>;
}
