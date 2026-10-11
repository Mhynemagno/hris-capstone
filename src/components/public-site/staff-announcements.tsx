"use client";

import { Megaphone, Plus, SquarePen } from "lucide-react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePanelParam } from "@/hooks/use-panel-param";
import { useHrAnnouncements, useHrContacts, useSetAnnouncementStatus } from "@/hooks/use-public-site";
import { formatDate } from "@/lib/format-date";
import { stripAnnouncementMarkup } from "@/lib/public-site/announcement-markup";
import type { Announcement, AnnouncementCategory } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { announcementCategoryLabel } from "@/schemas/public-site";

import { AnnouncementModal } from "./announcement-modal";
import { HrContactsPanel } from "./hr-contacts-panel";

const CATEGORY_STYLE: Record<AnnouncementCategory, { accent: string; badge: string }> = {
  news: { accent: "border-l-blue-900", badge: "bg-slate-100 text-slate-600" },
  advisory: { accent: "border-l-amber-500", badge: "bg-amber-50 text-amber-700 border border-amber-200" },
  event: { accent: "border-l-blue-500", badge: "bg-blue-50 text-blue-700 border border-blue-200" },
  recruitment: { accent: "border-l-emerald-500", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

function AnnouncementCard({ announcement, onEdit, onStatus, busy }: { announcement: Announcement; onEdit: () => void; onStatus: (status: "published" | "archived") => void; busy: boolean }) {
  const archived = announcement.status === "archived";
  const style = CATEGORY_STYLE[announcement.category];
  const dateLine = announcement.published_at ? `First published ${formatDate(announcement.published_at)}` : `Draft saved ${formatDate(announcement.updated_at)}`;
  return (
    <article className={cn("flex flex-col justify-between gap-3 rounded-xl border border-l-4 border-slate-200 p-4 shadow-sm transition-all hover:border-slate-300 sm:flex-row sm:items-start", archived ? "border-l-slate-400 bg-slate-50/80" : cn("bg-white", style.accent))}>
      <div className={cn("max-w-2xl min-w-0 space-y-1.5", archived && "opacity-75")}>
        <div className="flex flex-wrap items-center gap-2">
          {announcement.status === "published" ? <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase"><span aria-hidden="true">● </span>Published</span>
            : archived ? <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">Archived</span>
              : <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">Draft</span>}
          <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", archived ? "bg-slate-100 text-slate-600" : style.badge)}>{announcementCategoryLabel(announcement.category)}</span>
          <span className="ml-1 text-[11px] text-slate-500">{dateLine}</span>
        </div>
        <h3 className={cn("text-sm font-bold", archived ? "text-slate-800" : "text-slate-900")}>{announcement.title}</h3>
        <p className="line-clamp-1 text-xs text-slate-500">{stripAnnouncementMarkup(announcement.summary)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button aria-label={`Edit ${announcement.title}`} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors", archived ? "border border-slate-200 bg-white hover:bg-slate-100" : "bg-slate-100 hover:bg-slate-200")} onClick={onEdit} type="button">
          {archived ? null : <SquarePen aria-hidden="true" className="size-3.5" />} Edit
        </button>
        {announcement.status === "published" ? (
          <button aria-label={`Archive ${announcement.title}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60" disabled={busy} onClick={() => onStatus("archived")} type="button">Archive</button>
        ) : (
          <button aria-label={`Publish ${announcement.title}`} className="rounded-lg bg-blue-950 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-900 disabled:opacity-60" disabled={busy} onClick={() => onStatus("published")} type="button">Publish</button>
        )}
      </div>
    </article>
  );
}

/** Announcements & Public Content (Capstone UI announcements.html, PDF pp. 35–37). */
export function StaffAnnouncements() {
  const [tab, setTab] = usePanelParam("tab");
  const [creating, setCreating] = usePanelParam("new");
  const [editing, setEditing] = usePanelParam("edit");
  const announcements = useHrAnnouncements();
  const contacts = useHrContacts();
  const setStatus = useSetAnnouncementStatus();
  const rows = announcements.data ?? [];
  const activeCount = rows.filter((row) => row.status !== "archived").length;
  const onContacts = tab === "contacts";

  async function changeStatus(announcement: Announcement, status: "published" | "archived") {
    try {
      await setStatus.mutateAsync({ announcementId: announcement.id, status });
      notifyStaff({ title: status === "published" ? "Announcement published" : "Announcement archived" });
    } catch (cause) {
      notifyStaff({ title: "Could not change the announcement", description: cause instanceof Error ? cause.message : undefined, tone: "error" });
    }
  }

  const tabClass = (active: boolean) => cn("flex items-center gap-2 pb-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", active ? "border-b-2 border-blue-900 text-blue-900" : "text-slate-500 hover:text-slate-800");
  const mode = creating === "1" ? { kind: "create" as const } : editing ? { kind: "edit" as const, id: editing } : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900"><Megaphone aria-hidden="true" className="size-5 text-blue-900" /> Announcements &amp; Public Content</h1>
          <p className="mt-0.5 text-xs text-slate-500">Manage public landing page notices, news, and official station emergency contacts.</p>
        </div>
        <button className="flex items-center gap-2 self-start rounded-xl bg-blue-950 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:self-auto" onClick={() => setCreating("1")} type="button">
          <Plus aria-hidden="true" className="size-2.5" /> New Announcement
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-6 border-b border-slate-200 text-xs font-semibold" role="tablist">
          <button aria-label={`Announcements ${rows.length}`} aria-selected={!onContacts} className={tabClass(!onContacts)} onClick={() => setTab(null)} role="tab" type="button">
            Announcements <span className={cn("rounded-full px-2 py-0.5 text-[10px]", !onContacts ? "bg-blue-50 text-blue-900" : "bg-slate-100 text-slate-600")}>{rows.length}</span>
          </button>
          <button aria-label={`Station Contacts ${contacts.data?.length ?? 0}`} aria-selected={onContacts} className={tabClass(onContacts)} onClick={() => setTab("contacts")} role="tab" type="button">
            Station Contacts <span className={cn("rounded-full px-2 py-0.5 text-[10px]", onContacts ? "bg-blue-50 text-blue-900" : "bg-slate-100 text-slate-600")}>{contacts.data?.length ?? 0}</span>
          </button>
        </div>
        {!onContacts ? <span className="text-[11px] text-slate-500">Showing {activeCount} active entries</span> : null}
      </div>

      {onContacts ? (
        <div className="workspace rounded-2xl border border-slate-200 bg-white p-5 text-foreground" role="tabpanel"><HrContactsPanel /></div>
      ) : (
        <div className="space-y-3" role="tabpanel">
          {announcements.isLoading ? <LoadingState label="Loading announcements…" /> : announcements.error ? <ErrorState message={announcements.error.message} /> : rows.length ? rows.map((announcement) => (
            <AnnouncementCard announcement={announcement} busy={setStatus.isPending} key={announcement.id} onEdit={() => setEditing(announcement.id)} onStatus={(status) => void changeStatus(announcement, status)} />
          )) : <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-xs text-slate-500">No announcements yet. Choose New Announcement to write the first one.</p>}
        </div>
      )}

      <AnnouncementModal mode={mode} onClose={() => { if (creating) setCreating(null); if (editing) setEditing(null); }} />
    </div>
  );
}
