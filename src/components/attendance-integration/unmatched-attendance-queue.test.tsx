import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const resolve = vi.fn();

vi.mock("@/hooks/use-attendance-integration", () => ({
  useUnmatchedAttendanceEvents: () => ({
    isLoading: false,
    error: null,
    data: { rows: [{ id: "evt-1", external_employee_id: "DEV-77", attendance_date: "2026-09-01", source_event_id: "src-1" }] },
  }),
  useAttendanceEmployees: () => ({
    isLoading: false,
    error: null,
    data: [
      { id: "emp-1", employee_number: "PAT-001", first_name: "Ana", last_name: "One" },
      { id: "emp-2", employee_number: "PAT-002", first_name: "Ben", last_name: "Two" },
    ],
  }),
  useResolveUnmatchedAttendanceEvent: () => ({ isPending: false, mutateAsync: resolve }),
}));

import { UnmatchedAttendanceQueue } from "./unmatched-attendance-queue";

describe("UnmatchedAttendanceQueue", () => {
  it("maps an external ID to an employee chosen from a searchable list and confirms it", async () => {
    resolve.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<UnmatchedAttendanceQueue />);

    const button = screen.getByRole("button", { name: "Map and resolve" });
    expect(button).toBeDisabled();
    await user.type(screen.getByRole("combobox", { name: /employee for DEV-77/i }), "PAT-002");
    await user.click(await screen.findByRole("option", { name: /Ben Two/ }));
    await user.click(button);

    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ unmatchedEventId: "evt-1", employeeId: "emp-2", externalEmployeeId: "DEV-77" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Mapped DEV-77 to Ben Two.");
  });

  it("shows a failure next to the row", async () => {
    resolve.mockRejectedValue(new Error("External ID already mapped."));
    const user = userEvent.setup();
    render(<UnmatchedAttendanceQueue />);

    await user.type(screen.getByRole("combobox", { name: /employee for DEV-77/i }), "Ana");
    await user.click(await screen.findByRole("option", { name: /Ana One/ }));
    await user.click(screen.getByRole("button", { name: "Map and resolve" }));

    expect(await screen.findByText("External ID already mapped.")).toBeInTheDocument();
  });
});
