import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

import { AppShell } from "./app-shell";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/notifications/notification-bell", () => ({ NotificationBell: () => <a href="/notifications">Notifications</a> }));

describe("AppShell (applicant)", () => {
  beforeEach(() => usePathname.mockReturnValue("/applicant"));

  it("shows the applicant navigation and identifies the current page", () => {
    render(<AppShell config={ROLE_CONFIG.applicant} email="a@example.com"><p>Applicant</p></AppShell>);
    const navigation = screen.getByRole("navigation", { name: /main navigation/i });
    expect(within(navigation).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Recruitment" })).toHaveAttribute("href", "/jobs");
  });

  it("keeps the original landmarks and brand", () => {
    render(<AppShell config={ROLE_CONFIG.applicant} email="a@example.com"><p>Applicant</p></AppShell>);
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toHaveClass("min-h-11");
    expect(screen.getByText("San Juan City Police Station")).toBeInTheDocument();
    expect(screen.getByTestId("brand-command-accent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu for a@example.com" })).toBeInTheDocument();
  });
});
