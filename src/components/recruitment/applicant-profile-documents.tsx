"use client";

import { CheckCircle2, CircleDashed, ExternalLink, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useRemoveMyApplicantProfileDocument } from "@/hooks/use-applicant-portal";
import { useApplicantProfileDocuments, useSaveApplicantProfileDocuments } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { requiredDocumentStatus } from "@/lib/recruitment/required-documents";
import type { ApplicantProfileDocumentKind } from "@/lib/types/database";
import { getApplicantProfileDocumentUrl } from "@/queries/recruitment";
import { APPLICANT_PROFILE_DOCUMENT_KINDS, profileDocumentFileSchemaFor } from "@/schemas/applicant-portal";

type DocumentKind = ApplicantProfileDocumentKind;

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function without<T extends object>(record: T, key: keyof T): T {
  const next = { ...record };
  delete next[key];
  return next;
}

/** `onPendingChange` reports whether a chosen file is still unsaved, so the apply form can wait for it. */
export function ApplicantProfileDocuments({ onPendingChange }: { onPendingChange?: (pending: boolean) => void } = {}) {
  const documents = useApplicantProfileDocuments();
  const save = useSaveApplicantProfileDocuments();
  const remove = useRemoveMyApplicantProfileDocument();
  const [pending, setPending] = useState<Partial<Record<DocumentKind, File>>>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DocumentKind, string>>>({});
  const [savingKind, setSavingKind] = useState<DocumentKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = save.isPending || remove.isPending;
  const hasPending = Object.keys(pending).length > 0;

  useEffect(() => {
    onPendingChange?.(hasPending);
  }, [hasPending, onPendingChange]);

  // A chosen but unsaved file would be lost on navigation, so ask the browser to warn first.
  useEffect(() => {
    if (!hasPending) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPending]);

  function pick(kind: DocumentKind, file: File | undefined) {
    setNotice(null);
    setFieldErrors((current) => without(current, kind));
    if (!file) return;
    const validated = profileDocumentFileSchemaFor(kind).safeParse(file);
    if (!validated.success) {
      setPending((current) => without(current, kind));
      setFieldErrors((current) => ({ ...current, [kind]: validated.error.issues[0]?.message ?? "Choose a valid document." }));
      return;
    }
    setPending((current) => ({ ...current, [kind]: validated.data }));
  }

  async function saveDocument(kind: DocumentKind, label: string) {
    const file = pending[kind];
    if (!file) return;
    setError(null);
    setNotice(null);
    setSavingKind(kind);
    try {
      await save.mutateAsync([{ kind, file }]);
      setPending((current) => without(current, kind));
      setNotice(`${label} document saved.`);
    } catch (caught) {
      setFieldErrors((current) => ({ ...current, [kind]: caught instanceof Error ? caught.message : "Unable to save the document." }));
    } finally {
      setSavingKind(null);
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

  const status = requiredDocumentStatus(documents.data);

  return <section aria-labelledby="applicant-documents" className="rounded-2xl border bg-card p-5 sm:p-6">
    <h2 className="text-lg font-semibold" id="applicant-documents">Required documents</h2>
    <p className="mt-1 text-sm text-muted-foreground">Save all five documents (up to 10 MiB each) before submitting an application. The 2x2 picture must be a PNG or JPEG image; the other documents must be PDF files.</p>
    <div className="mt-4 rounded-lg border bg-muted/50 p-3">
      <p className="font-medium">{status.saved} of {status.total} required documents saved</p>
      {status.missing.length ? <p className="mt-1 text-sm text-muted-foreground">Still needed: {status.missing.map(({ label }) => label).join(", ")}</p> : null}
    </div>
    <ul className="mt-4 grid gap-4 sm:grid-cols-2">
      {APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, label, accept, formats }) => {
        const document = documents.data?.find((item) => item.kind === kind);
        const chosen = pending[kind];
        const fieldError = fieldErrors[kind];
        return <li className="rounded-xl border p-4" key={kind}>
          <div className="flex items-center gap-2">
            {document ? <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-600" /> : <CircleDashed aria-hidden="true" className="size-5 text-muted-foreground" />}
            <p className="font-medium">{label} <span aria-hidden="true" className="text-destructive">*</span><span className="sr-only">(required)</span></p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{formats}</p>
          {document ? <div className="mt-2 space-y-2">
            <p className="break-all text-sm">{document.file_name}</p>
            <p className="text-sm font-medium text-emerald-700">Saved {formatDate(document.updated_at)}</p>
            <div className="flex flex-wrap gap-2">
              <Button aria-label={`View ${label} document`} onClick={() => void openDocument(document.object_path)} size="sm" type="button" variant="outline"><ExternalLink aria-hidden="true" /> View</Button>
              <Button aria-label={`Remove ${label} document`} disabled={busy} onClick={() => void removeDocument(kind, label)} size="sm" type="button" variant="outline"><Trash2 aria-hidden="true" /> Remove</Button>
            </div>
          </div> : <p className="mt-2 text-sm text-muted-foreground">Not saved yet</p>}
          <p aria-hidden="true" className="mt-3 text-sm font-medium">{document ? "Replace file" : "Choose file"}</p>
          <Input accept={accept} aria-describedby={fieldError ? `upload-${kind}-error` : undefined} aria-invalid={fieldError ? true : undefined} aria-label={`Upload ${label} document`} className="mt-1" disabled={busy} id={`upload-${kind}`} onChange={(event) => { pick(kind, event.target.files?.[0]); event.target.value = ""; }} type="file" />
          {fieldError ? <p className="mt-2 text-sm text-destructive" id={`upload-${kind}-error`} role="alert">{fieldError}</p> : null}
          {chosen ? <div className="mt-3 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="break-all text-sm">Selected: {chosen.name} ({formatSize(chosen.size)})</p>
            <div className="flex flex-wrap gap-2">
              <Button aria-label={`Save ${label} document`} className="min-h-11" disabled={busy} onClick={() => void saveDocument(kind, label)} type="button"><Save aria-hidden="true" /> {savingKind === kind ? "Saving…" : "Save"}</Button>
              <Button aria-label={`Cancel ${label} upload`} className="min-h-11" disabled={savingKind === kind} onClick={() => setPending((current) => without(current, kind))} type="button" variant="outline"><X aria-hidden="true" /> Cancel</Button>
            </div>
          </div> : null}
        </li>;
      })}
    </ul>
    {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
    {notice ? <p className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </section>;
}
