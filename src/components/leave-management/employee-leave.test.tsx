import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  types: [] as Array<Record<string, unknown>>,
  balances: [] as Array<Record<string, unknown>>,
  balanceYears: vi.fn(),
  cancel: vi.fn(),
  leaveRequestFilters: vi.fn(),
  submit: vi.fn(),
  gender: "male" as "female" | "male" | null,
  listState: { isLoading: false, error: null as Error | null },
  initialRequest: null as string | null,
}));

vi.mock("@/hooks/use-leave-management", () => ({
  useMyLeaveRequests: (filters: { page: number; pageSize: number; status?: string }) => {
    mocks.leaveRequestFilters(filters);
    return { ...mocks.listState, refetch: vi.fn(), data: mocks.listState.isLoading || mocks.listState.error ? undefined : { rows: mocks.rows, count: mocks.rows.length || filters.page > 1 ? 21 : 0 } };
  },
  useCancelLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.cancel }),
  useRequestableLeaveTypes: () => ({ isLoading: false, error: null, data: mocks.types }),
  useSubmitLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.submit }),
  useMyLeaveBalances: (year: number) => { mocks.balanceYears(year); return { isLoading: false, error: null, data: mocks.balances }; },
}));

vi.mock("@/hooks/use-panel-param", async () => {
  const { useState } = await import("react");
  return { usePanelParam: () => useState<string | null>(mocks.initialRequest) };
});

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeForCurrentUser: () => ({ isLoading: false, error: null, data: { gender: mocks.gender } }),
}));

import { EmployeeLeaveCredits, EmployeeLeaveList, EmployeeLeaveRequestForm } from "./employee-leave";
import { EmployeeLeavePortal } from "./employee-leave-portal";
import { maxLeaveDate } from "@/schemas/leave-management";

