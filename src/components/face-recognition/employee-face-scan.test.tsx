import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Registration = { isLoading: boolean; error: Error | null; data: { registered: boolean; updatedAt: string | null } | undefined };
const registration = vi.hoisted(() => ({ value: { isLoading: false, error: null, data: { registered: false, updatedAt: null } } as Registration }));
vi.mock("@/hooks/use-face-recognition", () => ({ useMyFaceRegistration: () => registration.value }));

const scanner = vi.hoisted(() => ({ mode: null as string | null, cleanup: vi.fn() }));
vi.mock("./face-attendance-kiosk", () => ({
  FaceScanner: ({ mode, onClose }: { mode: string; onClose: () => void }) => {
    scanner.mode = mode;
    // Stands in for the real scanner's camera stop on unmount (covered by the scanner hook tests).
    useEffect(() => scanner.cleanup, []);
    return <div><p>scanner open</p><button onClick={onClose} type="button">Close scanner</button></div>;
  },
}));

import { EmployeeFaceScan } from "./employee-face-scan";

const registered = { registered: true, updatedAt: "2026-09-25T00:00:00Z" };

beforeEach(() => { scanner.mode = null; scanner.cleanup.mockClear(); registration.value = { isLoading: false, error: null, data: { registered: false, updatedAt: null } }; });

describe("EmployeeFaceScan", () => {
  it("shows the biometric panel with the Scan Attendance Now call to action and no scanner yet", () => {
    registration.value.data = registered;
    render(<EmployeeFaceScan />);
    expect(screen.getByRole("button", { name: "Scan Attendance Now" })).toBeVisible();
    expect(screen.getByText("Record Attendance with Face Verification")).toBeVisible();
    expect(screen.queryByText("scanner open")).not.toBeInTheDocument();
  });

  it("asks an unregistered employee to see HR and never opens the camera", async () => {
    render(<EmployeeFaceScan />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Scan Attendance Now" }));
    expect(screen.getByText(/ask HR to register it/i)).toBeInTheDocument();
    expect(screen.queryByText("scanner open")).not.toBeInTheDocument();
  });

  it("keeps registration lookup errors visible", async () => {
    registration.value = { isLoading: false, error: new Error("registration lookup failed"), data: undefined };
    render(<EmployeeFaceScan />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Scan Attendance Now" }));
    expect(screen.getByText("registration lookup failed")).toBeInTheDocument();
  });

  it("does not claim a missing registration while it is still loading", async () => {
    registration.value = { isLoading: true, error: null, data: undefined };
    render(<EmployeeFaceScan />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Scan Attendance Now" }));
    expect(screen.queryByText(/ask HR to register it/i)).not.toBeInTheDocument();
  });

  it("opens the scanner in self-verification mode and stops it when closed", async () => {
    registration.value.data = registered;
    const user = userEvent.setup();
    render(<EmployeeFaceScan />);
    await user.click(screen.getByRole("button", { name: "Scan Attendance Now" }));
    expect(screen.getByText("scanner open")).toBeInTheDocument();
    expect(scanner.mode).toBe("self");
    await user.click(screen.getByRole("button", { name: "Close scanner" }));
    expect(screen.queryByText("scanner open")).not.toBeInTheDocument();
    expect(scanner.cleanup).toHaveBeenCalledTimes(1);
  });

  it("stops the scanner when the page unmounts", async () => {
    registration.value.data = registered;
    const user = userEvent.setup();
    const view = render(<EmployeeFaceScan />);
    await user.click(screen.getByRole("button", { name: "Scan Attendance Now" }));
    view.unmount();
    expect(scanner.cleanup).toHaveBeenCalledTimes(1);
  });
});
