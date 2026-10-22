import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), masterlist: vi.fn(), notify: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("@/queries/reporting", () => ({ listStationMasterlist: mocks.masterlist }));
vi.mock("@/hooks/use-administration", () => ({ useDepartmentOptions: () => ({ data: [{ id: 3, name: "Station Administrative and Resource Management Section", is_active: true }] }) }));

import { StaffReports } from "./staff-reports";

describe("StaffReports (reports.html)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T08:00:00+08:00"));
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); mocks.push.mockReset(); mocks.masterlist.mockReset(); mocks.notify.mockReset(); });

  it("shows the six report cards", () => {
    render(<StaffReports />);
    expect(screen.getByRole("heading", { level: 1, name: "Reports & Analytics" })).toBeInTheDocument();
    for (const title of ["Applicant Tracking", "Hiring Decisions", "Employee Performance", "Duty Deployments", "Attendance", "Leave", "Promotion Evaluation", "Training Needs"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { name: /^Generate/ })).toHaveLength(8);
    expect(screen.getAllByText("Live data")).toHaveLength(2);
    expect(screen.getAllByText("CY 2026 Cycle")).toHaveLength(2);
  });

  it("generates a report with the chosen range, unit and format", async () => {
    render(<StaffReports />);
    await userEvent.click(screen.getByRole("button", { name: "Generate Duty Deployments" }));
    const dialog = await screen.findByRole("dialog", { name: "Duty Deployments Master Report" });
    expect(within(dialog).getByText("SAN JUAN CITY POLICE STATION")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Date Range From/)).toHaveValue("2026-10-01");
    expect(within(dialog).getByLabelText(/Date Range To/)).toHaveValue("2026-10-11");
    expect(within(within(dialog).getByLabelText("Export Format")).getByRole("option", { name: "Excel Spreadsheet (.csv)" })).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText("Station Sub-Unit / Sector"), "3");
    await userEvent.selectOptions(within(dialog).getByLabelText("Export Format"), "csv");
    await userEvent.click(within(dialog).getByRole("button", { name: /Download Official Report/ }));
    expect(mocks.push).toHaveBeenCalledWith("/reports/deployments?from=2026-10-01&to=2026-10-11&department=3&export=csv");
  });

  it("refuses a start date after the end date", async () => {
    render(<StaffReports />);
    await userEvent.click(screen.getByRole("button", { name: "Generate Applicant Tracking" }));
    const dialog = await screen.findByRole("dialog", { name: "Applicant Tracking Report" });
    const from = within(dialog).getByLabelText(/Date Range From/);
    await userEvent.clear(from);
    await userEvent.type(from, "2026-10-20");
    await userEvent.click(within(dialog).getByRole("button", { name: /Download Official Report/ }));
    expect(within(dialog).getByText("Start date must be on or before the end date.")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("offers downloadable formats without a direct print view", async () => {
    render(<StaffReports />);
    await userEvent.click(screen.getByRole("button", { name: "Generate Duty Deployments" }));
    const dialog = await screen.findByRole("dialog", { name: "Duty Deployments Master Report" });
    expect(within(dialog).queryByRole("option", { name: "Direct Print View" })).not.toBeInTheDocument();
  });

  it("exports the station masterlist as CSV", async () => {
    mocks.masterlist.mockResolvedValue([{ badge: "1-60482", rank: "PMAJ", name: "Balneg, Maria", unit: "ARMS", status: "active" }]);
    const createObjectURL = vi.fn(() => "blob:masterlist");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<StaffReports />);
    await userEvent.click(screen.getByRole("button", { name: /Export Station Masterlist/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Masterlist exported" });
  });
});
