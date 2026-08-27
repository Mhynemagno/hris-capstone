"use client";

import Link from "next/link";
import { useState } from "react";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/use-notifications";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

const pageSize = 20;

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotificationInbox() {
  const [page, setPage] = useState(1);
  const notifications = useNotifications({ page, pageSize });
  const unread = useUnreadNotificationCount();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const notificationPage = notifications.data;
  const unreadCount = unread.data ?? 0;
  const mutationError = markOne.error ?? markAll.error;

  return (
    <section aria-labelledby="notifications-heading" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 id="notifications-heading" className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="max-w-2xl text-muted-foreground">Review your HRIS updates and decisions.</p>
        </div>
        <Button
          disabled={unreadCount === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          Mark all as read
        </Button>
      </div>

      {mutationError ? <ErrorState message={mutationError.message} /> : null}
      {notifications.isLoading ? <LoadingState label="Loading notifications" /> : null}
      {notifications.isError ? <ErrorState message={`${notifications.error.message} Please try again.`} /> : null}
      {notificationPage && notificationPage.rows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-muted-foreground">You have no notifications.</p>
          </CardContent>
        </Card>
      ) : null}
      {notificationPage?.rows.length ? (
        <div className="space-y-3">
          {notificationPage.rows.map((notification) => (
            <Card key={notification.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{notification.title}</CardTitle>
                    <time dateTime={notification.created_at} className="text-sm text-muted-foreground">
                      {formatNotificationDate(notification.created_at)}
                    </time>
                  </div>
                  {notification.read_at ? null : <Badge variant="secondary">Unread</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground">{notification.body}</p>
              </CardContent>
              <CardFooter className="justify-between gap-3">
                {notification.link ? (
                  <Link aria-label={`View details for ${notification.title}`} className={buttonVariants({ variant: "link" })} href={notification.link}>
                    View details
                  </Link>
                ) : <span />}
                {notification.read_at ? null : (
                  <Button
                    disabled={markOne.isPending}
                    variant="secondary"
                    onClick={() => markOne.mutate(notification.id)}
                  >
                    {`Mark ${notification.title} as read`}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : null}

      {notificationPage && notificationPage.count > 0 ? (
        <div className="flex items-center justify-end gap-3">
          <Button disabled={page === 1} variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous page
          </Button>
          <Button disabled={page * pageSize >= notificationPage.count} variant="outline" onClick={() => setPage((current) => current + 1)}>
            Next page
          </Button>
        </div>
      ) : null}
    </section>
  );
}
