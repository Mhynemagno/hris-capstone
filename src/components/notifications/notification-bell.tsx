"use client";

import { Bell } from "lucide-react";
import Link from "next/link";

import { useUnreadNotificationCount } from "@/hooks/use-notifications";

import { buttonVariants } from "@/components/ui/button";

export function NotificationBell() {
  const { data: unreadCount, isError, isLoading } = useUnreadNotificationCount();
  const count = !isLoading && !isError ? (unreadCount ?? 0) : 0;
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";

  return (
    <Link
      aria-label={label}
      className={buttonVariants({ className: "relative", size: "icon", variant: "ghost" })}
      href="/notifications"
    >
      <Bell aria-hidden="true" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-brand-command-red px-1 text-xs font-semibold leading-5 text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
