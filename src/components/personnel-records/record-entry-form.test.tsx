import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordEntryForm } from "./record-entry-form";

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

    expect(screen.getByLabelText("Course name")).toHaveValue("Leadership Development");
    expect(screen.getByLabelText("Notes")).toHaveValue("Initial qualification");
    await user.clear(screen.getByLabelText("Notes"));
    await user.type(screen.getByLabelText("Notes"), "Updated qualification");
    await user.click(screen.getByRole("button", { name: "Save training" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      courseName: "Leadership Development",
      notes: "Updated qualification",
    }), training.id));
  });
});
