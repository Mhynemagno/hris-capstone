import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/face-recognition/face-attendance-kiosk", () => ({ FaceScanner: ({ mode }: { mode: string }) => <p>scanner {mode}</p> }));

import { AttendanceKioskOverlay } from "./attendance-kiosk-overlay";

describe("AttendanceKioskOverlay (attendance.html kiosk)", () => {
  it("shows the kiosk with the scanner and a live clock", () => {
    render(<AttendanceKioskOverlay onClose={vi.fn()} open />);
    expect(screen.getByRole("dialog", { name: "Attendance kiosk" })).toBeInTheDocument();
    expect(screen.getByText("Biometric Face Recognition Attendance Kiosk")).toBeInTheDocument();
    expect(screen.getByText("Look at the Camera")).toBeInTheDocument();
    expect(screen.getByText("scanner kiosk")).toBeInTheDocument();
    expect(screen.getByText(/^\d{2}:\d{2}:\d{2} (AM|PM)$/)).toBeInTheDocument();
  });

  it("exits with the button and with Escape", async () => {
    const onClose = vi.fn();
    render(<AttendanceKioskOverlay onClose={onClose} open />);
    await userEvent.click(screen.getByRole("button", { name: /Exit Kiosk Mode/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
