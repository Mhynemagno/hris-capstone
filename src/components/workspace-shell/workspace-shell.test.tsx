import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/notifications/notification-bell", () => ({ NotificationBell: () => <a href="/notifications">Notifications</a> }));
vi.mock("@/components/workspace-shell/nav-badge", () => ({ NavBadge: ({ badge }: { badge: string }) => <span>badge:{badge}</span> }));

import { useBreadcrumbTrail } from "./breadcrumbs";
import { WorkspaceShell } from "./workspace-shell";

function DetailPage() {
  useBreadcrumbTrail([{ label: "Aplica Candidate" }]);
  return <h1>Aplica Candidate</h1>;
}

describe("WorkspaceShell", () => {
  beforeEach(() => usePathname.mockReturnValue("/hr"));

  it("scopes the workspace theme to the document while mounted", () => {
    const { unmount } = render(<WorkspaceShell config={ROLE_CONFIG.hr_personnel} email="hr@example.com"><p>x</p></WorkspaceShell>);
    expect(document.documentElement).toHaveClass("workspace");
    unmount();
    expect(document.documentElement).not.toHaveClass("workspace");
  });

  it("groups HR navigation, marks the most specific link current and shows badges beside links", () => {
    usePathname.mockReturnValue("/hr/attendance/kiosk");
    render(<WorkspaceShell config={ROLE_CONFIG.hr_personnel} email="hr@example.com"><p>Kiosk</p></WorkspaceShell>);
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    for (const heading of ["Recruitment", "Personnel", "Attendance", "Insights", "Public site"]) {
      expect(within(navigation).getByText(heading, { selector: "div" })).toBeInTheDocument();
    }
    expect(within(navigation).getByRole("link", { name: "Kiosk" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Attendance" })).not.toHaveAttribute("aria-current");
    expect(within(navigation).getByRole("link", { name: "Applications" })).toBeInTheDocument();
    expect(within(navigation).getByText("badge:applicationsAwaitingReview")).toBeInTheDocument();
  });

  it("keeps landmarks, the skip link, the brand line and the account menu", () => {
    render(<WorkspaceShell config={ROLE_CONFIG.management} email="manager@example.com"><p>x</p></WorkspaceShell>);
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "San Juan City Police Station logo" })).toBeInTheDocument();
    expect(screen.getByTestId("brand-command-accent")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("button", { name: "Account menu for manager@example.com" })).toBeInTheDocument();
  });

  it("extends the breadcrumb with the page's trail and links the section", () => {
    usePathname.mockReturnValue("/hr/applications/123e4567-e89b-42d3-a456-426614174000");
    render(<WorkspaceShell config={ROLE_CONFIG.hr_personnel} email="hr@example.com"><DetailPage /></WorkspaceShell>);
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Applications" })).toHaveAttribute("href", "/hr/applications");
    expect(within(breadcrumb).getByText("Aplica Candidate")).toHaveAttribute("aria-current", "page");
  });
});