const isoDate = (offsetDays: number) => {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const pendingRow = { id: "123e4567-e89b-42d3-a456-426614174000", leave_type_name: "Annual leave", starts_on: "2026-09-01", ends_on: "2026-09-02", reason: "Family event", status: "pending", decision_note: null, excess_days: 0 };

describe("EmployeeLeaveList", () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.cancel.mockReset();
    mocks.leaveRequestFilters.mockReset();
    mocks.listState = { isLoading: false, error: null };
  });

  it("shows a useful empty state when there are no leave requests", () => {
    render(<EmployeeLeaveList />);
    expect(screen.getByText(/No leave requests yet\./)).toBeVisible();
    expect(screen.getByText("Showing 0 of 0 leave requests")).toBeVisible();
  });

  it("never shows the empty state while loading or when the query failed", () => {
    mocks.listState = { isLoading: true, error: null };
    const { rerender } = render(<EmployeeLeaveList />);
    expect(screen.getByText("Loading your leave history…")).toBeVisible();
    expect(screen.queryByText(/No leave requests yet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();

    mocks.listState = { isLoading: false, error: new Error("History unavailable") };
    rerender(<EmployeeLeaveList />);
    expect(screen.getByRole("alert")).toHaveTextContent("History unavailable");
    expect(screen.queryByText(/No leave requests yet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it("stacks each request as a labelled card below the md breakpoint", () => {
    mocks.rows = [{ ...pendingRow, decision_note: "OK." }];
    render(<EmployeeLeaveList />);
    expect(screen.getByRole("table")).toHaveClass("max-md:block");
    const labels = ["Leave Category", "Inclusive Dates", "Duration", "Reason / HR Feedback", "Approval Status", "Actions"];
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells.map((cell) => cell.getAttribute("data-label"))).toEqual(labels);
    expect(cells[0].closest("tr")).toHaveClass("max-md:block");
    // Reason / HR feedback holds several paragraphs: stacked and left-aligned on phones, not a side-by-side row.
    expect(cells[3]).toHaveClass("max-md:flex-col", "max-md:text-left");
    expect(cells[3]).not.toHaveClass("max-md:justify-between", "max-md:text-right");
  });

  it("loads ten leave requests at a time and lets the employee change pages", async () => {
    mocks.rows = [{ ...pendingRow, status: "approved" }];
    const user = userEvent.setup();
    render(<EmployeeLeaveList />);

    expect(mocks.leaveRequestFilters).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, status: undefined });
    expect(screen.getByText("Showing 1–10 of 21 leave requests")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(mocks.leaveRequestFilters).toHaveBeenLastCalledWith({ page: 2, pageSize: 10, status: undefined });
  });

  it("filters by tab on the server and returns to the first page", async () => {
    mocks.rows = [{ ...pendingRow, status: "approved" }];
    const user = userEvent.setup();
    render(<EmployeeLeaveList />);
    expect(screen.getByRole("tab", { name: "All Requests" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("tab", { name: "For Approval" }));
    expect(mocks.leaveRequestFilters).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, status: "pending" });
    expect(screen.getByRole("tab", { name: "For Approval" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Approved" }));
    expect(mocks.leaveRequestFilters).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, status: "approved" });
    await user.click(screen.getByRole("tab", { name: "Rejected" }));
    expect(mocks.leaveRequestFilters).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, status: "rejected" });
  });

  it("explains an empty filtered tab", async () => {
    const user = userEvent.setup();
    render(<EmployeeLeaveList />);
    await user.click(screen.getByRole("tab", { name: "For Approval" }));
    expect(screen.getByText("No leave requests are waiting for approval.")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Approved" }));
    expect(screen.getByText("No approved leave requests yet.")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Rejected" }));
    expect(screen.getByText("No rejected leave requests yet.")).toBeVisible();
  });

  it("moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<EmployeeLeaveList />);
    screen.getByRole("tab", { name: "All Requests" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "For Approval" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "For Approval" })).toHaveAttribute("aria-selected", "true");
  });

  it("asks for confirmation and reports a failed cancellation without removing the request", async () => {
    mocks.rows = [pendingRow];
    mocks.cancel.mockRejectedValue(new Error("Cancellation failed"));
    const user = userEvent.setup();
    render(<EmployeeLeaveList />);

    await user.click(screen.getByRole("button", { name: /Cancel request/ }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Yes, cancel request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cancellation failed");
    expect(screen.getByText("Annual leave")).toBeVisible();
  });

  it("cancels a pending request after confirmation and says so", async () => {
    mocks.rows = [pendingRow];
    mocks.cancel.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EmployeeLeaveList />);
    await user.click(screen.getByRole("button", { name: /Cancel request/ }));
    await user.click(screen.getByRole("button", { name: "Yes, cancel request" }));
    expect(mocks.cancel).toHaveBeenCalledWith({ requestId: pendingRow.id });
    expect(await screen.findByText("Leave request cancelled.")).toBeVisible();
  });

  it("offers cancellation only for requests HR has not decided", () => {
    mocks.rows = [{ ...pendingRow, status: "approved" }];
    render(<EmployeeLeaveList />);
    expect(screen.queryByRole("button", { name: /Cancel request/ })).not.toBeInTheDocument();
  });

  it("shows dates in words, the duration, HR's notes and a status pill with text", () => {
    mocks.rows = [{ ...pendingRow, reason: null, status: "rejected", decision_note: "Short staffed." }];
    render(<EmployeeLeaveList />);

    expect(screen.getByText("September 1, 2026 – September 2, 2026")).toBeVisible();
    expect(screen.getByText("2 days")).toBeVisible();
    expect(screen.getByText("Notes from HR: Short staffed.")).toBeVisible();
    expect(screen.getAllByText("Rejected")).toHaveLength(2);
  });

  it("tells the employee about paternity days deducted from retirement benefits", () => {
    mocks.rows = [{ ...pendingRow, leave_type_name: "Paternity Leave", starts_on: "2026-11-01", ends_on: "2026-11-10", reason: null, excess_days: 3 }];
    render(<EmployeeLeaveList />);

    expect(screen.getByText("For Approval", { selector: "span" })).toBeVisible();
    expect(screen.getByText("3 days beyond the yearly limit, deducted from your retirement benefits.")).toBeVisible();
  });
});

describe("EmployeeLeavePortal", () => {
  beforeEach(() => {
    mocks.rows = [{ ...pendingRow, decision_note: "OK." }];
    mocks.types = [{ id: "11111111-1111-4111-8111-111111111111", name: "Annual leave", requires_attachment: false, is_active: true, eligible_gender: null }];
    mocks.balances = [];
    mocks.listState = { isLoading: false, error: null };
    mocks.initialRequest = null;
    mocks.submit.mockReset();
  });

  it("opens the File Leave Application modal from Request New Leave over the history", async () => {
    const user = userEvent.setup();
    render(<EmployeeLeavePortal />);
    expect(screen.getByRole("heading", { name: "My Leave Portal" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Request New Leave" }));
    expect(await screen.findByRole("dialog", { name: "File Leave Application" })).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "For Approval" })).toBeVisible();
    expect(screen.getByText("Notes from HR: OK.")).toBeVisible();
  });

  it("opens the modal on load for ?request=1 links", async () => {
    mocks.initialRequest = "1";
    render(<EmployeeLeavePortal />);
    expect(await screen.findByRole("dialog", { name: "File Leave Application" })).toBeVisible();
  });

  it("closes the modal and confirms after a successful request", async () => {
    mocks.initialRequest = "1";
    mocks.submit.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EmployeeLeavePortal />);
    const dialog = await screen.findByRole("dialog", { name: "File Leave Application" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /Leave type/ }), "11111111-1111-4111-8111-111111111111");
    await user.type(within(dialog).getByLabelText(/Start date/), isoDate(1));
    await user.type(within(dialog).getByLabelText(/End date/), isoDate(2));
    await user.click(within(dialog).getByRole("button", { name: "Submit Application" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Leave request submitted.");
  });
});

describe("EmployeeLeaveRequestForm", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.types = [
      { id: "11111111-1111-4111-8111-111111111111", name: "Annual leave", requires_attachment: false, is_active: true, eligible_gender: null },
      { id: "22222222-2222-4222-8222-222222222222", name: "Retired leave", requires_attachment: false, is_active: false, eligible_gender: null },
      { id: "33333333-3333-4333-8333-333333333333", name: "Sick leave", requires_attachment: true, is_active: true, eligible_gender: null },
    ];
    mocks.balances = [];
    mocks.gender = "male";
  });

  it("shows the days left and blocks a request longer than what is left", async () => {
    mocks.balances = [{ leave_type_id: "11111111-1111-4111-8111-111111111111", days_per_year: 2, excess_deducted_from_retirement: false, used_days: 1 }];
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestForm />);
    await user.selectOptions(screen.getByRole("combobox", { name: /Leave type/ }), "11111111-1111-4111-8111-111111111111");
    expect(screen.getByText(/^1 day of 2 left for \d{4}\.$/)).toBeVisible();
    await user.type(screen.getByLabelText(/Start date/), isoDate(1));
    await user.type(screen.getByLabelText(/End date/), isoDate(2));
    await user.click(screen.getByRole("button", { name: "Submit Application" }));

    expect(await screen.findByText(/You have 1 day of this leave left for \d{4}\. Shorten the request to fit\./)).toBeVisible();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("lets a request go past a limit whose extra days are deducted from retirement benefits", async () => {
    mocks.submit.mockResolvedValue(undefined);
    mocks.balances = [{ leave_type_id: "11111111-1111-4111-8111-111111111111", days_per_year: 7, excess_deducted_from_retirement: true, used_days: 7 }];
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestForm />);
    await user.selectOptions(screen.getByRole("combobox", { name: /Leave type/ }), "11111111-1111-4111-8111-111111111111");
    expect(screen.getByText(/0 days of 7 left for \d{4}\. Days beyond this are allowed but deducted from your retirement benefits\./)).toBeVisible();
    await user.type(screen.getByLabelText(/Start date/), isoDate(1));
    await user.type(screen.getByLabelText(/End date/), isoDate(2));
    await user.click(screen.getByRole("button", { name: "Submit Application" }));

    expect(mocks.submit).toHaveBeenCalled();
  });

  it("offers only active leave types without evidence hints or an upload field", () => {
    render(<EmployeeLeaveRequestForm />);
    const select = screen.getByRole("combobox", { name: /Leave type/ });
    const options = within(select).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Select category...", "Annual leave", "Sick leave"]);
    expect(screen.queryByLabelText(/Supporting evidence/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Reason/)).not.toBeInTheDocument();
    expect(screen.queryByText("Must be on or after the start date.")).not.toBeInTheDocument();
  });

  it("binds the end date minimum to the start date and blocks an end date before the start", async () => {
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestForm />);
    await user.selectOptions(screen.getByRole("combobox", { name: /Leave type/ }), "11111111-1111-4111-8111-111111111111");
    const start = isoDate(5);
    const end = isoDate(3);
    await user.type(screen.getByLabelText(/Start date/), start);
    expect(screen.getByLabelText(/End date/)).toHaveAttribute("min", start);
    await user.type(screen.getByLabelText(/End date/), end);
    await user.click(screen.getByRole("button", { name: "Submit Application" }));

    expect(await screen.findByText("End date must be on or after the start date.")).toBeVisible();
    expect(screen.getByLabelText(/End date/)).toHaveAttribute("aria-invalid", "true");
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("submits a type that needs no document without notes and clears the form", async () => {
    mocks.submit.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestForm />);
    await user.selectOptions(screen.getByRole("combobox", { name: /Leave type/ }), "11111111-1111-4111-8111-111111111111");
    await user.type(screen.getByLabelText(/Start date/), isoDate(1));
    await user.type(screen.getByLabelText(/End date/), isoDate(2));
    expect(screen.getByLabelText("Notes")).not.toBeRequired();
    await user.click(screen.getByRole("button", { name: "Submit Application" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Leave request submitted.");
    expect(mocks.submit).toHaveBeenCalledWith({ draft: expect.objectContaining({ leaveTypeId: "11111111-1111-4111-8111-111111111111", reason: "" }), files: [] });
    expect(screen.getByRole("combobox", { name: /Leave type/ })).toHaveValue("");
    expect(screen.getByLabelText(/Start date/)).toHaveValue("");
  });
  it("lists Paternity but not Maternity for a male employee", () => {
    mocks.types = [
      { id: "44444444-4444-4444-8444-444444444444", name: "Maternity Leave", requires_attachment: false, is_active: true, eligible_gender: "female" },
      { id: "55555555-5555-4555-8555-555555555555", name: "Paternity Leave", requires_attachment: false, is_active: true, eligible_gender: "male" },
    ];
    render(<EmployeeLeaveRequestForm />);
    const select = screen.getByLabelText(/^Leave type/);
    expect(within(select).getByRole("option", { name: "Paternity Leave" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Maternity Leave" })).not.toBeInTheDocument();
  });
  it("explains an impossible start date immediately instead of accepting year 0001", async () => {
    render(<EmployeeLeaveRequestForm />);
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: "0001-01-10" } });
    expect(await screen.findByText("Choose today or a future date.")).toBeVisible();
  });

  it("caps leave dates two years ahead", () => {
    render(<EmployeeLeaveRequestForm />);
    expect(screen.getByLabelText(/^Start date/)).toHaveAttribute("max", maxLeaveDate());
    expect(screen.getByLabelText(/^End date/)).toHaveAttribute("max", maxLeaveDate());
  });

  it("never asks for a year-1 balance", () => {
    mocks.balanceYears.mockReset();
    render(<EmployeeLeaveRequestForm />);
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: "0001-01-10" } });
    expect(mocks.balanceYears).not.toHaveBeenCalledWith(1);
  });
  it("asks for a supporting document for Sick Leave and sends it with the request", async () => {
    mocks.submit.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestForm />);
    expect(screen.queryByLabelText(/^Supporting document/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: /Leave type/ }), "33333333-3333-4333-8333-333333333333");
    await user.type(screen.getByLabelText(/Start date/), isoDate(1));
    await user.type(screen.getByLabelText(/End date/), isoDate(2));
    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(await screen.findByText("Attach a supporting document, such as a medical certificate.")).toBeVisible();
    expect(mocks.submit).not.toHaveBeenCalled();

    const file = new File(["%PDF"], "medical.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/^Supporting document/), file);
    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ files: [file] }));
  });
});

