import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordEntryForm } from "./record-entry-form";

const stamp = { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({
    data: [{ id: 3, name: "Operations", is_active: true, ...stamp }, { id: 4, name: "Records", is_active: true, ...stamp }],
    isLoading: false,
    error: null,
  }),
  usePositionOptions: () => ({
    data: [
      { id: 7, department_id: 3, title: "Patrol Officer", code: null, description: null, is_active: true, ...stamp },
      { id: 9, department_id: 4, title: "Records Clerk", code: null, description: null, is_active: true, ...stamp },
    ],
    isLoading: false,
    error: null,
  }),
}));

const employeeId = "00000000-0000-4000-8000-000000000010";
const training = {
  id: "00000000-0000-4000-8000-000000000020",
  employee_id: employeeId,
  course_name: "Leadership Development",
  provider: "Police Academy",
  completed_on: "2026-01-01",
  expires_on: null,
  hours: 16,
  notes: "Initial qualification",
};

describe("RecordEntryForm", () => {
  it("edits an existing training record with its current values", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<RecordEntryForm employeeId={employeeId} kind="training" onSaved={onSaved} training={training} />);

    expect(screen.getByLabelText(/^course name/i)).toHaveValue("Leadership Development");
    expect(screen.getByLabelText("Notes")).toHaveValue("Initial qualification");
    await user.clear(screen.getByLabelText("Notes"));
    await user.type(screen.getByLabelText("Notes"), "Updated qualification");
    await user.click(screen.getByRole("button", { name: "Save training" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      courseName: "Leadership Development",
      notes: "Updated qualification",
    }), training.id));
  });

  it("records service history with a department-filtered position and optional title", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<RecordEntryForm employeeId={employeeId} kind="serviceHistory" onSaved={onSaved} />);

    expect(screen.getByLabelText("Position")).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Department"), "4");
    expect(screen.queryByRole("option", { name: "Patrol Officer" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Position"), "9");
    await user.type(screen.getByLabelText(/start date/i), "2025-01-01");
    expect(screen.getByLabelText(/end date/i)).toHaveAttribute("min", "2025-01-01");
    await user.type(screen.getByLabelText("Notes"), "Transferred");
    await user.click(screen.getByRole("button", { name: "Add service history" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      departmentId: 4,
      positionId: 9,
      employmentTitle: undefined,
      notes: "Transferred",
      startedOn: "2025-01-01",
    }), undefined));
    expect(await screen.findByRole("status")).toHaveTextContent("Service history added.");
  });

  it("shows the end date error next to the end date field", async () => {
    const user = userEvent.setup();
    render(<RecordEntryForm employeeId={employeeId} kind="certification" onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/certificate name/i), "First Aid");
    await user.type(screen.getByLabelText(/issuer/i), "Red Cross");
    await user.type(screen.getByLabelText(/issued date/i), "2025-05-01");
    await user.type(screen.getByLabelText(/expiry date/i), "2025-01-01");
    await user.click(screen.getByRole("button", { name: "Add certification" }));

    expect(screen.getByLabelText(/expiry date/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Expiry date cannot be before the issued date.")).toBeInTheDocument();
  });

  it("offers qualification levels as a select", () => {
    render(<RecordEntryForm employeeId={employeeId} kind="qualification" onSaved={vi.fn()} />);

    expect(screen.getByLabelText("Qualification level")).toHaveRole("combobox");
    expect(screen.getByRole("option", { name: "Bachelor's Degree" })).toBeInTheDocument();
  });
});
