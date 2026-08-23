"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/queries/notifications";
import {
  notificationFiltersSchema,
  type NotificationFilters,
} from "@/schemas/notifications";

export function useNotifications(input: Partial<NotificationFilters> = {}) {
  const filters = notificationFiltersSchema.parse(input);
  return useQuery({
    queryKey: queryKeys.notifications.inbox(filters),
    queryFn: () => listNotifications(filters),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: getUnreadNotificationCount,
  });
}

function useNotificationInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useNotificationInvalidation();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useNotificationInvalidation();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });
}
