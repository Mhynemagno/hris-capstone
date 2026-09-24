import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@/hooks/use-attendance-integration", () => ({
  useAttendanceSettings: () => ({
    isLoading: false,
    error: null,
    data: {
      id: "s1",
      adapter_key: "csv_xlsx",
      timezone: "Asia/Ulaanbaatar",
      workday_start: "08:00:00",
      late_grace_minutes: 15,
      template_version: "custom",
      is_enabled: true,
      updated_by_user_id: null,
      updated_at: "2026-09-01T00:00:00Z",
    },
  }),
  useSaveAttendanceSettings: () => ({ isPending: false, mutateAsync: mocks.save }),
}));

import { AttendanceIntegrationSettings } from "./attendance-integration-settings";

describe("AttendanceIntegrationSettings", () => {
  beforeEach(() => {
    mocks.save.mockReset();
  });

  it("shows the template version read-only and always submits the supported v1 template", async () => {
    mocks.save.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AttendanceIntegrationSettings />);

    expect(screen.queryByRole("textbox", { name: /template/i })).not.toBeInTheDocument();
    expect(screen.getByText("v1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(mocks.save).toHaveBeenCalledWith({ workdayStart: "08:00", lateGraceMinutes: 15, templateVersion: "v1", isEnabled: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Attendance settings saved.");
  });

  it("reports save failures and invalid grace minutes inline", async () => {
    mocks.save.mockRejectedValue(new Error("Only administrators can change settings."));
    const user = userEvent.setup();
    render(<AttendanceIntegrationSettings />);

    const grace = screen.getByLabelText(/Late grace minutes/);
    await user.clear(grace);
    await user.type(grace, "500");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(screen.getByText("Enter a whole number of minutes from 0 to 120.")).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();

    await user.clear(grace);
    await user.type(grace, "10");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only administrators can change settings.");
  });
});
