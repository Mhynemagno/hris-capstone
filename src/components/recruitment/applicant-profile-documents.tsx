"use client";

import { Check, CloudUpload, Eye, FileText, Image as ImageIcon, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { notifyApplicant } from "@/components/app-shell/applicant-toaster";
import { LoadingState } from "@/components/ui/loading-state";
import { useRemoveMyApplicantProfileDocument } from "@/hooks/use-applicant-portal";
import { useApplicantProfileDocuments, useSaveApplicantProfileDocuments, useSubmitMyApplication } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { requiredDocumentStatus } from "@/lib/recruitment/required-documents";
import type { ApplicantProfileDocumentKind } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { getApplicantProfileDocumentUrl, setMyPreferredJobOpening } from "@/queries/recruitment";
import { APPLICANT_PROFILE_DOCUMENT_KINDS, profileDocumentFileSchemaFor } from "@/schemas/applicant-portal";

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const errorText = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

/**
 * Capstone UI documents.html: one card per required document. Choosing a file uploads it right away;
 * "Save All Documents" submits the application once all five are on file (to the posting the applicant
 * chose on the public site, or the newest open one).
 */
export function ApplicantProfileDocuments({ applyJobId = null }: { applyJobId?: number | null } = {}) {
  const router = useRouter();
  const documents = useApplicantProfileDocuments();
  const save = useSaveApplicantProfileDocuments();
  const remove = useRemoveMyApplicantProfileDocument();
  const submit = useSubmitMyApplication();
  const [uploading, setUploading] = useState<ApplicantProfileDocumentKind | null>(null);
  const rememberedJob = useRef<number | null>(null);
  const busy = save.isPending || remove.isPending;

  // "Apply" on a posting lands here with ?apply=<id>: remember that posting once, then drop the parameter.
  useEffect(() => {
    if (!applyJobId || rememberedJob.current === applyJobId) return;
    rememberedJob.current = applyJobId;
    setMyPreferredJobOpening(applyJobId)
      .catch((cause: unknown) => notifyApplicant({ title: "Posting unavailable", description: errorText(cause, "This posting is no longer accepting applications."), tone: "warning" }))
      .finally(() => router.replace("/applicant/documents"));
  }, [applyJobId, router]);

  async function upload(kind: ApplicantProfileDocumentKind, file: File | undefined) {
    if (!file) return;
    const validated = profileDocumentFileSchemaFor(kind).safeParse(file);
    if (!validated.success) {
      notifyApplicant({ title: "Document not saved", description: validated.error.issues[0]?.message ?? "Choose a valid document.", tone: "error" });
      return;
    }
    setUploading(kind);
    try {
      await save.mutateAsync({ [kind]: validated.data });
      notifyApplicant({ title: "Saved Successfully!", description: "Your document status has been updated." });
    } catch (cause) {
      notifyApplicant({ title: "Document not saved", description: errorText(cause, "Unable to save the document."), tone: "error" });
    } finally {
      setUploading(null);
    }
  }

  async function deleteDocument(kind: ApplicantProfileDocumentKind, label: string) {
    if (!window.confirm(`Are you sure you want to delete your uploaded ${label}?`)) return;
    try {
      await remove.mutateAsync(kind);
      notifyApplicant({ title: "Document Deleted", description: `${label} has been removed.` });
    } catch (cause) {
      notifyApplicant({ title: "Document not deleted", description: errorText(cause, "Unable to remove the document."), tone: "error" });
    }
  }

  async function openDocument(objectPath: string) {
    try {
      window.open(await getApplicantProfileDocumentUrl(objectPath), "_blank", "noopener,noreferrer");
    } catch (cause) {
      notifyApplicant({ title: "Document unavailable", description: errorText(cause, "Unable to open the document."), tone: "error" });
    }
  }

  async function saveAll() {
    const status = requiredDocumentStatus(documents.data);
    if (!status.complete) {
      notifyApplicant({ title: "Please upload required documents", description: `Still needed: ${status.missing.map(({ label }) => label).join(", ")}.`, tone: "warning" });
      return;
    }
    try {
      const result = await submit.mutateAsync();
      if (result.outcome === "no-open-posting") notifyApplicant({ title: "All Documents Saved!", description: "Your documents are saved. There is no open recruitment right now.", tone: "warning" });
      else notifyApplicant({ title: "All Documents Saved!", description: "Your files have been saved to your portal." });
    } catch (cause) {
      notifyApplicant({ title: "Application not submitted", description: errorText(cause, "Please try again."), tone: "error" });
    }
  }

  if (documents.isLoading) return <LoadingState label="Loading documents…" />;
  if (documents.error) return <p className="text-sm text-red-600" role="alert">{documents.error.message}</p>;

  const status = requiredDocumentStatus(documents.data);

  return (
    <div className="mx-auto max-w-[1000px]">
      {/* DOCUMENTS TAB HEADER */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-700 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_50%,#030712_100%)] p-7 text-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.2)]">
        <div className="min-w-[240px] flex-1">
          <span className="rounded-full border border-blue-400/30 bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300 uppercase">Requirements Verification</span>
          <h1 className="mt-1 text-xl font-bold">Required Documents</h1>
          <p className="mt-0.5 text-xs text-slate-300">Upload all required documents (up to 10 MB each). The 2×2 picture must be PNG or JPEG; all other documents must be PDF files.</p>
        </div>
        <div className="w-[220px] shrink-0 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-center">
          <div className="flex justify-between text-[11px] font-bold text-slate-300">
            <span>Status</span>
            <span className="text-emerald-400">{status.saved} of {status.total}</span>
          </div>
          <div aria-label={`${status.saved} of ${status.total} required documents saved`} aria-valuemax={status.total} aria-valuemin={0} aria-valuenow={status.saved} className="my-2 h-1.5 overflow-hidden rounded-full bg-slate-800" role="progressbar">
            <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${(status.saved / status.total) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* DOCUMENT CARDS GRID */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
        {APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, label, accept, formatLine }) => {
          const document = documents.data?.find((item) => item.kind === kind);
          const headingId = `document-${kind}-title`;
          const isImage = kind === "photo";
          return (
            <section aria-labelledby={headingId} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]" key={kind}>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase" id={headingId}>
                    {label} <span aria-hidden="true" className="text-red-500">*</span>
                  </h2>
                  {document ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <Check aria-hidden="true" className="size-2.5" /> Saved
                    </span>
                  ) : null}
                </div>
                <div className="mb-3 text-[11px] text-slate-400">{formatLine}</div>

                {document ? (
                  <div className="mb-3.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className={cn("flex size-[38px] shrink-0 items-center justify-center rounded-lg", isImage ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600")}>
                        {isImage ? <ImageIcon aria-hidden="true" className="size-[18px]" /> : <FileText aria-hidden="true" className="size-[18px]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-slate-900">{document.file_name}</div>
                        <div className="text-[10px] text-slate-400">Saved {formatDate(document.updated_at)} • {formatSize(document.size_bytes)}</div>
                      </div>
                    </div>
                    <button aria-label={`View ${label}`} className="rounded p-1 text-blue-600 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => void openDocument(document.object_path)} title={isImage ? "View Image" : "View Document"} type="button">
                      <Eye aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="mb-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-[11px] font-medium text-slate-400">Not uploaded yet</div>
                )}
              </div>

              {/* ACTION BUTTONS ROW */}
              <div className="mt-1 flex items-center gap-2.5">
                <label
                  className={cn(
                    "inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-800 transition-all hover:border-slate-400 hover:bg-slate-200 hover:text-slate-900 focus-within:ring-2 focus-within:ring-blue-600",
                    busy && "pointer-events-none opacity-60",
                  )}
                >
                  <CloudUpload aria-hidden="true" className="size-4" />
                  <span>{uploading === kind ? "Uploading…" : isImage ? "Upload Photo" : "Upload Document"}</span>
                  <input
                    accept={accept}
                    aria-label={`Upload ${label}`}
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => { void upload(kind, event.target.files?.[0]); event.target.value = ""; }}
                    type="file"
                  />
                </label>
                <button
                  aria-label={`Delete ${label}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-600 transition-all hover:border-red-300 hover:bg-red-100 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!document || busy}
                  onClick={() => void deleteDocument(kind, label)}
                  title={isImage ? "Delete Photo" : "Delete Document"}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          className="inline-flex items-center gap-2 rounded-[10px] bg-blue-700 px-7 py-3 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(29,78,216,0.25)] transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submit.isPending}
          onClick={() => void saveAll()}
          type="button"
        >
          <Save aria-hidden="true" className="size-4" /> {submit.isPending ? "Saving…" : "Save All Documents"}
        </button>
      </div>
    </div>
  );
}
