import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScannerState } from "@/lib/face-recognition/scanner-machine";

const scanner = vi.hoisted(() => ({
  state: { status: "ready" } as ScannerState,
  start: vi.fn(),
  pause: vi.fn(),
  retry: vi.fn(),
  lowLight: false,
  diagnostics: { backend: "wasm" as string | null, detectionMs: 42 as number | null, brightness: 70 as number | null },
}));
vi.mock("@/hooks/use-face-attendance-scanner", () => ({ useFaceAttendanceScanner: () => ({ ...scanner, videoRef: { current: null } }) }));

const capture = vi.hoisted(() => ({ state: { phase: "idle" } as { phase: string }, begin: vi.fn(), cancel: vi.fn() }));
vi.mock("@/hooks/use-face-enrollment-capture", () => ({ useFaceEnrollmentCapture: () => ({ ...capture, videoRef: { current: null } }) }));

const enrollments = vi.hoisted(() => ({ data: [] as { employee_id: string; sample_count: number; enrolled_at: string; updated_at: string }[] }));
const deleteEnrollment = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-face-recognition", () => ({
  useFaceEnrollments: () => ({ isLoading: false, error: null, data: enrollments.data }),
  useDeleteFaceEnrollment: () => ({ isPending: false, mutateAsync: deleteEnrollment }),
}));
vi.mock("@/hooks/use-attendance-integration", () => ({
  useAttendanceEmployees: () => ({
    isLoading: false,
    error: null,
    data: [
      { id: "emp-1", employee_number: "PAT-001", first_name: "Ana", last_name: "One" },
      { id: "emp-2", employee_number: "PAT-002", first_name: "Ben", last_name: "Two" },
    ],
  }),
}));

import { FaceAttendanceKiosk } from "./face-attendance-kiosk";
import { FaceEnrollmentPanel } from "./face-enrollment-panel";

beforeEach(() => {
  vi.clearAllMocks();
  scanner.state = { status: "ready" };
  scanner.lowLight = false;
  window.history.replaceState({}, "", "/");
  capture.state = { phase: "idle" };
  enrollments.data = [];
});

describe("FaceAttendanceKiosk", () => {
  it("opens the scanner only when asked and closes it again", async () => {
    const user = userEvent.setup();
    render(<FaceAttendanceKiosk />);
    expect(screen.queryByLabelText("Camera preview")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open scanner/i }));
    expect(screen.getByLabelText("Camera preview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /start scanning/i }));
    expect(scanner.start).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /close scanner/i }));
    expect(screen.queryByLabelText("Camera preview")).not.toBeInTheDocument();
  });

  it("suggests more light when the face is dark", async () => {
    scanner.state = { status: "searching", stableFrames: 0, guidance: null };
    scanner.lowLight = true;
    const user = userEvent.setup();
    render(<FaceAttendanceKiosk />);
    await user.click(screen.getByRole("button", { name: /open scanner/i }));
    expect(screen.getByText(/Your face looks dark/)).toBeInTheDocument();
  });

  it("shows backend and timing diagnostics only when ?diagnostics=1 is in the URL", async () => {
    scanner.state = { status: "searching", stableFrames: 0, guidance: null };
    const user = userEvent.setup();
    const view = render(<FaceAttendanceKiosk />);
    await user.click(screen.getByRole("button", { name: /open scanner/i }));
    expect(screen.queryByTestId("face-diagnostics")).not.toBeInTheDocument();
    view.unmount();

    window.history.replaceState({}, "", "/hr/attendance/kiosk?diagnostics=1");
    render(<FaceAttendanceKiosk />);
    await user.click(screen.getByRole("button", { name: /open scanner/i }));
    expect(screen.getByTestId("face-diagnostics")).toHaveTextContent("backend wasm · detection 42 ms · brightness 70");
  });

  it("shows the recognized employee and recorded time", async () => {
    scanner.state = { status: "success", result: { scanId: "s", outcome: "time_in", message: null, distance: 0.3, employee: { id: "e", employeeNumber: "PAT-001", firstName: "Ana", lastName: "One" }, log: { id: "l", attendanceDate: "2026-09-25", timeIn: "2026-09-25T00:05:00Z", timeOut: null, status: "incomplete" }, recordedAt: "2026-09-25T00:05:00Z" } };
    const user = userEvent.setup();
    render(<FaceAttendanceKiosk />);
    await user.click(screen.getByRole("button", { name: /open scanner/i }));

    expect(screen.getByText("Ana One")).toBeInTheDocument();
    expect(screen.getByText(/PAT-001 · Time in at/)).toBeInTheDocument();
  });

  it.each([
    [{ status: "searching", stableFrames: 0, guidance: null }, /look at the camera/i],
    [{ status: "verifying" }, /verifying identity/i],
    [{ status: "initializing" }, /loading face models/i],
  ] as [ScannerState, RegExp][])("prompts for %o", async (state, text) => {
    scanner.state = state;
    const user = userEvent.setup();
    render(<FaceAttendanceKiosk />);
    await user.click(screen.getByRole("button", { name: /open scanner/i }));
    expect(screen.getByRole("status")).toHaveTextContent(text);
  });

  it("shows 'Face not recognized' and a retry for fatal camera errors", async () => {
    scanner.state = { status: "error", kind: "not_recognized", message: "Face not recognized.", fatal: false };
    const user = userEvent.setup();
    const view = render(<FaceAttendanceKiosk />);
    await user.click(screen.getByRole("button", { name: /open scanner/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Face not recognized");

    scanner.state = { status: "error", kind: "camera_denied", message: "Camera access was denied.", fatal: true };
    view.rerender(<FaceAttendanceKiosk />);
    expect(screen.getByRole("alert")).toHaveTextContent("Camera access was denied.");
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(scanner.retry).toHaveBeenCalled();
  });
});

describe("FaceEnrollmentPanel", () => {
  async function selectBen() {
    const user = userEvent.setup();
    render(<FaceEnrollmentPanel />);
    await user.type(screen.getByRole("combobox", { name: /employee/i }), "PAT-002");
    await user.click(await screen.findByRole("option", { name: /Ben Two/ }));
    return user;
  }

  it("requires consent before registering the selected employee", async () => {
    const user = await selectBen();
    const start = screen.getByRole("button", { name: /start face registration/i });
    expect(start).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    await user.click(start);
    expect(capture.begin).toHaveBeenCalledWith({ employeeId: "emp-2", consentConfirmed: true });
  });

  it("offers re-registration and deletion for an enrolled employee", async () => {
    enrollments.data = [{ employee_id: "emp-2", sample_count: 5, enrolled_at: "2026-09-20T00:00:00Z", updated_at: "2026-09-20T00:00:00Z" }];
    deleteEnrollment.mockResolvedValue(undefined);
    const user = await selectBen();

    expect(screen.getByRole("button", { name: /re-register face/i })).toBeInTheDocument();
    expect(screen.getByText(/keeps the current registration until the new one is saved/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete registration/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));
    expect(deleteEnrollment).toHaveBeenCalledWith("emp-2");
  });

  it("locks the employee selection while capturing", async () => {
    capture.state = { phase: "capturing" };
    render(<FaceEnrollmentPanel />);
    expect(screen.getByRole("combobox", { name: /employee/i })).toBeDisabled();
  });
});