describe("EmployeeLeaveCredits", () => {
  beforeEach(() => {
    mocks.gender = "male";
    mocks.types = [
      { id: "11111111-1111-4111-8111-111111111111", name: "Vacation Leave", description: "Subject to prior approval & unit clearance.", days_per_year: 15, excess_deducted_from_retirement: false, requires_attachment: false, is_active: true, eligible_gender: null },
      { id: "44444444-4444-4444-8444-444444444444", name: "Maternity Leave", description: null, days_per_year: 105, excess_deducted_from_retirement: false, requires_attachment: false, is_active: true, eligible_gender: "female" },
      { id: "66666666-6666-4666-8666-666666666666", name: "Study Leave", description: null, days_per_year: null, excess_deducted_from_retirement: false, requires_attachment: false, is_active: true, eligible_gender: null },
    ];
    mocks.balances = [{ leave_type_id: "11111111-1111-4111-8111-111111111111", days_per_year: 15, excess_deducted_from_retirement: false, used_days: 3 }];
  });

  it("shows finite types as cards with days left and a progress bar", () => {
    render(<EmployeeLeaveCredits />);
    expect(screen.getByRole("heading", { name: "Leave Credit Entitlements" })).toBeInTheDocument();
    const card = screen.getByRole("article", { name: "Vacation Leave" });
    expect(card).toHaveTextContent(/12\s*\/ 15 Days Left in \d{4}/);
    expect(within(card).getByRole("progressbar", { name: "Vacation Leave days left" })).toHaveAttribute("aria-valuenow", "12");
    expect(card).toHaveTextContent("Subject to prior approval & unit clearance.");
    expect(screen.queryByRole("article", { name: "Maternity Leave" })).not.toBeInTheDocument();
  });

  it("shows a no-limit type without a progress bar", () => {
    render(<EmployeeLeaveCredits />);
    const card = screen.getByRole("article", { name: "Study Leave" });
    expect(card).toHaveTextContent("No yearly limit");
    expect(within(card).queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
