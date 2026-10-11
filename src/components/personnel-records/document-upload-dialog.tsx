"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CircleX, CloudUpload, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { useState, type DragEvent } from "react";

import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { formatBytes } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";
import { validatePersonnelDocument } from "@/queries/personnel-records";

type Props = { open: boolean; onClose: () => void; onSave: (file: File) => Promise<void> | void; saving: boolean };

/** The "Upload files" dialog from PDF p. 23: a drop zone, the chosen file, then Save document. */
export function DocumentUploadDialog({ open, onClose, onSave, saving }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function choose(next: File | undefined) {
    if (!next) return;
    const problem = validatePersonnelDocument(next);
    setError(problem);
    setFile(problem ? null : next);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  function close() {
    if (saving) return;
    setFile(null);
    setError(null);
    onClose();
  }

  const isPdf = file?.type === "application/pdf";

  return (
    <Dialog.Root onOpenChange={(next) => { if (!next) close(); }} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" />
        <Dialog.Popup className="capstone-ui fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 font-sans text-slate-800 shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-700">
                <CloudUpload className="size-5" />
              </span>
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-900">Upload files</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500">Select and upload the file of your choice.</Dialog.Description>
              </div>
            </div>
            <Dialog.Close aria-label="Close" className="rounded-full text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" disabled={saving}>
              <CircleX aria-hidden="true" className="size-6" />
            </Dialog.Close>
          </div>

          <div
            className={cn("mt-5 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors", dragging ? "border-blue-500 bg-blue-50/40" : "border-slate-300")}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDrop={drop}
          >
            <CloudUpload aria-hidden="true" className="size-7 text-slate-700" />
            <p className="text-sm font-medium text-slate-900">Choose a file or drag &amp; drop it here</p>
            <p className="text-xs text-slate-500">PDF, JPEG, PNG or WEBP formats, up to 10 MB</p>
            <label className="mt-2 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 focus-within:ring-2 focus-within:ring-blue-600 hover:bg-slate-50">
              Browse File
              <input
                accept="application/pdf,image/png,image/jpeg,image/webp"
                aria-label="Browse File"
                className="sr-only"
                disabled={saving}
                onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ""; }}
                type="file"
              />
            </label>
          </div>

          {error ? <p className="mt-3 text-xs font-bold text-rose-600" role="alert">{error}</p> : null}

          {file ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-100 p-3">
              <span aria-hidden="true" className="relative flex size-10 shrink-0 items-center justify-center text-slate-500">
                {isPdf ? <FileText className="size-8" /> : <ImageIcon className="size-8" />}
                {isPdf ? <span className="absolute -bottom-1 -left-1 rounded bg-red-600 px-1 text-[9px] font-bold text-white">PDF</span> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{formatBytes(file.size)}</span>
                  {saving ? <><span aria-hidden="true">•</span><Loader2 aria-hidden="true" className="size-3 animate-spin text-blue-600" /><span>Uploading…</span></> : null}
                </p>
              </div>
              <button aria-label={`Remove ${file.name}`} className="rounded-full text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" disabled={saving} onClick={() => setFile(null)} type="button">
                <CircleX aria-hidden="true" className="size-5" />
              </button>
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <button className={staffButton.secondary} disabled={saving} onClick={close} type="button">Cancel</button>
            <button className={staffButton.primary} disabled={!file || saving} onClick={() => { if (file) void onSave(file); }} type="button">
              {saving ? "Saving…" : "Save document"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
