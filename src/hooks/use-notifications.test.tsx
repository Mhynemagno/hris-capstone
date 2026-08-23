import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const notificationId = "123e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("@/queries/notifications", () => ({
  getUnreadNotificationCount: vi.fn(),
  listNotifications: vi.fn(),
  markAllNotificationsRead: mocks.markAllNotificationsRead,
  markNotificationRead: mocks.markNotificationRead,
}));

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "./use-notifications";

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("notification hooks", () => {
  it("refreshes inboxes and the unread count after either read mutation", async () => {
    mocks.markNotificationRead.mockResolvedValue(undefined);
    mocks.markAllNotificationsRead.mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = createWrapper(queryClient);
    const { result: singleResult } = renderHook(() => useMarkNotificationRead(), { wrapper });
    const { result: allResult } = renderHook(() => useMarkAllNotificationsRead(), { wrapper });

    await singleResult.current.mutateAsync(notificationId);
    await allResult.current.mutateAsync();

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications", "inbox"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications", "unread-count"] });
  });
});
