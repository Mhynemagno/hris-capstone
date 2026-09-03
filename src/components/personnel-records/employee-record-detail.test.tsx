import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteTraining: vi.fn(),
  useEmployee: vi.fn(),
  useEntries: vi.fn(),
}));

vi.mock("@/hooks/use-personnel-records", () => ({
  useDeletePersonnelEntry: () => ({ isPending: false, mutateAsync: mocks.deleteTraining }),
  useEmployee: mocks.useEmployee,
  usePersonnelEntries: mocks.useEntries,
  useSavePersonnelEntry: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("./employee-editor", () => ({ EmployeeEditor: () => <div>Employee editor</div> }));

import { EmployeeRecordDetail } from "./employee-record-detail";

const employeeId = "00000000-0000-4000-8000-000000000010";

describe("EmployeeRecordDetail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.deleteTraining.mockResolvedValue(undefined);
    mocks.useEmployee.mockReturnValue({ data: { id: employeeId, first_name: "Ada", last_name: "Dela Cruz", employee_number: "PAT-001", employment_status: "active" }, isLoading: false });
    mocks.useEntries.mockImplementation((kind: string) => ({
      data: kind === "training" ? [{
        id: "00000000-0000-4000-8000-000000000020",
        employee_id: employeeId,
        course_name: "Leadership Development",
        provider: "Police Academy",
        completed_on: "2026-01-01",
        expires_on: null,
        hours: 16,
        notes: null,
      }] : [],
      isLoading: false,
    }));
  });

  it("requires confirmation before deleting a training record", async () => {
    const user = userEvent.setup();
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Delete training record?");
    await user.click(screen.getByRole("button", { name: "Delete training" }));

    await waitFor(() => expect(mocks.deleteTraining).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000020"));
  });
});
