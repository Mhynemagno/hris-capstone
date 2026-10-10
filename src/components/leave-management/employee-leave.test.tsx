import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
}));

vi.mock("@/hooks/use-leave-management", () => ({
  useMyLeaveRequests: (filters: { page: number; pageSize: number }) => {
    mocks.leaveRequestFilters(filters);
    return { isLoading: false, error: null, data: { rows: mocks.rows, count: 21 } };
  },
  useCancelLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.cancel }),
  useRequestableLeaveTypes: () => ({ isLoading: false, error: null, data: mocks.types }),
  useSubmitLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.submit }),
  useMyLeaveBalances: (year: number) => { mocks.balanceYears(year); return { isLoading: false, error: null, data: mocks.balances }; },
}));

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeForCurrentUser: () => ({ isLoading: false, error: null, data: { gender: mocks.gender } }),
}));

import { EmployeeLeaveCredits, EmployeeLeaveList, EmployeeLeaveRequestForm } from "./employee-leave";
import { maxLeaveDate } from "@/schemas/leave-management";

const isoDate = (offsetDays: number) => {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

describe("EmployeeLeaveList", () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.cancel.mockReset();
    mocks.leaveRequestFilters.mockReset();
  });

  it("shows a useful empty state when there are no leave requests", () => {
    render(<EmployeeLeaveList />);
    expect(screen.getByText(/No leave requests yet\./)).toBeVisible();
    expect(screen.getByRole("link", { name: "Request leave" })).toHaveAttribute("href", "/employee/leave/new");
  });

  it("loads ten leave requests at a time and lets the employee change pages", async () => {
    mocks.rows = [{ id: "123e4567-e89b-42d3-a456-426614174000", leave_type_name: "Annual leave", starts_on: "2026-09-01", ends_on: "2026-09-02", reason: null, status: "approved", decision_note: null }];
    const user = userEvent.setup();
    render(<EmployeeLeaveList />);

    expect(mocks.leaveRequestFilters).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
    expect(screen.getByText("1–10 of 21 leave requests")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(mocks.leaveRequestFilters).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 });
  });

  it("asks for confirmation and reports a failed cancellation without removing the request", async () => {
    mocks.rows = [{ id: "123e4567-e89b-42d3-a456-426614174000", leave_type_name: "Annual leave", starts_on: "2026-09-01", ends_on: "2026-09-02", reason: "Family event", status: "pending", decision_note: null }];
    mocks.cancel.mockRejectedValue(new Error("Cancellation failed"));
    const user = userEvent.setup();
    render(<EmployeeLeaveList />);

    await user.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Yes, cancel request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cancellation failed");
    expect(screen.getByText(/Annual leave/)).toBeVisible();
  });

  it("shows leave dates in words and HR's notes", () => {
    mocks.rows = [{ id: "123e4567-e89b-42d3-a456-426614174000", leave_type_name: "Annual leave", starts_on: "2026-09-01", ends_on: "2026-09-02", reason: null, status: "rejected", decision_note: "Short staffed." }];
    render(<EmployeeLeaveList />);

    expect(screen.getByText("Annual leave · September 1, 2026 to September 2, 2026")).toBeVisible();
    expect(screen.getByText("Notes from HR: Short staffed.")).toBeVisible();
  });

  it("tells the employee about paternity days deducted from retirement benefits", () => {
    mocks.rows = [{ id: "123e4567-e89b-42d3-a456-426614174000", leave_type_name: "Paternity Leave", starts_on: "2026-11-01", ends_on: "2026-11-10", reason: null, status: "pending", decision_note: null, excess_days: 3 }];
    render(<EmployeeLeaveList />);

    expect(screen.getByText("For Approval")).toBeVisible();
    expect(screen.getByText("3 days beyond the yearly limit, deducted from your retirement benefits.")).toBeVisible();
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
    await user.click(screen.getByRole("button", { name: "Submit request" }));

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
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(mocks.submit).toHaveBeenCalled();
  });

  it("offers only active leave types without evidence hints or an upload field", () => {
    render(<EmployeeLeaveRequestForm />);
    const select = screen.getByRole("combobox", { name: /Leave type/ });
    const options = within(select).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Choose a type", "Annual leave", "Sick leave"]);
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
    await user.click(screen.getByRole("button", { name: "Submit request" }));

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
    await user.click(screen.getByRole("button", { name: "Submit request" }));

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
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(await screen.findByText("Attach a supporting document, such as a medical certificate.")).toBeVisible();
    expect(mocks.submit).not.toHaveBeenCalled();

    const file = new File(["%PDF"], "medical.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/^Supporting document/), file);
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ files: [file] }));
  });
});

describe("EmployeeLeaveCredits", () => {
  it("shows the leave types the employee can take as cards with days left this year", () => {
    mocks.gender = "male";
    mocks.types = [
      { id: "11111111-1111-4111-8111-111111111111", name: "Vacation Leave", description: "Subject to prior approval & unit clearance.", days_per_year: 15, excess_deducted_from_retirement: false, requires_attachment: false, is_active: true, eligible_gender: null },
      { id: "44444444-4444-4444-8444-444444444444", name: "Maternity Leave", description: null, days_per_year: 105, excess_deducted_from_retirement: false, requires_attachment: false, is_active: true, eligible_gender: "female" },
    ];
    mocks.balances = [{ leave_type_id: "11111111-1111-4111-8111-111111111111", days_per_year: 15, excess_deducted_from_retirement: false, used_days: 3 }];
    render(<EmployeeLeaveCredits />);
    expect(screen.getByRole("heading", { name: "My leave credits" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Vacation Leave" })).toHaveTextContent(/12 days left in \d{4}/);
    expect(screen.queryByRole("article", { name: "Maternity Leave" })).not.toBeInTheDocument();
  });
});
