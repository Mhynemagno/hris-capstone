import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), balances: [] as Array<Record<string, unknown>> }));

vi.mock("@/hooks/use-leave-management", () => ({
  useRequestableLeaveTypes: () => ({
    isLoading: false,
    error: null,
    data: [
      { id: "11111111-1111-4111-8111-111111111111", name: "Annual leave", requires_attachment: false, is_active: true, eligible_gender: null },
      { id: "33333333-3333-4333-8333-333333333333", name: "Sick leave", requires_attachment: true, is_active: true, eligible_gender: null },
    ],
  }),
  useSubmitLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.submit }),
  useMyLeaveBalances: () => ({ isLoading: false, error: null, data: mocks.balances }),
}));
vi.mock("@/hooks/use-personnel-records", () => ({ useEmployeeForCurrentUser: () => ({ isLoading: false, error: null, data: { gender: "male" } }) }));

import { EmployeeLeaveRequestModal } from "./employee-leave-request-modal";

const isoDate = (offsetDays: number) => {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

describe("EmployeeLeaveRequestModal", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.balances = [];
  });

  it("renders nothing while closed", () => {
    render(<EmployeeLeaveRequestModal onOpenChange={vi.fn()} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as File Leave Application with the existing request form", () => {
    render(<EmployeeLeaveRequestModal onOpenChange={vi.fn()} open />);
    const dialog = screen.getByRole("dialog", { name: "File Leave Application" });
    expect(within(dialog).getByRole("combobox", { name: /Leave type/ })).toBeVisible();
    expect(within(dialog).getByLabelText(/Start date/)).toBeVisible();
  });

  it("asks to close from Cancel and the close button", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestModal onOpenChange={onOpenChange} open />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps validation: a document is required for a type that needs one", async () => {
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestModal onOpenChange={vi.fn()} open />);
    await user.selectOptions(screen.getByRole("combobox", { name: /Leave type/ }), "33333333-3333-4333-8333-333333333333");
    await user.type(screen.getByLabelText(/Start date/), isoDate(1));
    await user.type(screen.getByLabelText(/End date/), isoDate(2));
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(await screen.findByText("Attach a supporting document, such as a medical certificate.")).toBeVisible();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("keeps the modal open and shows the error when submission fails", async () => {
    mocks.submit.mockRejectedValue(new Error("Server said no"));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestModal onOpenChange={onOpenChange} open />);
    await user.selectOptions(screen.getByRole("combobox", { name: /Leave type/ }), "11111111-1111-4111-8111-111111111111");
    await user.type(screen.getByLabelText(/Start date/), isoDate(1));
    await user.type(screen.getByLabelText(/End date/), isoDate(2));
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Server said no");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("reports success and closes", async () => {
    mocks.submit.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    render(<EmployeeLeaveRequestModal onOpenChange={onOpenChange} onSubmitted={onSubmitted} open />);
    await user.selectOptions(screen.getByRole("combobox", { name: /Leave type/ }), "11111111-1111-4111-8111-111111111111");
    await user.type(screen.getByLabelText(/Start date/), isoDate(1));
    await user.type(screen.getByLabelText(/End date/), isoDate(2));
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSubmitted).toHaveBeenCalledWith(expect.stringContaining("Leave request submitted."));
  });
});
