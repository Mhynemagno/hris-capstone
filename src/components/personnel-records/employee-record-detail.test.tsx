import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteTraining: vi.fn(),
  useEmployee: vi.fn(),
  useEntries: vi.fn(),
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/hr/employees/00000000-0000-4000-8000-000000000010",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/hooks/use-personnel-records", () => ({
  useDeletePersonnelEntry: () => ({ isPending: false, mutateAsync: mocks.deleteTraining }),
  useEmployee: mocks.useEmployee,
  usePersonnelEntries: mocks.useEntries,
  useSavePersonnelEntry: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({ data: [], isLoading: false, error: null }),
  useRankOptions: () => ({ data: [], isLoading: false, error: null }),
}));
vi.mock("./employee-editor", () => ({ EmployeeEditor: () => <div>Employee editor</div> }));

import { EmployeeRecordDetail } from "./employee-record-detail";

const employeeId = "00000000-0000-4000-8000-000000000010";

describe("EmployeeRecordDetail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.search = "tab=training";
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

  it("shows only the section named in the URL and switches tabs through the URL", async () => {
    const user = userEvent.setup();
    mocks.search = "tab=qualifications";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByRole("tab", { name: "Qualifications" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Qualifications" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Service history" })).not.toBeInTheDocument();
    // Other panels stay mounted but hidden, so unsaved official-record edits survive a tab switch.
    expect(screen.getByText("Employee editor")).not.toBeVisible();
    expect(screen.getByRole("tab", { name: "Official record" })).toHaveAttribute("aria-controls", "rec-panel-official");
    expect(document.getElementById("rec-panel-official")).toHaveAttribute("hidden");

    await user.click(screen.getByRole("tab", { name: "Training" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=training", { scroll: false });
  });

  it("opens the official record by default and for an unknown tab", () => {
    mocks.search = "tab=nonsense";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByRole("tab", { name: "Official record" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Employee editor")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Training" })).not.toBeInTheDocument();
  });
});
