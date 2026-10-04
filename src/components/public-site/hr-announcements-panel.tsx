"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { useDeleteAnnouncement, useHrAnnouncements, useSetAnnouncementStatus } from "@/hooks/use-public-site";
import { formatDate } from "@/lib/format-date";
import { ANNOUNCEMENT_STATUS_LABELS, announcementCategoryLabel } from "@/schemas/public-site";

import { HrAnnouncementForm } from "./hr-announcement-form";

export function HrAnnouncementsPanel() {
  const announcements = useHrAnnouncements();
  const setStatus = useSetAnnouncementStatus();
  const remove = useDeleteAnnouncement();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = setStatus.isPending || remove.isPending;

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice(null);
    setActionError(null);
    try {
      await action();
      setNotice(success);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The change could not be saved.");
    }
  }

  function finishEditing(message: string) {
    setEditing(null);
    setActionError(null);
    setNotice(message);
  }

  if (announcements.isLoading) return <LoadingState label="Loading announcements…" />;
  if (announcements.error) return <ErrorState message={announcements.error.message} />;
  const rows = announcements.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-base text-muted-foreground">Published announcements appear on the public landing page, newest first. The page shows the six newest.</p>
        {editing !== "new" ? (
          <Button onClick={() => { setEditing("new"); setNotice(null); }} type="button">
            <Plus aria-hidden="true" />
            New announcement
          </Button>
        ) : null}
      </div>
      <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
      {actionError ? <ErrorState message={actionError} /> : null}
      {editing === "new" ? <HrAnnouncementForm onCancel={() => setEditing(null)} onSaved={finishEditing} /> : null}
      {!rows.length && editing !== "new" ? (
        <StatusPanel description="Create an announcement, then publish it to show it on the public landing page." kind="empty" title="No announcements yet" />
      ) : null}
      <ul className="space-y-3">
        {rows.map((announcement) => (
          <li key={announcement.id}>
            {editing === announcement.id ? (
              <HrAnnouncementForm announcement={announcement} onCancel={() => setEditing(null)} onSaved={finishEditing} />
            ) : (
              <article aria-labelledby={`hr-announcement-${announcement.id}`} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={announcement.status === "published" ? "default" : "outline"}>{ANNOUNCEMENT_STATUS_LABELS[announcement.status]}</Badge>
                    <span className="text-sm text-muted-foreground">{announcementCategoryLabel(announcement.category)}</span>
                  </div>
                  <h3 className="text-lg font-semibold [overflow-wrap:anywhere]" id={`hr-announcement-${announcement.id}`}>{announcement.title}</h3>
                  <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{announcement.summary}</p>
                  <p className="text-sm text-muted-foreground">
                    {announcement.published_at ? `First published ${formatDate(announcement.published_at)}` : `Last updated ${formatDate(announcement.updated_at)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button aria-label={`Edit ${announcement.title}`} disabled={busy} onClick={() => { setEditing(announcement.id); setNotice(null); }} type="button" variant="outline">Edit</Button>
                  {announcement.status !== "published" ? (
                    <Button
                      aria-label={`Publish ${announcement.title}`}
                      disabled={busy}
                      onClick={() => void run(() => setStatus.mutateAsync({ announcementId: announcement.id, status: "published" }), `${announcement.title} is now published on the landing page.`)}
                      type="button"
                    >
                      Publish
                    </Button>
                  ) : (
                    <Button
                      aria-label={`Archive ${announcement.title}`}
                      disabled={busy}
                      onClick={() => void run(() => setStatus.mutateAsync({ announcementId: announcement.id, status: "archived" }), `${announcement.title} was archived and no longer appears on the landing page.`)}
                      type="button"
                      variant="outline"
                    >
                      Archive
                    </Button>
                  )}
                  {announcement.status === "draft" && confirmingDeleteId !== announcement.id ? (
                    <Button aria-label={`Delete ${announcement.title}`} disabled={busy} onClick={() => setConfirmingDeleteId(announcement.id)} type="button" variant="destructive">Delete</Button>
                  ) : null}
                </div>
                {confirmingDeleteId === announcement.id ? (
                  <div aria-label={`Confirm deleting ${announcement.title}`} className="flex basis-full flex-wrap items-center gap-2" role="group">
                    <p className="text-sm">Delete this draft? This cannot be undone.</p>
                    <Button
                      onClick={() => {
                        setConfirmingDeleteId(null);
                        void run(() => remove.mutateAsync(announcement.id), `${announcement.title} was deleted.`);
                      }}
                      type="button"
                      variant="destructive"
                    >
                      Confirm delete
                    </Button>
                    <Button onClick={() => setConfirmingDeleteId(null)} type="button" variant="outline">Keep draft</Button>
                  </div>
                ) : null}
              </article>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
