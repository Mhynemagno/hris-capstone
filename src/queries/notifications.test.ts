import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationId = "123e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications";

type Result = { data: unknown; error: { message: string } | null; count?: number | null };

function createChain(result: Result) {
  const chain = {
    is: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
  };
  Object.values(chain).forEach((method) => method.mockReturnValue(chain));
  chain.range.mockResolvedValue(result);
  chain.is.mockResolvedValue(result);
  return chain;
}

describe("notification queries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lists the requested newest-first notification page", async () => {
    const chain = createChain({
      data: [{
        id: notificationId,
        recipient_user_id: notificationId,
        type: "profile_change_decision",
        title: "Profile updated",
        body: "Approved.",
        link: "/employee/profile",
        read_at: null,
        created_at: "2026-08-23T00:00:00.000Z",
      }],
      count: 21,
      error: null,
    });
    mocks.from.mockReturnValue(chain);

    await expect(listNotifications({ page: 2, pageSize: 20 })).resolves.toMatchObject({
      count: 21,
      filters: { page: 2, pageSize: 20 },
    });

    expect(mocks.from).toHaveBeenCalledWith("notifications");
    expect(chain.select).toHaveBeenCalledWith("id, recipient_user_id, type, title, body, link, read_at, created_at", { count: "exact" });
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(chain.range).toHaveBeenCalledWith(20, 39);
  });

  it("counts unread notifications without fetching their rows", async () => {
    const chain = createChain({ data: null, count: 3, error: null });
    mocks.from.mockReturnValue(chain);

    await expect(getUnreadNotificationCount()).resolves.toBe(3);

    expect(chain.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(chain.is).toHaveBeenCalledWith("read_at", null);
  });

  it("uses narrow read-state RPCs and surfaces their errors", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Access denied" } });

    await expect(markNotificationRead(notificationId)).resolves.toBeUndefined();
    await expect(markAllNotificationsRead()).resolves.toBeUndefined();
    await expect(markNotificationRead(notificationId)).rejects.toThrow("Access denied");

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "mark_notification_read", { target_notification_id: notificationId });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "mark_all_notifications_read");
  });
});
