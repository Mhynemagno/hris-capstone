import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useReport: vi.fn(), fetchFull: vi.fn() }));

vi.mock("@/hooks/use-reporting", () => ({ useReport: mocks.useReport, useFetchFullReport: () => mocks.fetchFull }));
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
    expect(optionValues(screen.getByLabelText("Employment status"))).toEqual(["", "active"]);

    rerender(<ReportDetail reportKey="hiring-decisions" role="hr_personnel" />);
    expect(optionValues(screen.getByLabelText("Decision"))).toEqual(["", "Hired", "Not Selected"]);

    rerender(<ReportDetail reportKey="attendance" role="hr_personnel" />);
    const attendanceStatus = screen.getByLabelText("Attendance status");
    expect(optionValues(attendanceStatus)).toEqual(["", ...REPORT_STATUS_FILTERS.attendance.options.map((option) => option.value)]);
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

describe("ReportDetail export (every page, not only the one on screen)", () => {
  const rows = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => ({ employee: `Officer ${from + index}`, status: "ongoing" }));
  beforeEach(() => {
    mocks.useReport.mockReset();
    mocks.fetchFull.mockReset();
    mocks.useReport.mockReturnValue({ isLoading: false, error: null, data: { ...report, rows: rows(1, 10), totalCount: 15, pageSize: 10 } });
    mocks.fetchFull.mockResolvedValue({ ...report, rows: rows(1, 15), totalCount: 15, pageSize: 100 });
  });

  it("downloads every row as CSV", async () => {
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => { blobs.push(blob); return "blob:report"; });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<ReportDetail reportKey="deployments" role="hr_personnel" />);
    await userEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const csv = await blobs[0].text();
    expect(csv).toContain("Officer 15");
    click.mockRestore();
  });

  it("says so when the full report cannot be fetched", async () => {
    mocks.fetchFull.mockRejectedValue(new Error("Network down"));
    render(<ReportDetail reportKey="deployments" role="hr_personnel" />);
    await userEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(await screen.findByText("The full report could not be loaded: Network down")).toBeInTheDocument();
  });
});
