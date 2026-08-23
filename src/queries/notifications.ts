import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Notification, PaginatedResult } from "@/lib/types/database";
import {
  notificationFiltersSchema,
  type NotificationFilters,
} from "@/schemas/notifications";
import { uuidSchema } from "@/schemas/common";

type SupabaseError = { message: string } | null;

function throwIfError(error: SupabaseError) {
  if (error) throw new Error(error.message);
}

function notificationFilters(input: Partial<NotificationFilters> = {}) {
  return notificationFiltersSchema.parse(input);
}

export async function listNotifications(
  input: Partial<NotificationFilters> = {},
): Promise<PaginatedResult<Notification, NotificationFilters>> {
  const filters = notificationFilters(input);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { data, error, count } = await createBrowserSupabaseClient()
    .from("notifications")
    .select("id, recipient_user_id, type, title, body, link, read_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  throwIfError(error);
  return { rows: (data ?? []) as Notification[], count: count ?? 0, filters };
}

export async function getUnreadNotificationCount() {
  const { count, error } = await createBrowserSupabaseClient()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  throwIfError(error);
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const targetNotificationId = uuidSchema.parse(notificationId);
  const { error } = await createBrowserSupabaseClient().rpc("mark_notification_read", {
    target_notification_id: targetNotificationId,
  });
  throwIfError(error);
}

export async function markAllNotificationsRead() {
  const { error } = await createBrowserSupabaseClient().rpc("mark_all_notifications_read");
  throwIfError(error);
}
