import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/hr/attendance",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-attendance-integration", () => ({
  useHrAttendanceLogs: () => ({
    isLoading: false,
    error: null,
    data: {
      count: 1,
      rows: [{
        id: "log-1", employee_id: "00000000-0000-4000-8000-000000000111", integration_id: "i1", source_event_id: "s1",
        external_employee_id: "1-60482", attendance_date: "2026-10-09", time_in: "2026-10-09T00:00:00Z", time_out: null, status: "incomplete",
        import_id: null, capture_method: "face_recognition", sync_metadata: {}, created_at: "2026-10-09T00:00:00Z",
        employee: { id: "00000000-0000-4000-8000-000000000111", employee_number: "1-60482", first_name: "Maria", last_name: "Balneg" },
      }],
    },
  }),
}));

import { HrAttendanceDirectory } from "./hr-attendance-directory";

describe("HrAttendanceDirectory", () => {
  it("names each employee and links to their details", () => {
    render(<HrAttendanceDirectory />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeVisible();
    expect(screen.getByText("Maria Balneg", { selector: "span.font-medium" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View Maria Balneg" })).toHaveAttribute("href", "/hr/employees/00000000-0000-4000-8000-000000000111");
  });
});
