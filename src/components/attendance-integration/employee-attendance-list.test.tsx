import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

type LogsResult = { isLoading: boolean; error: Error | null; data: { rows: unknown[]; count: number } | undefined };
const logs = vi.hoisted(() => ({ value: { isLoading: false, error: null, data: { rows: [], count: 0 } } as LogsResult, calls: [] as unknown[] }));
vi.mock("@/hooks/use-attendance-integration", () => ({ useMyAttendanceLogs: (input: unknown) => { logs.calls.push(input); return logs.value; } }));

import { EmployeeAttendanceHeader, EmployeeAttendanceList } from "./employee-attendance-list";

const row = (id: string, status: string, timeIn: string | null, timeOut: string | null, date = "2026-10-02") => ({ id, attendance_date: date, status, time_in: timeIn, time_out: timeOut, capture_method: "face_recognition" });

beforeEach(() => { logs.calls = []; logs.value = { isLoading: false, error: null, data: { rows: [], count: 0 } }; });

describe("EmployeeAttendanceList", () => {
  it("shows the Attendance Logs card with dates in words, 24h times and text status pills", () => {
    logs.value = { isLoading: false, error: null, data: { count: 4, rows: [
      row("1", "late", "2026-10-02T10:58:00Z", "2026-10-02T11:12:00Z"),
      row("2", "present", "2026-10-03T00:00:00Z", "2026-10-03T09:00:00Z", "2026-10-03"),
      row("3", "incomplete", "2026-10-04T00:00:00Z", null, "2026-10-04"),
      row("4", "absent", null, null, "2026-10-05"),
    ] } };
    render(<EmployeeAttendanceList />);
    expect(screen.getByText("Attendance Logs")).toBeVisible();
    expect(screen.getByText("October 2, 2026")).toBeVisible();
    for (const label of ["Late", "Present", "Partial", "Absent"]) expect(screen.getByText(label)).toBeVisible();
    const first = screen.getByText("October 2, 2026").closest("article") as HTMLElement;
    expect(within(first).getByText("18:58")).toBeVisible();
    expect(within(first).getByText("19:12")).toBeVisible();
    expect(screen.getByText("Showing 1–4 of 4 attendance records")).toBeVisible();
  });

  it("shows no empty state or pager while loading", () => {
    logs.value = { isLoading: true, error: null, data: undefined };
    render(<EmployeeAttendanceList />);
    expect(screen.queryByText(/no attendance records/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();
  });

  it("shows the query error instead of an empty state or pager", () => {
    logs.value = { isLoading: false, error: new Error("boom"), data: undefined };
    render(<EmployeeAttendanceList />);
    expect(screen.getByText("boom")).toBeVisible();
    expect(screen.queryByText(/no attendance records/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();
  });

  it("shows a direct empty state when there are no logs", () => {
    render(<EmployeeAttendanceList />);
    expect(screen.getByText("No attendance records are available.")).toBeVisible();
  });

  it("pages through logs", async () => {
    logs.value = { isLoading: false, error: null, data: { count: 25, rows: [row("1", "present", null, null)] } };
    render(<EmployeeAttendanceList />);
    await userEvent.setup().click(screen.getByRole("button", { name: /next/i }));
    expect(logs.calls.at(-1)).toMatchObject({ page: 2, pageSize: 10 });
  });
});

describe("EmployeeAttendanceHeader", () => {
  it("shows the monitoring label, title and today's date in words", () => {
    render(<EmployeeAttendanceHeader />);
    expect(screen.getByRole("heading", { name: "My Attendance" })).toBeVisible();
    expect(screen.getByText("Personnel Monitoring")).toBeVisible();
    expect(screen.getByText(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/)).toBeVisible();
  });
});
