import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "hr_personnel" as string }));
vi.mock("@/lib/auth/current-role", () => ({ getCurrentRole: async () => mocks.role }));
vi.mock("@/components/reporting/staff-reports", () => ({ StaffReports: () => <h1>Reports & Analytics</h1> }));

import ReportsPage from "./page";

describe("reports page", () => {
  it("gives HR the Capstone UI reports screen", async () => {
    mocks.role = "hr_personnel";
    render(await ReportsPage());
    expect(screen.getByRole("heading", { name: "Reports & Analytics" })).toBeInTheDocument();
  });

  it("keeps the plain list for management", async () => {
    mocks.role = "management";
    render(await ReportsPage());
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
  });
});
