"use client";

import { ArrowRight, Bell, Check, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { notifyApplicant } from "@/components/app-shell/applicant-toaster";
import {
  useDeleteAllNotifications,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

/** "now", "10m ago", "2h ago", "1d ago" — as in the Capstone UI notification drawer. */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Capstone UI notifapp.html: the bell opens the notifications in place (All / Unread, mark read,
 * delete, mark all as read, clear all) instead of navigating to another page.
 */
export function NotificationDrawer({ onError = (title, description) => notifyApplicant({ title, description, tone: "error" }) }: { onError?: (title: string, description: string) => void } = {}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const unread = useUnreadNotificationCount();
  const notifications = useNotifications({ pageSize: PAGE_SIZE });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const deleteOne = useDeleteNotification();
  const clearAll = useDeleteAllNotifications();

  const unreadCount = !unread.isLoading && !unread.isError ? (unread.data ?? 0) : 0;
  const rows = notifications.data?.rows ?? [];
  const total = notifications.data?.count ?? rows.length;
  const failed = (title: string) => ({ onError: (error: Error) => onError(title, error.message) });

  function openPanel() {
    setOpen(true);
    // New notifications (e.g. right after Save All Documents) appear without a page reload.
    void notifications.refetch();
  }
  const visible = filter === "unread" ? rows.filter((row) => !row.read_at) : rows;

  function close({ returnFocus = true } = {}) {
    setOpen(false);
    if (returnFocus) bellRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      bellRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative rounded-full p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        onClick={() => (open ? close() : openPanel())}
        ref={bellRef}
        type="button"
      >
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-[#0F172A]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          aria-labelledby={headingId}
          className="capstone-ui absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl sm:w-96"
          role="dialog"
        >
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 p-3.5 text-white">
            <div className="flex items-center gap-2">
              <Bell aria-hidden="true" className="size-3 text-blue-400" />
              <h3 className="text-xs font-bold tracking-wider uppercase outline-none" id={headingId} ref={headingRef} tabIndex={-1}>Notifications</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-blue-700/50 bg-blue-900 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                {unreadCount} Unread
              </span>
              <button aria-label="Close notifications" className="rounded p-1 text-xs text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => close()} type="button">
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600" role="tablist">
            {(["all", "unread"] as const).map((tab) => (
              <button
                aria-selected={filter === tab}
                className={cn(
                  "flex-1 border-b-2 py-2 text-center focus:outline-none focus-visible:bg-white",
                  filter === tab ? "border-blue-600 bg-white text-blue-600" : "border-transparent hover:text-slate-900",
                )}
                key={tab}
                onClick={() => setFilter(tab)}
                role="tab"
                type="button"
              >
                {tab === "all" ? "All" : "Unread"}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">No notifications available</p>
          ) : (
            <ul className="max-h-[340px] divide-y divide-slate-100 overflow-y-auto">
              {visible.map((row) => {
                const isUnread = !row.read_at;
                return (
                  <li className={cn("relative p-3.5 transition-colors", isUnread ? "bg-blue-50/50 hover:bg-blue-50" : "bg-white hover:bg-slate-50")} key={row.id}>
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-bold", isUnread ? "text-blue-800" : "text-slate-800")}>
                        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", isUnread ? "bg-blue-600" : "bg-slate-300")} />
                        {row.title}
                        {isUnread ? <span className="sr-only"> (unread)</span> : null}
                      </span>
                      <span className="shrink-0 text-[10px] font-medium text-slate-500">{timeAgo(row.created_at)}</span>
                    </div>
                    <p className="mb-2 text-xs leading-relaxed text-slate-600">{row.body}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      {row.link ? (
                        <Link className="flex items-center gap-1 font-semibold text-blue-700 hover:underline" href={row.link} onClick={() => { if (isUnread) markRead.mutate(row.id, failed("Notification not updated")); close({ returnFocus: false }); }}>
                          <span>View details</span>
                          <ArrowRight aria-hidden="true" className="size-2.5" />
                        </Link>
                      ) : (
                        <span className="text-[10px] text-slate-500">System Notification</span>
                      )}
                      <div className="flex items-center gap-2 text-slate-400">
                        {isUnread ? (
                          <button aria-label={`Mark ${row.title} as read`} className="rounded hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => markRead.mutate(row.id, failed("Notification not updated"))} title="Mark as read" type="button">
                            <Check aria-hidden="true" className="size-3.5" />
                          </button>
                        ) : null}
                        <button aria-label={`Delete ${row.title}`} className="rounded hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400" onClick={() => deleteOne.mutate(row.id, failed("Notification not deleted"))} title="Delete" type="button">
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-2.5 px-4 text-center">
            <button className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-900" onClick={() => markAll.mutate(undefined, failed("Notifications not updated"))} type="button">
              Mark all as read
            </button>
            {total > rows.length ? (
              <Link className="text-xs font-semibold text-blue-700 hover:underline" href="/notifications" onClick={() => close({ returnFocus: false })}>View all</Link>
            ) : null}
            <button
              className="text-xs font-medium text-red-600 transition-colors hover:text-red-800"
              onClick={() => { if (window.confirm("Clear all notifications?")) clearAll.mutate(undefined, failed("Notifications not cleared")); }}
              type="button"
            >
              Clear all
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
