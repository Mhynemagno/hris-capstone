import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useUnreadNotificationCount: vi.fn(),
}));

vi.mock("@/hooks/use-notifications", () => ({
  useUnreadNotificationCount: mocks.useUnreadNotificationCount,
}));

import { NotificationBell } from "./notification-bell";

describe("NotificationBell", () => {
  beforeEach(() => {
    mocks.useUnreadNotificationCount.mockReturnValue({ data: 3, isError: false, isLoading: false });
  });

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
