import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

import { AppShell } from "./app-shell";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

describe("AppShell", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/hr");
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
    ).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });
});
