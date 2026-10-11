"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Check, Megaphone, Send, SquarePen, Trash2, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { LoadingState } from "@/components/ui/loading-state";
import { StaffInput, StaffLabel, StaffSelect, staffInputClass } from "@/components/staff-shell/ui/staff-fields";
import { useDeleteAnnouncement, useHrAnnouncements, useSaveAnnouncement, useSetAnnouncementStatus } from "@/hooks/use-public-site";
import type { Announcement, AnnouncementCategory } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { ANNOUNCEMENT_CATEGORIES, announcementSchema } from "@/schemas/public-site";

import { MarkupToolbar } from "./markup-toolbar";

export type AnnouncementModalMode = { kind: "create" } | { kind: "edit"; id: string };
type Errors = Partial<Record<"title" | "category" | "summary" | "body" | "form", string>>;

const BODY_ID = "announcement-body";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-[10px] font-bold text-rose-500" role="alert">{message}</p> : null;
}

function AnnouncementForm({ announcement, onClose }: { announcement?: Announcement; onClose: () => void }) {
  const save = useSaveAnnouncement();
  const setStatus = useSetAnnouncementStatus();
  const remove = useDeleteAnnouncement();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [category, setCategory] = useState<AnnouncementCategory>(announcement?.category ?? "news");
  const [summary, setSummary] = useState(announcement?.summary ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [publish, setPublish] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const pending = save.isPending || setStatus.isPending || remove.isPending;
  const creating = !announcement;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = announcementSchema.safeParse({ title, category, summary, body });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0]) as keyof Errors] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const saved = await save.mutateAsync(announcement ? { input: parsed.data, announcementId: announcement.id } : { input: parsed.data });
      if (creating && publish) {
        try {
          await setStatus.mutateAsync({ announcementId: saved.id, status: "published" });
        } catch (cause) {
          // The draft exists now; close so a retry cannot create a second copy.
          notifyStaff({ title: "Saved as a draft; publishing failed", description: cause instanceof Error ? cause.message : "Publish it from the list.", tone: "warning" });
          onClose();
          return;
        }
      }
      notifyStaff({ title: creating ? (publish ? "Announcement published" : "Draft saved") : "Announcement updated" });
      onClose();
    } catch (cause) {
      setErrors({ form: cause instanceof Error ? cause.message : "The announcement could not be saved." });
    }
  }

  async function deleteAnnouncement() {
    if (!announcement || pending || !window.confirm("Delete this announcement?")) return;
    try {
      await remove.mutateAsync(announcement.id);
      notifyStaff({ title: "Announcement deleted" });
      onClose();
    } catch (cause) {
      setErrors({ form: cause instanceof Error ? cause.message : "The announcement could not be deleted." });
    }
  }

  return (
    <form noValidate onSubmit={submit}>
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem]">
          <div className="space-y-1">
            <StaffLabel htmlFor="announcement-title" required={creating}>Title</StaffLabel>
            <StaffInput id="announcement-title" maxLength={150} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Oplan Bisita Eskwela (BES)" value={title} />
            <FieldError message={errors.title} />
          </div>
          <div className="space-y-1">
            <StaffLabel htmlFor="announcement-category" required={creating}>Category</StaffLabel>
            <StaffSelect id="announcement-category" onChange={(event) => setCategory(event.target.value as AnnouncementCategory)} value={category}>
              {ANNOUNCEMENT_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </StaffSelect>
          </div>
        </div>
        <div className="space-y-1">
          <StaffLabel htmlFor="announcement-summary" required={creating}>Summary</StaffLabel>
          <StaffInput id="announcement-summary" maxLength={300} onChange={(event) => setSummary(event.target.value)} placeholder="One or two sentences shown on the landing page card." value={summary} />
          <p className="text-[10px] text-slate-500">Short summary for quick preview on the public dashboard.</p>
          <FieldError message={errors.summary} />
        </div>
        <div className="space-y-1">
          <StaffLabel htmlFor={BODY_ID} required={creating}>Announcement Text</StaffLabel>
          <MarkupToolbar onChange={setBody} textareaId={BODY_ID} textareaRef={bodyRef} value={body} />
          <textarea
            className={cn(staffInputClass, "resize-y rounded-t-none")}
            id={BODY_ID}
            maxLength={10_000}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write full details here. Leave a blank line between paragraphs."
            ref={bodyRef}
            rows={8}
            value={body}
          />
          <FieldError message={errors.body} />
        </div>
        {errors.form ? <p className="text-xs font-bold text-rose-600" role="alert">{errors.form}</p> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
        {creating ? (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input checked={publish} className="size-4 accent-blue-900" onChange={(event) => setPublish(event.target.checked)} type="checkbox" />
            Publish immediately
          </label>
        ) : (
          <button className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60" disabled={pending} onClick={() => void deleteAnnouncement()} type="button">
            <Trash2 aria-hidden="true" className="size-3.5" /> Delete
          </button>
        )}
        <div className="flex items-center gap-2">
          <button className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200" onClick={onClose} type="button">Cancel</button>
          {creating ? (
            <button className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60" disabled={pending} type="submit">
              <Send aria-hidden="true" className="size-3.5 text-amber-400" /> Save Announcement
            </button>
          ) : (
            <button className="flex items-center gap-1.5 rounded-xl bg-blue-950 px-4 py-2 text-xs font-bold text-white hover:bg-blue-900 disabled:opacity-60" disabled={pending} type="submit">
              <Check aria-hidden="true" className="size-3.5 text-amber-400" /> Update Changes
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

/** Create / edit announcement modal (PDF pp. 35–36): navy header, the toolbar editor, publish or delete. */
export function AnnouncementModal({ mode, onClose }: { mode: AnnouncementModalMode | null; onClose: () => void }) {
  const announcements = useHrAnnouncements();
  const editing = mode?.kind === "edit" ? (announcements.data ?? []).find((row) => row.id === mode.id) : undefined;
  const title = mode?.kind === "edit" ? "Edit Announcement" : "Create New Announcement";
  const Icon = mode?.kind === "edit" ? SquarePen : Megaphone;
  return (
    <Dialog.Root onOpenChange={(next) => { if (!next) onClose(); }} open={mode !== null}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" />
        <Dialog.Popup className="capstone-ui fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white font-sans text-slate-800 shadow-2xl">
          <div className="flex items-center justify-between bg-[#0B132B] px-6 py-4">
            <Dialog.Title className="flex items-center gap-2 text-sm font-bold tracking-wider text-white uppercase">
              <Icon aria-hidden="true" className="size-4 text-amber-400" /> {title}
            </Dialog.Title>
            <Dialog.Close aria-label="Close" className="rounded p-1 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"><X aria-hidden="true" className="size-4" /></Dialog.Close>
          </div>
          {mode?.kind === "edit" && announcements.isLoading ? (
            <div className="p-6"><LoadingState label="Loading announcement…" /></div>
          ) : mode?.kind === "edit" && !editing ? (
            <div className="space-y-4 p-6">
              <p className="text-xs font-semibold text-slate-600">This announcement could not be found.</p>
              <button className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200" onClick={onClose} type="button">Cancel</button>
            </div>
          ) : mode ? (
            <AnnouncementForm announcement={editing} key={editing?.id ?? "new"} onClose={onClose} />
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
