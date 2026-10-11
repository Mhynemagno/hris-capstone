import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  count: vi.fn(),
  markRead: vi.fn(),
  markAll: vi.fn(),
  deleteOne: vi.fn(),
  clearAll: vi.fn(),
}));

vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => ({ data: { rows: mocks.rows(), count: mocks.count() }, isLoading: false, error: null }),
  useUnreadNotificationCount: () => ({ data: mocks.rows().filter((row: { read_at: string | null }) => !row.read_at).length, isLoading: false, isError: false }),
  useMarkNotificationRead: () => ({ mutate: mocks.markRead }),
  useMarkAllNotificationsRead: () => ({ mutate: mocks.markAll }),
  useDeleteNotification: () => ({ mutate: mocks.deleteOne }),
  useDeleteAllNotifications: () => ({ mutate: mocks.clearAll }),
}));

import { NotificationDrawer } from "./notification-drawer";

const rows = [
  { id: "n1", title: "Physical Agility Test Scheduled", body: "You have been moved to Stage 2.", link: "/applicant/applications", read_at: null, created_at: new Date(Date.now() - 10 * 60_000).toISOString(), type: "application_status_updated", recipient_user_id: "u" },
  { id: "n2", title: "Welcome", body: "Account registered.", link: null, read_at: "2026-10-10T00:00:00Z", created_at: "2026-10-10T00:00:00Z", type: "system", recipient_user_id: "u" },
];

describe("NotificationDrawer", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.rows.mockReturnValue(rows);
    mocks.count.mockReturnValue(2);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("opens from the bell with All and Unread tabs", async () => {
    render(<NotificationDrawer />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
    const panel = screen.getByRole("dialog", { name: "Notifications" });
    expect(within(panel).getByText("1 Unread")).toBeInTheDocument();
    expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
    expect(within(panel).getByText("10m ago")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "View details" })).toHaveAttribute("href", "/applicant/applications");
    await userEvent.click(within(panel).getByRole("tab", { name: "Unread" }));
    expect(within(panel).getAllByRole("listitem")).toHaveLength(1);
  });

  it("marks read, deletes, marks all read and clears all", async () => {
    render(<NotificationDrawer />);
    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    await userEvent.click(screen.getByRole("button", { name: "Mark Physical Agility Test Scheduled as read" }));
    expect(mocks.markRead).toHaveBeenCalledWith("n1");
    await userEvent.click(screen.getByRole("button", { name: "Delete Welcome" }));
    expect(mocks.deleteOne).toHaveBeenCalledWith("n2");
    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(mocks.markAll).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(window.confirm).toHaveBeenCalledWith("Clear all notifications?");
    expect(mocks.clearAll).toHaveBeenCalled();
  });

  it("shows the empty state and closes on Escape", async () => {
    mocks.rows.mockReturnValue([]);
    mocks.count.mockReturnValue(0);
    render(<NotificationDrawer />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("No notifications available")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Notifications" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveFocus();
  });

  it("closes when clicking outside", async () => {
    render(<div><p>Outside</p><NotificationDrawer /></div>);
    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    await userEvent.click(screen.getByText("Outside"));
    expect(screen.queryByRole("dialog", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("links to the full list when there are more than shown", async () => {
    mocks.count.mockReturnValue(25);
    render(<NotificationDrawer />);
    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/notifications");
  });
});
