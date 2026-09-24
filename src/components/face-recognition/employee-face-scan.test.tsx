import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const registration = vi.hoisted(() => ({ data: { registered: false, updatedAt: null as string | null } }));
vi.mock("@/hooks/use-face-recognition", () => ({ useMyFaceRegistration: () => ({ isLoading: false, error: null, data: registration.data }) }));

const scannerMode = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("./face-attendance-kiosk", () => ({ FaceScanner: ({ mode }: { mode: string }) => { scannerMode.value = mode; return <p>scanner open</p>; } }));

import { EmployeeFaceScan } from "./employee-face-scan";

beforeEach(() => { scannerMode.value = null; });

describe("EmployeeFaceScan", () => {
  it("asks an unregistered employee to see HR and never opens the camera", () => {
    registration.data = { registered: false, updatedAt: null };
    render(<EmployeeFaceScan />);
    expect(screen.getByText(/ask HR to register it/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open camera/i })).not.toBeInTheDocument();
  });

  it("opens the scanner in self-verification mode for a registered employee", async () => {
    registration.data = { registered: true, updatedAt: "2026-09-25T00:00:00Z" };
    const user = userEvent.setup();
    render(<EmployeeFaceScan />);
    await user.click(screen.getByRole("button", { name: /open camera/i }));
    expect(screen.getByText("scanner open")).toBeInTheDocument();
    expect(scannerMode.value).toBe("self");
  });
});
