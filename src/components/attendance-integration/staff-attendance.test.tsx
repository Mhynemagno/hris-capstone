import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/hr/attendance", useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.params }));
vi.mock("./attendance-record-modal", () => ({ AttendanceRecordModal: ({ log }: { log: { id: string } | null }) => (log ? <div role="dialog">Record {log.id}</div> : null) }));
vi.mock("./attendance-kiosk-overlay", () => ({ AttendanceKioskOverlay: ({ open }: { open: boolean }) => (open ? <div role="dialog">Kiosk</div> : null) }));

const log = { id: "l1", employee_id: "e1", integration_id: "i1", source_event_id: "s1", external_employee_id: "1-60482", attendance_date: "2026-10-11", time_in: "2026-10-10T16:49:00Z", time_out: null, status: "incomplete", import_id: null, capture_method: "face_recognition", sync_metadata: { mode: "kiosk" }, created_at: "2026-10-11T00:00:00Z", employee: { id: "e1", employee_number: "1-60482", first_name: "Maria Cristina", last_name: "Balneg", ranks: { code: "PMAJ" }, departments: { name: "Admin Division" } }, attendance_imports: null };
const useHrAttendanceLogs = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-attendance-integration", () => ({ useHrAttendanceLogs }));

import { StaffAttendance } from "./staff-attendance";

describe("StaffAttendance (attendance.html)", () => {
  beforeEach(() => {
    mocks.params = new URLSearchParams();
    useHrAttendanceLogs.mockReturnValue({ isLoading: false, error: null, data: { rows: [log], count: 1 } });
    vi.spyOn(window.history, "replaceState").mockImplementation((_state, _unused, url) => mocks.replace(url, { scroll: false }));
  });
  afterEach(() => mocks.replace.mockReset());

  it("shows the toolbar links and the kiosk launcher, without a Kiosk page link", () => {
    render(<StaffAttendance />);
    expect(screen.getByRole("heading", { level: 1, name: "Attendance Logs" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search attendance logs" })).toHaveAttribute("placeholder", "Search name, badge no. or external ID...");
    expect(screen.getByRole("link", { name: /Import Attendance/ })).toHaveAttribute("href", "/hr/attendance/import");
    expect(screen.getByRole("link", { name: /Face Registration/ })).toHaveAttribute("href", "/hr/attendance/face-enrollment");
    expect(screen.getByRole("link", { name: /Unmatched IDs/ })).toHaveAttribute("href", "/hr/attendance/unmatched");
    expect(screen.queryByRole("link", { name: /kiosk/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Launch Attendance Kiosk/ })).toBeInTheDocument();
  });

  it("lists logs with 24-hour times, Partial status and the source", async () => {
    render(<StaffAttendance />);
    const row = screen.getByRole("link", { name: "Maria Cristina Balneg" }).closest("tr")!;
    expect(within(row).getByText("October 11, 2026")).toBeInTheDocument();
    expect(within(row).getByText("00:49")).toBeInTheDocument();
    expect(within(row).getAllByText("—")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Duration" })).toBeInTheDocument();
    expect(within(row).getByText("Partial")).toBeInTheDocument();
    expect(within(row).getByText("Face scan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Maria Cristina Balneg" })).toHaveAttribute("href", "/hr/employees/e1");
    await userEvent.click(within(row).getByRole("button", { name: "View attendance for Maria Cristina Balneg, October 11, 2026" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/attendance?view=l1", { scroll: false });
    expect(within(screen.getByRole("combobox", { name: "Attendance status" })).getByRole("option", { name: "Absent" })).toBeInTheDocument();
  });

  it("searches every page on the server once typing pauses and keeps the search in the URL", async () => {
    const user = userEvent.setup();
    render(<StaffAttendance />);
    await user.type(screen.getByRole("searchbox", { name: "Search attendance logs" }), "maria balneg");
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/hr/attendance?q=maria+balneg", { scroll: false }));
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it("restores search, status and page from the URL and sends them to the server", () => {
    mocks.params = new URLSearchParams("q=balneg&status=late&page=2");
    render(<StaffAttendance />);
    expect(useHrAttendanceLogs).toHaveBeenLastCalledWith({ page: 2, pageSize: 10, status: "late", search: "balneg" });
    expect(screen.getByRole("searchbox", { name: "Search attendance logs" })).toHaveValue("balneg");
  });

  it("opens the record view and the kiosk from the URL", () => {
    mocks.params = new URLSearchParams("view=l1&kiosk=1");
    render(<StaffAttendance />);
    expect(screen.getByText("Record l1")).toBeInTheDocument();
    expect(screen.getByText("Kiosk")).toBeInTheDocument();
  });
});
