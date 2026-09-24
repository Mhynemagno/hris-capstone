import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decide: vi.fn(),
  hrQueueInput: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/queries/leave-management", () => ({ getLeaveAttachmentUrl: vi.fn() }));
vi.mock("@/hooks/use-leave-management", () => ({
  useHrLeaveRequests: (input: unknown) => {
    mocks.hrQueueInput(input);
    return { isLoading: false, error: null, data: { rows: mocks.rows } };
  },
  useLeaveRequest: () => ({
    isLoading: false,
    error: null,
    data: {
      id: "123e4567-e89b-42d3-a456-426614174000",
      leave_type_name: "Annual leave",
      starts_on: "2026-10-01",
      ends_on: "2026-10-02",
      reason: "Family event",
      status: "pending",
      decision_note: null,
      created_at: "2026-09-20T00:00:00Z",
      leave_request_attachments: [],
    },
  }),
  useDecideLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.decide }),
}));

import { HrLeaveDetail, HrLeaveQueue } from "./hr-leave";

describe("HrLeaveDetail", () => {
  beforeEach(() => {
    mocks.decide.mockReset();
  });

  it("surfaces a failed decision instead of swallowing it", async () => {
    mocks.decide.mockRejectedValue(new Error("Only pending requests can be decided."));
    const user = userEvent.setup();
    render(<HrLeaveDetail requestId="123e4567-e89b-42d3-a456-426614174000" />);

    await user.click(screen.getByRole("button", { name: "Approve request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only pending requests can be decided.");
  });

  it("requires a note before rejecting", async () => {
    const user = userEvent.setup();
    render(<HrLeaveDetail requestId="123e4567-e89b-42d3-a456-426614174000" />);

    await user.click(screen.getByRole("button", { name: "Reject request" }));

    expect(await screen.findByText("Provide a reason when rejecting a leave request.")).toBeVisible();
    expect(mocks.decide).not.toHaveBeenCalled();
  });
});

describe("HrLeaveQueue", () => {
  it("filters the queue by status and shows a helpful empty state", async () => {
    mocks.rows = [];
    const user = userEvent.setup();
    render(<HrLeaveQueue />);
    expect(screen.getByText("No leave requests have been submitted yet.")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Status"), "pending");

    expect(mocks.hrQueueInput).toHaveBeenLastCalledWith(expect.objectContaining({ status: "pending" }));
    expect(screen.getByText("No pending leave requests. Try another status.")).toBeVisible();
  });
});
