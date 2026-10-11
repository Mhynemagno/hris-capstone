import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

import { AppShell } from "./app-shell";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./notification-drawer", () => ({ NotificationDrawer: () => <button type="button">Notifications</button> }));
vi.mock("./applicant-toaster", () => ({ ApplicantToaster: () => null }));
vi.mock("@/hooks/use-recruitment", () => ({ useApplicantProfile: () => ({ data: { first_name: "Aldrick", last_name: "Jamlani" } }) }));

describe("AppShell (applicant)", () => {
  beforeEach(() => usePathname.mockReturnValue("/applicant"));

  it("shows the four portal pages and identifies the current one", () => {
    render(<AppShell config={ROLE_CONFIG.applicant} email="aldrick.jamlani@gmail.com"><p>Applicant</p></AppShell>);
    const navigation = screen.getByRole("navigation", { name: /main navigation/i });
    expect(within(navigation).getAllByRole("link").map((link) => link.textContent)).toEqual(["Dashboard", "Profile", "Documents", "Application Status"]);
    expect(within(navigation).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("matches the Capstone UI frame", () => {
    usePathname.mockReturnValue("/applicant/documents");
    render(<AppShell config={ROLE_CONFIG.applicant} email="aldrick.jamlani@gmail.com"><p>Applicant</p></AppShell>);
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeInTheDocument();
    expect(screen.getByText("San Juan City Police Station")).toBeInTheDocument();
    expect(screen.getByText("Recruitment Division")).toBeInTheDocument();
    expect(screen.getByText("Menu")).toBeInTheDocument();
    expect(screen.getByText("PNP San Juan Recruitment Portal")).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Applicant");
    expect(breadcrumb).toHaveTextContent("Documents");
    expect(screen.getByRole("button", { name: "Account menu for Aldrick Jamlani" })).toBeInTheDocument();
  });

  it("has no sign-out button in the sidebar: logging out lives in the account menu", () => {
    render(<AppShell config={ROLE_CONFIG.applicant} email="aldrick.jamlani@gmail.com"><p>Applicant</p></AppShell>);
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
