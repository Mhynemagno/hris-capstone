import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), getCurrentRole: vi.fn(), getStaffDisplayName: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("@/lib/auth/current-user", () => ({ getAuthenticatedUser: mocks.getAuthenticatedUser }));
vi.mock("@/lib/auth/current-role", () => ({ getCurrentRole: mocks.getCurrentRole }));
vi.mock("@/lib/auth/staff-display-name", () => ({ getStaffDisplayName: mocks.getStaffDisplayName }));
vi.mock("@/components/providers/query-provider", () => ({ QueryProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/staff-shell/staff-shell", () => ({ StaffShell: ({ children, displayName }: { children: ReactNode; displayName: string }) => <div data-shell="staff">{displayName}{children}</div> }));
vi.mock("@/components/app-shell/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div data-shell="applicant">{children}</div> }));
vi.mock("@/components/workspace-shell/workspace-shell", () => ({ WorkspaceShell: ({ children }: { children: ReactNode }) => <div data-shell="workspace">{children}</div> }));

import ProtectedLayout from "./layout";

describe("protected layout shells", () => {
  beforeEach(() => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "u1", email: "hr@example.test" });
    mocks.getStaffDisplayName.mockResolvedValue("PMAJ M. C. Balneg");
  });

  it("gives HR the Capstone UI staff shell with their header name", async () => {
    mocks.getCurrentRole.mockResolvedValue("hr_personnel");
    render(await ProtectedLayout({ children: <p>HR page</p> }));
    expect(screen.getByText("HR page").closest("[data-shell]")).toHaveAttribute("data-shell", "staff");
    expect(screen.getByText("PMAJ M. C. Balneg")).toBeInTheDocument();
    expect(mocks.getStaffDisplayName).toHaveBeenCalledWith("u1", "hr@example.test");
  });

  it("gives employees the Capstone UI staff shell with their header name", async () => {
    mocks.getCurrentRole.mockResolvedValue("employee");
    render(await ProtectedLayout({ children: <p>Employee page</p> }));
    expect(screen.getByText("Employee page").closest("[data-shell]")).toHaveAttribute("data-shell", "staff");
    expect(mocks.getStaffDisplayName).toHaveBeenCalledWith("u1", "hr@example.test");
  });

  it("gives system administrators the Capstone UI staff shell with their header name", async () => {
    mocks.getCurrentRole.mockResolvedValue("system_administrator");
    render(await ProtectedLayout({ children: <p>Admin page</p> }));
    expect(screen.getByText("Admin page").closest("[data-shell]")).toHaveAttribute("data-shell", "staff");
    expect(screen.getByText("PMAJ M. C. Balneg")).toBeInTheDocument();
    expect(mocks.getStaffDisplayName).toHaveBeenCalledWith("u1", "hr@example.test");
  });

  it("keeps the applicant shell for applicants", async () => {
    mocks.getCurrentRole.mockResolvedValue("applicant");
    render(await ProtectedLayout({ children: <p>Applicant page</p> }));
    expect(screen.getByText("Applicant page").closest("[data-shell]")).toHaveAttribute("data-shell", "applicant");
  });
});
