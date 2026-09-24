import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  types: [] as Array<Record<string, unknown>>,
  cancel: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("@/hooks/use-leave-management", () => ({
  useMyLeaveRequests: () => ({ isLoading: false, error: null, data: { rows: mocks.rows } }),
  useCancelLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.cancel }),
  useRequestableLeaveTypes: () => ({ isLoading: false, error: null, data: mocks.types }),
  useSubmitLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.submit }),
}));

import { EmployeeLeaveList, EmployeeLeaveRequestForm } from "./employee-leave";

const isoDate = (offsetDays: number) => {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

describe("EmployeeLeaveList", () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.cancel.mockReset();
  });

  it("shows a useful empty state when there are no leave requests", () => {
    render(<EmployeeLeaveList />);
    expect(screen.getByText(/No leave requests yet\./)).toBeVisible();
    expect(screen.getByRole("link", { name: "Request leave" })).toHaveAttribute("href", "/employee/leave/new");
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
});

describe("EmployeeLeaveRequestForm", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.types = [
      { id: "11111111-1111-4111-8111-111111111111", name: "Annual leave", requires_attachment: false, is_active: true },
      { id: "22222222-2222-4222-8222-222222222222", name: "Retired leave", requires_attachment: false, is_active: false },
      { id: "33333333-3333-4333-8333-333333333333", name: "Sick leave", requires_attachment: true, is_active: true },
    ];
  });

  it("offers only active leave types and explains the attachment requirement", async () => {
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestForm />);
    const select = screen.getByRole("combobox", { name: /Leave type/ });
    const options = within(select).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Choose a type", "Annual leave", "Sick leave (evidence required)"]);

    await user.selectOptions(select, "33333333-3333-4333-8333-333333333333");
    expect(screen.getByText(/Sick leave requires supporting evidence/)).toBeVisible();
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
    await user.type(screen.getByLabelText(/Reason/), "Family event");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("End date must be on or after the start date.")).toBeVisible();
    expect(screen.getByLabelText(/End date/)).toHaveAttribute("aria-invalid", "true");
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("requires evidence for leave types that need it", async () => {
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestForm />);
    await user.selectOptions(screen.getByRole("combobox", { name: /Leave type/ }), "33333333-3333-4333-8333-333333333333");
    await user.type(screen.getByLabelText(/Start date/), isoDate(1));
    await user.type(screen.getByLabelText(/End date/), isoDate(2));
    await user.type(screen.getByLabelText(/Reason/), "Flu");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText(/requires supporting evidence\. Attach at least one document/)).toBeVisible();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
