import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AttendanceRecordModal } from "./attendance-record-modal";

const base = { id: "l1", employee_id: "e1", integration_id: "i1", source_event_id: "s1", external_employee_id: "1-60482", attendance_date: "2026-10-11", time_in: "2026-10-10T16:49:00Z", time_out: null, status: "incomplete", created_at: "2026-10-11T00:00:00Z", employee: { id: "e1", employee_number: "1-60482", first_name: "Maria Cristina", last_name: "Balneg", ranks: { code: "PMAJ" }, departments: { name: "Admin Division" } } };

describe("AttendanceRecordModal (attendance.html View)", () => {
  it("shows a face scan record without inventing a match score", () => {
    render(<AttendanceRecordModal log={{ ...base, import_id: null, capture_method: "face_recognition", sync_metadata: { mode: "kiosk" }, attendance_imports: null } as never} missing={false} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Employee Attendance Record" })).toBeInTheDocument();
    expect(screen.getByText("Rank: PMAJ • Badge / ID: 1-60482")).toBeInTheDocument();
    expect(screen.getByText("San Juan City Police Station — Admin Division")).toBeInTheDocument();
    expect(screen.getByText("Face Scan Biometrics")).toBeInTheDocument();
    expect(screen.getByText("Scan Mode:")).toBeInTheDocument();
    expect(screen.getByText("00:49 (AM)")).toBeInTheDocument();
    expect(screen.getByText("Worked Duration")).toBeInTheDocument();
    expect(screen.queryByText(/Facial Match Score/)).not.toBeInTheDocument();
    expect(screen.getByText("Close", { selector: "button" })).toBeInTheDocument();
    expect(screen.queryByText("Close Window")).not.toBeInTheDocument();
  });

  it("shows the import file for an imported record", () => {
    render(<AttendanceRecordModal log={{ ...base, import_id: "imp1", capture_method: "import", sync_metadata: {}, attendance_imports: { source_filename: "dtr-oct.csv" } } as never} missing={false} onClose={vi.fn()} />);
    expect(screen.getByText("Imported File")).toBeInTheDocument();
    expect(screen.getByText("dtr-oct.csv")).toBeInTheDocument();
  });

  it("says when the record cannot be found", () => {
    render(<AttendanceRecordModal log={null} missing onClose={vi.fn()} />);
    expect(screen.getByText("This attendance record could not be found.")).toBeInTheDocument();
  });
});
