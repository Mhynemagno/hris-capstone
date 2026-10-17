import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

import { StaffShell } from "./staff-shell";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/app-shell/notification-drawer", () => ({ NotificationDrawer: () => <button type="button">Notifications</button> }));
vi.mock("./staff-notify", () => ({ StaffToaster: () => null, notifyStaffError: vi.fn() }));
vi.mock("./staff-nav-badge", () => ({ StaffNavBadge: () => null }));

describe("StaffShell (HR)", () => {
  beforeEach(() => usePathname.mockReturnValue("/hr/jobs"));

  it("shows the mockup sidebar with groups and the active item", () => {
    render(<StaffShell config={ROLE_CONFIG.hr_personnel} displayName="PMAJ M. C. Balneg" email="hr@example.test"><h1>Jobs</h1></StaffShell>);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByText("Personnel")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Recruitment Openings" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: /kiosk/i })).not.toBeInTheDocument();
    expect(screen.getByText("San Juan City Police Station")).toBeInTheDocument();
  });

  it("has the mockup top bar, a bell and an account menu, and no sidebar sign-out", () => {
    render(<StaffShell config={ROLE_CONFIG.hr_personnel} displayName="PMAJ M. C. Balneg" email="hr@example.test"><h1>Jobs</h1></StaffShell>);
    expect(screen.getByText("Eastern Police District")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu for hr@example.test" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("keeps the workspace look on pages without a mockup", () => {
    usePathname.mockReturnValue("/hr/employees");
    render(<StaffShell config={ROLE_CONFIG.hr_personnel} displayName="x" email="hr@example.test"><h1>Employees</h1></StaffShell>);
    expect(screen.getByRole("heading", { name: "Employees" }).closest(".workspace")).not.toBeNull();
  });

  it("shows the SysAd control groups with the current admin route active", () => {
    usePathname.mockReturnValue("/admin/settings");
    render(<StaffShell config={ROLE_CONFIG.system_administrator} displayName="PMAJ M. C. Balneg" email="sysad@example.test"><h1>Settings</h1></StaffShell>);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByText("People and Access")).toHaveClass("text-slate-400");
    expect(within(nav).getByText("Station Organization")).toBeInTheDocument();
    expect(within(nav).getByText("System Oversight")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "System Settings" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: /plantilla openings|leave applications/i })).not.toBeInTheDocument();
  });
});

describe("StaffShell (employee)", () => {
  beforeEach(() => usePathname.mockReturnValue("/employee/attendance"));

  it("uses the employee sidebar wording, slate inactive labels, and profile account link", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<StaffShell config={ROLE_CONFIG.employee} displayName="Pat Demo Employee" email="employee@example.test"><h1>Attendance</h1></StaffShell>);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: "Attendance" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Leave" })).toHaveClass("text-slate-400");
    expect(within(nav).queryByRole("link", { name: "Scan" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Account menu for employee@example.test" }));
    expect(await screen.findByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/employee/profile");
  });
});
