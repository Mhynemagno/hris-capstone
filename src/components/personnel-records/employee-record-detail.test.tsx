import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  useEmployeeProfilePhotoUrl: () => ({ data: null }),
  useRemoveMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
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
    mocks.useEmployee.mockReturnValue({ data: { id: employeeId, first_name: "Ada", last_name: "Dela Cruz", employee_number: "PAT-001", employment_status: "active", date_of_birth: "1990-09-23", gender: "female", place_of_birth: "Quezon City", phone: "+639171234567", employment_started_on: "2024-01-01" }, isLoading: false });
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
    mocks.search = "tab=training&mode=edit";
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
    // Other panels stay mounted but hidden.
    expect(screen.getByRole("heading", { name: "Official record", hidden: true })).not.toBeVisible();
    expect(screen.getByRole("tab", { name: "Official record" })).toHaveAttribute("aria-controls", "rec-panel-official");
    expect(document.getElementById("rec-panel-official")).toHaveAttribute("hidden");

    await user.click(screen.getByRole("tab", { name: "Training" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=training", { scroll: false });
  });

  it("shows a profile header, section counts, and a recent activity timeline", () => {
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByRole("heading", { level: 1, name: "Ada Dela Cruz" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Employee summary" })).getByText("PAT-001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Promotion review" })).toHaveAttribute("href", `/hr/promotions/${employeeId}`);
    expect(screen.getByRole("tab", { name: "Training" })).toHaveTextContent("Training1");
    const activity = screen.getByRole("region", { name: "Recent activity" });
    expect(activity).toHaveTextContent("Leadership Development");
    expect(activity).toHaveTextContent("Police Academy · 16 hours");
  });

  it("opens the official record when Edit details is chosen", async () => {
    const user = userEvent.setup();
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=official&mode=edit", { scroll: false });
  });

  it("shows the official record as a read-only list in view mode", () => {
    mocks.search = "";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    const official = screen.getByRole("region", { name: "Official record" });
    expect(screen.queryByText("Employee editor")).not.toBeInTheDocument();
    expect(official.querySelectorAll("input, select, textarea")).toHaveLength(0);
    expect(official).toHaveTextContent("Place of birthQuezon City");
    expect(official).toHaveTextContent("Date of birthSeptember 23, 1990");
    expect(official).toHaveTextContent("Employment start dateJanuary 1, 2024");
    expect(official).toHaveTextContent("Religion" + "Not provided");
    expect(screen.getByText("Born").nextElementSibling).toHaveTextContent("September 23, 1990");
  });

  it("hides add, edit, and delete controls on every section in view mode", () => {
    mocks.search = "tab=training";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    const training = screen.getByRole("region", { name: "Training" });
    expect(training).toHaveTextContent("Police Academy · January 1, 2026 · 16 hours");
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add training/i, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add qualification/i, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add service history/i, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add certification/i, hidden: true })).not.toBeInTheDocument();
  });

  it("makes every section editable in edit mode and returns to view mode", async () => {
    const user = userEvent.setup();
    mocks.search = "tab=official&mode=edit";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByText("Employee editor")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add training/i, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add qualification/i, hidden: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=official", { scroll: false });
    await user.click(screen.getByRole("button", { name: "Done editing" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=official", { scroll: false });
  });

  it("keeps edit mode when switching tabs", async () => {
    const user = userEvent.setup();
    mocks.search = "tab=official&mode=edit";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    await user.click(screen.getByRole("tab", { name: "Qualifications" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=qualifications&mode=edit", { scroll: false });
  });

  it.each([
    ["created", "Employee account has been saved."],
    ["edited", "Employee account has been edited successfully."],
  ])("confirms a %s employee with a success message", async (saved, message) => {
    const user = userEvent.setup();
    mocks.search = `tab=official&saved=${saved}`;
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByRole("status")).toHaveTextContent(message);
    await user.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=official", { scroll: false });
  });

  it("opens the official record by default and for an unknown tab", () => {
    mocks.search = "tab=nonsense";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByRole("tab", { name: "Official record" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Official record" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Training" })).not.toBeInTheDocument();
  });
});
