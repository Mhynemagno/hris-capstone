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
    return { isLoading: false, error: null, data: { rows: mocks.rows, count: mocks.rows.length } };
  },
  useLeaveTypes: () => ({ isLoading: false, error: null, data: { rows: [], count: 0 } }),
  useLeaveRequest: () => ({
    isLoading: false,
    error: null,
    data: {
      id: "123e4567-e89b-42d3-a456-426614174000",
      employee_id: "e1",
      leave_type_id: "t-sick",
      leave_type_name: "Annual leave",
      excess_days: 0,
      starts_on: "2026-10-01",
      ends_on: "2026-10-02",
      reason: "Family event",
      status: "pending",
      decision_note: null,
      created_at: "2026-09-20T00:00:00Z",
      employees: { first_name: "Juan", middle_name: "Santos", last_name: "Dela Cruz", employee_number: "PNP-0001" },
      leave_request_attachments: [],
    },
  }),
  useDecideLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.decide }),
  useEmployeeLeaveBalances: () => ({ isLoading: false, error: null, data: [{ leave_type_id: "t-sick", days_per_year: 15, excess_deducted_from_retirement: false, used_days: 6 }] }),
}));

const navigation = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/hr/leave-requests",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

import { HrLeaveDetail, HrLeaveQueue } from "./hr-leave";
import { HrLeaveWorkspace } from "./hr-leave-workspace";

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

  it("shows who submitted the leave and its dates in words", () => {
    render(<HrLeaveDetail requestId="123e4567-e89b-42d3-a456-426614174000" />);

    expect(screen.getByText("Juan Santos Dela Cruz")).toBeVisible();
    expect(screen.getByText(/Badge no\. PNP-0001/)).toBeVisible();
    expect(screen.getByText("October 1, 2026 to October 2, 2026")).toBeVisible();
    expect(screen.getByText("September 20, 2026")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeVisible();
    expect(screen.queryByText("Decision note")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveAccessibleDescription(/required when rejecting/);
  });

  it("requires a note before rejecting", async () => {
    const user = userEvent.setup();
    render(<HrLeaveDetail requestId="123e4567-e89b-42d3-a456-426614174000" />);

    await user.click(screen.getByRole("button", { name: "Reject request" }));

    expect(await screen.findByText("Provide a reason when rejecting a leave request.")).toBeVisible();
    expect(mocks.decide).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInvalid();
  });
});

describe("HrLeaveQueue", () => {
  it("shows the submitting employee and dates in words", () => {
    mocks.rows = [
      {
        id: "123e4567-e89b-42d3-a456-426614174000",
        leave_type_name: "Mandatory leave",
        starts_on: "2026-09-23",
        ends_on: "2026-09-25",
        status: "pending",
        created_at: "2026-09-20T03:00:00Z",
        employees: { first_name: "Maria", middle_name: null, last_name: "Reyes", employee_number: "PNP-0002" },
      },
    ];
    render(<HrLeaveQueue />);

    expect(screen.getByRole("columnheader", { name: "Employee" })).toBeVisible();
    expect(screen.getByText("Maria Reyes")).toBeVisible();
    expect(screen.getByText("Badge no. PNP-0002")).toBeVisible();
    expect(screen.getByText("September 23, 2026 to September 25, 2026")).toBeVisible();
    expect(screen.getByText("September 20, 2026")).toBeVisible();
    expect(screen.getByRole("link", { name: "Review Maria Reyes's Mandatory leave request, September 23, 2026 to September 25, 2026" })).toBeVisible();
  });

  it("filters the queue by status and shows a helpful empty state", async () => {
    mocks.rows = [];
    const user = userEvent.setup();
    render(<HrLeaveQueue />);
    expect(screen.getByText("No leave requests have been submitted yet.")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Status"), "pending");

    expect(mocks.hrQueueInput).toHaveBeenLastCalledWith(expect.objectContaining({ status: "pending" }));
    expect(screen.getByText("No leave requests are for approval. Try another status.")).toBeVisible();
  });
});

describe("HrLeaveQueue status link", () => {
  it("opens on the status named in the URL and ignores unknown values", () => {
    navigation.search = "status=pending";
    const { unmount } = render(<HrLeaveQueue />);
    expect(mocks.hrQueueInput).toHaveBeenLastCalledWith(expect.objectContaining({ status: "pending" }));
    unmount();
    navigation.search = "status=bogus";
    render(<HrLeaveQueue />);
    expect(mocks.hrQueueInput).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }));
    navigation.search = "";
  });
});

describe("HrLeaveWorkspace", () => {
  it("opens requested pending requests on the URL-selected page", () => {
    navigation.search = "tab=requests&status=pending&page=2";
    render(<HrLeaveWorkspace />);

    expect(screen.getByRole("tab", { name: /requests/i })).toHaveAttribute("aria-selected", "true");
    expect(mocks.hrQueueInput).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 10, status: "pending" }));
    navigation.search = "";
  });
  it("summarises the request in a header card with the day count and the employee's remaining credits", () => {
    render(<HrLeaveDetail requestId="123e4567-e89b-42d3-a456-426614174000" />);
    expect(screen.getByText("2 days")).toBeInTheDocument();
    const credits = screen.getByRole("region", { name: "Leave credits" });
    expect(credits).toHaveTextContent("9 of 15 days left in 2026");
    expect(screen.getByRole("region", { name: "Supporting documents" })).toHaveTextContent("No documents attached.");
  });
});
