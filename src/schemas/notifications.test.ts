import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-keys";

import {
  notificationCreateSchema,
  notificationFiltersSchema,
} from "./notifications";

describe("notification schemas", () => {
  it("normalizes notification content and accepts only safe internal links", () => {
    expect(notificationCreateSchema.parse({
      recipientUserId: "123e4567-e89b-42d3-a456-426614174000",
      type: "profile_change_decision",
      title: " Profile updated ",
      body: " Your request was approved. ",
      link: " /employee/profile ",
    })).toEqual({
      recipientUserId: "123e4567-e89b-42d3-a456-426614174000",
      type: "profile_change_decision",
      title: "Profile updated",
      body: "Your request was approved.",
      link: "/employee/profile",
    });
  });

  it("rejects unsafe notification content and links", () => {
    const base = {
      recipientUserId: "123e4567-e89b-42d3-a456-426614174000",
      title: "Profile updated",
      body: "Your request was approved.",
    };

    expect(notificationCreateSchema.safeParse({ ...base, type: "bad type" }).success).toBe(false);
    expect(notificationCreateSchema.safeParse({ ...base, type: "update", link: "https://example.com" }).success).toBe(false);
    expect(notificationCreateSchema.safeParse({ ...base, type: "update", link: "//example.com" }).success).toBe(false);
    expect(notificationCreateSchema.safeParse({ ...base, type: "update", link: "/\\example.com" }).success).toBe(false);
  });

  it("bounds inbox filters and gives notifications stable cache keys", () => {
    expect(notificationFiltersSchema.parse({ page: "2", pageSize: "500" })).toEqual({ page: 2, pageSize: 100 });
    expect(queryKeys.notifications.inbox({ page: 2, pageSize: 20 })).toEqual([
      "notifications",
      "inbox",
      { page: 2, pageSize: 20 },
    ]);
    expect(queryKeys.notifications.unreadCount()).toEqual(["notifications", "unread-count"]);
  });
});
