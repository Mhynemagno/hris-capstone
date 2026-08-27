import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markAllMutate: vi.fn(),
  markOneMutate: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
  useMarkNotificationRead: vi.fn(),
  useNotifications: vi.fn(),
  useUnreadNotificationCount: vi.fn(),
}));

vi.mock("@/hooks/use-notifications", () => ({
  useMarkAllNotificationsRead: mocks.useMarkAllNotificationsRead,
  useMarkNotificationRead: mocks.useMarkNotificationRead,
  useNotifications: mocks.useNotifications,
  useUnreadNotificationCount: mocks.useUnreadNotificationCount,
}));

import { NotificationBell } from "./notification-bell";
import { NotificationInbox } from "./notification-inbox";

const notification = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  recipient_user_id: "123e4567-e89b-42d3-a456-426614174000",
  type: "profile_change_decision",
  title: "Profile updated",
  body: "Your request was approved.",
  link: "/employee/profile",
  read_at: null,
  created_at: "2026-08-23T00:00:00.000Z",
};

beforeEach(() => {
  mocks.useUnreadNotificationCount.mockReturnValue({ data: 3, isError: false, isLoading: false });
  mocks.useNotifications.mockReturnValue({
    data: { rows: [notification], count: 21, filters: { page: 1, pageSize: 20 } },
    error: null,
    isError: false,
    isLoading: false,
  });
  mocks.useMarkNotificationRead.mockReturnValue({ error: null, isError: false, isPending: false, mutate: mocks.markOneMutate });
  mocks.useMarkAllNotificationsRead.mockReturnValue({ error: null, isError: false, isPending: false, mutate: mocks.markAllMutate });
  mocks.markOneMutate.mockReset();
  mocks.markAllMutate.mockReset();
});

describe("NotificationBell", () => {
  it("links to the inbox and announces the current unread count", () => {
    render(<NotificationBell />);

    expect(screen.getByRole("link", { name: "Notifications, 3 unread" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByText("3")).toBeVisible();
  });

  it("keeps the inbox available without a misleading unread count while loading or errored", () => {
    mocks.useUnreadNotificationCount.mockReturnValue({ data: undefined, isError: false, isLoading: true });
    const { rerender } = render(<NotificationBell />);

    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
    expect(screen.queryByText("3")).not.toBeInTheDocument();

    mocks.useUnreadNotificationCount.mockReturnValue({ data: undefined, isError: true, isLoading: false });
    rerender(<NotificationBell />);

    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
  });
});

describe("NotificationInbox", () => {
  it("lets the recipient read one item or all unread items without leaving the inbox", async () => {
    const user = userEvent.setup();
    mocks.useUnreadNotificationCount.mockReturnValue({ data: 1, isError: false, isLoading: false });
    render(<NotificationInbox />);

    expect(screen.getByRole("link", { name: "View details for Profile updated" })).toHaveAttribute("href", "/employee/profile");

    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    await user.click(screen.getByRole("button", { name: "Mark Profile updated as read" }));

    expect(mocks.markAllMutate).toHaveBeenCalledTimes(1);
    expect(mocks.markOneMutate).toHaveBeenCalledWith(notification.id);
  });

  it("renders loading, error, empty, and already-read states", () => {
    mocks.useNotifications.mockReturnValue({ data: undefined, error: null, isError: false, isLoading: true });
    const { rerender } = render(<NotificationInbox />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading notifications");

    mocks.useNotifications.mockReturnValue({ data: undefined, error: new Error("Network unavailable"), isError: true, isLoading: false });
    rerender(<NotificationInbox />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable");

    mocks.useNotifications.mockReturnValue({ data: { rows: [], count: 0, filters: { page: 1, pageSize: 20 } }, error: null, isError: false, isLoading: false });
    rerender(<NotificationInbox />);
    expect(screen.getByText("You have no notifications.")).toBeVisible();

    mocks.useNotifications.mockReturnValue({ data: { rows: [{ ...notification, read_at: "2026-08-23T01:00:00.000Z" }], count: 1, filters: { page: 1, pageSize: 20 } }, error: null, isError: false, isLoading: false });
    mocks.useUnreadNotificationCount.mockReturnValue({ data: 0, isError: false, isLoading: false });
    rerender(<NotificationInbox />);
    expect(screen.queryByRole("button", { name: "Mark Profile updated as read" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  });

  it("requests the next page when more notifications exist", async () => {
    const user = userEvent.setup();
    render(<NotificationInbox />);

    const nextPage = screen.getByRole("button", { name: "Next page" });
    expect(nextPage).toBeEnabled();
    await user.click(nextPage);

    expect(mocks.useNotifications).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
  });

  it("reports notification update failures without hiding the inbox", () => {
    mocks.useMarkAllNotificationsRead.mockReturnValue({
      error: new Error("Unable to update notifications"),
      isError: true,
      isPending: false,
      mutate: mocks.markAllMutate,
    });

    render(<NotificationInbox />);

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to update notifications");
    expect(screen.getByText("Profile updated")).toBeVisible();
  });
});
