import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

import { AppShell } from "./app-shell";

const { usePathname, useRouter } = vi.hoisted(() => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname, useRouter }));
vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => <a href="/notifications">Notifications</a>,
}));

describe("AppShell", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/hr");
    useRouter.mockReturnValue({ replace: vi.fn(), refresh: vi.fn() });
  });

  it("shows only HR navigation and identifies the current page", () => {
    render(
      <AppShell config={ROLE_CONFIG.hr_personnel} email="hr@example.com">
        <p>HR content</p>
      </AppShell>,
    );

    const navigation = screen.getByRole("navigation", {
      name: /main navigation/i,
    });
    const link = within(navigation).getByRole("link", {
      name: /HR workspace/i,
    });

    expect(link).toHaveAttribute("href", "/hr");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.closest("button")).toBeNull();
    expect(
      within(navigation).queryByRole("link", { name: /Management workspace/i }),
    ).not.toBeInTheDocument();
  });

  it("provides accessible shell landmarks and a named sidebar control", () => {
    render(
      <AppShell config={ROLE_CONFIG.management} email="manager@example.com">
        <p>Management content</p>
      </AppShell>,
    );

    expect(
      screen.getByRole("link", { name: /skip to main content/i }),
    ).toHaveAttribute("href", "#main-content");
    expect(
      screen.getByRole("button", { name: /toggle sidebar/i }),
    ).toHaveClass("min-h-11");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByText("San Juan City Police")).toBeInTheDocument();
    expect(screen.getByTestId("brand-command-accent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("gives every authenticated workspace a notifications entry point", () => {
    render(
      <AppShell config={ROLE_CONFIG.management} email="manager@example.com">
        <p>Management content</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
    expect(
      screen.getByRole("button", {
        name: "Account menu for manager@example.com",
      }),
    ).toBeVisible();
  });
});
