import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useReport: vi.fn() }));

vi.mock("@/hooks/use-reporting", () => ({ useReport: mocks.useReport }));
vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({
    isLoading: false,
    error: null,
    data: [
      { id: 1, name: "Criminal Police", is_active: true },
      { id: 2, name: "Closed Unit", is_active: false },
    ],
  }),
}));

import { formatCell, REPORT_STATUS_FILTERS, ReportDetail } from "./report-detail";

const report = {
  reportKey: "deployments",
  title: "Deployments",
  generatedAt: "2026-09-24T00:00:00.000Z",
  columns: [
    { key: "employee", label: "Employee" },
    { key: "status", label: "Status" },
  ],
  rows: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
};

const optionValues = (select: HTMLElement) => within(select).getAllByRole("option").map((option) => (option as HTMLOptionElement).value);

describe("formatCell", () => {
  it("shows dates in words and leaves other values alone", () => {
    expect(formatCell("2026-09-23")).toBe("September 23, 2026");
    expect(formatCell("2026-09-23T06:05:00+00:00")).toBe("September 23, 2026 at 2:05 PM");
    expect(formatCell("PNP-2026-09")).toBe("PNP-2026-09");
    expect(formatCell(null)).toBe("—");
  });

  it("shows an incomplete attendance record as Partial", () => {
    expect(formatCell("incomplete")).toBe("Partial");
  });
});

describe("ReportDetail filters", () => {
  beforeEach(() => {
    mocks.useReport.mockReset();
    mocks.useReport.mockReturnValue({ isLoading: false, error: null, data: report });
  });

  it("changes the status options with the report", () => {
    const { rerender } = render(<ReportDetail reportKey="deployments" role="hr_personnel" />);
    expect(screen.getByLabelText("Deployment status")).toBeInTheDocument();
    expect(optionValues(screen.getByLabelText("Deployment status"))).toEqual(["", "scheduled", "ongoing", "completed", "cancelled"]);

    rerender(<ReportDetail reportKey="employee-performance" role="hr_personnel" />);
    expect(optionValues(screen.getByLabelText("Employment status"))).toEqual(["", "active", "retired"]);

    rerender(<ReportDetail reportKey="hiring-decisions" role="hr_personnel" />);
    expect(optionValues(screen.getByLabelText("Decision"))).toEqual(["", "Hired", "Not Selected"]);

    rerender(<ReportDetail reportKey="attendance-leave" role="management" />);
    const recordStatus = screen.getByLabelText("Record status");
    expect(within(recordStatus).getAllByRole("group").map((group) => group.getAttribute("label"))).toEqual(["Attendance", "Leave"]);
    expect(optionValues(recordStatus)).toEqual(["", ...REPORT_STATUS_FILTERS["attendance-leave"].options.map((option) => option.value)]);
  });

  it("offers active departments and passes the chosen filters to the report", async () => {
    const user = userEvent.setup();
    render(<ReportDetail reportKey="deployments" role="management" />);
    const department = screen.getByLabelText("Unit / Section");
    expect(within(department).getAllByRole("option").map((option) => option.textContent)).toEqual(["All units / sections", "Criminal Police"]);

    await user.selectOptions(department, "1");
    await user.selectOptions(screen.getByLabelText("Deployment status"), "ongoing");

    expect(mocks.useReport).toHaveBeenLastCalledWith(expect.objectContaining({ reportKey: "deployments", departmentId: 1, status: "ongoing", page: 1 }), "management");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(mocks.useReport).toHaveBeenLastCalledWith(expect.objectContaining({ departmentId: undefined, status: undefined }), "management");
  });

  it("shows an inline error and keeps the last valid range when the end date precedes the start", async () => {
    const user = userEvent.setup();
    render(<ReportDetail reportKey="deployments" role="hr_personnel" />);
    await user.type(screen.getByLabelText("Start date"), "2026-05-10");
    await user.type(screen.getByLabelText("End date"), "2026-05-01");

    expect(screen.getByText("End date must be on or after the start date.")).toBeVisible();
    expect(screen.getByLabelText("End date")).toHaveAttribute("min", "2026-05-10");
    const lastCall = mocks.useReport.mock.lastCall?.[0] as { startsOn?: string; endsOn?: string };
    expect(lastCall.endsOn === undefined || lastCall.endsOn >= (lastCall.startsOn ?? "")).toBe(true);
    expect(screen.getByText(/No records match these filters/)).toBeVisible();
  });
});
