"use client";

import { Eye, FileText, Image as ImageIcon, Upload } from "lucide-react";
import { useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { useRemovePersonnelDocument, useReplacePersonnelDocument } from "@/hooks/use-personnel-records";
import { formatBytes } from "@/lib/format-bytes";
import { openSignedUrl } from "@/lib/open-signed-url";
import { getPersonnelDocumentUrl, type DocumentKind } from "@/queries/personnel-records";

import { DocumentUploadDialog } from "./document-upload-dialog";

type Entry = {
  id: string;
  employee_id: string;
  name: string;
  document_path?: string | null;
  document_name?: string | null;
  document_mime_type?: string | null;
  document_size_bytes?: number | null;
};

const smallButton = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60";
const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : undefined);

/** The uploaded document on an Eligibility or Certification / Training entry (PDF p. 23), with open, replace and remove. */
export function RecordDocumentRow({ kind, entry, canEdit }: { kind: DocumentKind; entry: Entry; canEdit: boolean }) {
  const replace = useReplacePersonnelDocument(kind, entry.employee_id);
  const remove = useRemovePersonnelDocument(kind, entry.employee_id);
  const [uploading, setUploading] = useState(false);
  const hasDocument = Boolean(entry.document_path && entry.document_name);

  async function save(file: File) {
    try {
      await replace.mutateAsync({ entry: { id: entry.id, employee_id: entry.employee_id, document_path: entry.document_path ?? null }, file });
      notifyStaff({ title: hasDocument ? "Document replaced" : "Document uploaded" });
      setUploading(false);
    } catch (cause) {
      notifyStaff({ title: "Could not save the document", description: errorText(cause), tone: "error" });
    }
  }

  async function removeDocument() {
    if (!entry.document_path || !window.confirm(`Remove the uploaded document for ${entry.name}?`)) return;
    try {
      await remove.mutateAsync({ id: entry.id, document_path: entry.document_path });
      notifyStaff({ title: "Document removed" });
    } catch (cause) {
      notifyStaff({ title: "Could not remove the document", description: errorText(cause), tone: "error" });
    }
  }

  if (!hasDocument && !canEdit) return null;

  return (
    <div className="capstone-ui mt-2">
      {hasDocument ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          {entry.document_mime_type === "application/pdf" ? <FileText aria-hidden="true" className="size-5 text-rose-600" /> : <ImageIcon aria-hidden="true" className="size-5 text-blue-600" />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{entry.document_name}</p>
            {entry.document_size_bytes ? <p className="text-[10px] text-slate-500">{formatBytes(entry.document_size_bytes)}</p> : null}
          </div>
          <button
            aria-label={`Open ${entry.document_name}`}
            className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            onClick={() => void openSignedUrl(() => getPersonnelDocumentUrl(entry.document_path!)).catch((cause) => notifyStaff({ title: "Unable to open the document", description: errorText(cause), tone: "error" }))}
            type="button"
          >
            <Eye aria-hidden="true" className="size-4" />
          </button>
          {canEdit ? (
            <>
              <button className={smallButton} onClick={() => setUploading(true)} type="button">Replace</button>
              <button className={`${smallButton} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`} disabled={remove.isPending} onClick={() => void removeDocument()} type="button">Remove</button>
            </>
          ) : null}
        </div>
      ) : (
        <button className={`${smallButton} inline-flex items-center gap-1.5`} onClick={() => setUploading(true)} type="button">
          <Upload aria-hidden="true" className="size-3.5" /> Upload document
        </button>
      )}
      <DocumentUploadDialog onClose={() => setUploading(false)} onSave={save} open={uploading} saving={replace.isPending} />
    </div>
  );
}
