import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteEntry: vi.fn(),
  saveEntry: vi.fn(),
  documentUrl: vi.fn(),
  impact: vi.fn(),
  useEmployee: vi.fn(),
  useEntries: vi.fn(),
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/hr/employees/00000000-0000-4000-8000-000000000010",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/hooks/use-deletion", () => ({
  useDeletionImpact: (_type: string, id: string | null) => ({ data: id ? mocks.impact() : undefined, isLoading: false, error: null, refetch: vi.fn() }),
  useDeleteRecord: () => ({ isPending: false, mutateAsync: mocks.deleteEntry, reset: vi.fn(), error: null }),
}));

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployee: mocks.useEmployee,
  useEmployeeProfilePhotoUrl: () => ({ data: null }),
  useRemoveMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePersonnelEntries: mocks.useEntries,
  useSavePersonnelEntry: () => ({ isPending: false, mutateAsync: mocks.saveEntry }),
  useUnitStations: () => ({ data: [{ id: 1, name: "San Juan Police Station", is_active: true }], error: null }),
}));
vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({ data: [], isLoading: false, error: null }),
  useRankOptions: () => ({ data: [{ id: 9, name: "Police Corporal", code: "PCPL", sort_order: 3, is_active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }], isLoading: false, error: null }),
}));
vi.mock("./employee-editor", () => ({ EmployeeEditor: () => <div>Employee editor</div> }));

vi.mock("@/queries/personnel-records", () => ({ getPersonnelDocumentUrl: mocks.documentUrl }));

import { EmployeeRecordDetail } from "./employee-record-detail";

const employeeId = "00000000-0000-4000-8000-000000000010";

describe("EmployeeRecordDetail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.search = "tab=certifications";
    mocks.deleteEntry.mockResolvedValue(undefined);
    mocks.impact.mockReturnValue({ entityType: "certification", entityId: "00000000-0000-4000-8000-000000000020", label: "Leadership and Management Course", canDelete: true, canForce: false, blockers: [], reasons: [], removes: [], alternative: null });
    mocks.useEmployee.mockReturnValue({ data: { id: employeeId, first_name: "Ada", last_name: "Dela Cruz", employee_number: "PAT-001", employment_status: "active", date_of_birth: "1990-09-23", gender: "female", place_of_birth: "Quezon City", phone: "+639171234567", employment_started_on: "2024-01-01" }, isLoading: false });
    mocks.useEntries.mockImplementation((kind: string) => ({
      data: kind === "certification" ? [{
        id: "00000000-0000-4000-8000-000000000020",
        employee_id: employeeId,
        name: "Leadership and Management Course",
        issuer: null,
        credential_id: null,
        issued_on: "2026-01-01",
        expires_on: null,
        notes: "Top of the class",
      }] : [],
      isLoading: false,
    }));
  });

  it("updates a certification / training instead of deleting it", async () => {
    const user = userEvent.setup();
    mocks.search = "tab=certifications&mode=edit";
    mocks.saveEntry.mockResolvedValue({});
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Update certification / training Leadership and Management Course" }));
    expect(screen.getAllByLabelText(/^Certification \/ Training/, { selector: "select" })[0]).toHaveValue("Leadership and Management Course");
    await user.click(screen.getByRole("button", { name: "Save certification / training" }));
    await waitFor(() => expect(mocks.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ id: "00000000-0000-4000-8000-000000000020" })));
  });

  it("shows the rank and assignment of each service history entry", async () => {
    mocks.search = "tab=service-history";
    mocks.useEntries.mockImplementation((kind: string) => ({
      data: kind === "serviceHistory" ? [{ id: "00000000-0000-4000-8000-000000000030", employee_id: employeeId, department_id: null, rank_id: 9, unit_station: "San Juan Police Station", employment_title: null, started_on: "2018-10-10", ended_on: "2019-10-10", notes: null }] : [],
      isLoading: false,
    }));
    render(<EmployeeRecordDetail employeeId={employeeId} />);
    expect(within(screen.getByRole("tabpanel")).getByText("PCPL — Police Corporal · San Juan Police Station")).toBeVisible();
  });

  it("shows only the section named in the URL and switches tabs through the URL", async () => {
    const user = userEvent.setup();
    mocks.search = "tab=qualifications";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByRole("tab", { name: "Eligibility" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Eligibility" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Service history" })).not.toBeInTheDocument();
    // Other panels stay mounted but hidden.
    expect(screen.getByRole("heading", { name: "Official record", hidden: true })).not.toBeVisible();
    expect(screen.getByRole("tab", { name: "Official record" })).toHaveAttribute("aria-controls", "rec-panel-official");
    expect(document.getElementById("rec-panel-official")).toHaveAttribute("hidden");

    expect(screen.queryByRole("tab", { name: "Training" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Certification \/ Training/ }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=certifications", { scroll: false });
  });

  it("shows a profile header, section counts, and a recent activity timeline in its own tab", () => {
    mocks.search = "tab=activity";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByRole("heading", { level: 1, name: "Ada Dela Cruz" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Employee summary" })).getByText("PAT-001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Promotion review" })).toHaveAttribute("href", `/hr/promotions/${employeeId}`);
    expect(screen.getByRole("tab", { name: /Certification \/ Training/ })).toHaveTextContent("Certification / Training1");
    const activity = screen.getByRole("region", { name: "Recent activity" });
    expect(activity).toHaveTextContent("Certification / Training");
    expect(activity).toHaveTextContent("Leadership and Management Course");
    expect(activity).toHaveTextContent("Top of the class");
    expect(screen.getByRole("tab", { name: "Recent activity" })).toHaveAttribute("aria-selected", "true");
    expect(document.getElementById("rec-panel-official")).toHaveAttribute("hidden");
  });

  it("opens the official record when Edit details is chosen", async () => {
    const user = userEvent.setup();
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=official&mode=edit", { scroll: false });
  });

  it("shows the official record as a read-only list in view mode", () => {
    mocks.search = "";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    const official = screen.getByRole("region", { name: "Official record" });
    expect(screen.queryByText("Employee editor")).not.toBeInTheDocument();
    expect(official.querySelectorAll("input, select, textarea")).toHaveLength(0);
    expect(official).toHaveTextContent("Place of birthQuezon City");
    expect(official).toHaveTextContent("Date of birthSeptember 23, 1990");
    expect(official).toHaveTextContent("Date Entered ServiceJanuary 1, 2024");
    expect(official).toHaveTextContent("Religion" + "Not provided");
    for (const section of ["I. Personal Information", "II. Emergency Contact", "III. Employment"]) {
      expect(within(official).getByRole("region", { name: section })).toBeInTheDocument();
    }
    expect(within(official).getByRole("region", { name: "III. Employment" })).toHaveTextContent("Unit / Section");
    expect(screen.getByText("Born").nextElementSibling).toHaveTextContent("September 23, 1990");
  });

  it("hides add, edit, and delete controls on every section in view mode", () => {
    mocks.search = "tab=certifications";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    const certifications = screen.getByRole("region", { name: "Certification / Training" });
    expect(certifications).toHaveTextContent("Completed January 1, 2026 · Top of the class");
    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add eligibility/i, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add service history/i, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add certification/i, hidden: true })).not.toBeInTheDocument();
  });

  it("makes every section editable in edit mode and returns to view mode", async () => {
    const user = userEvent.setup();
    mocks.search = "tab=official&mode=edit";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByText("Employee editor")).toBeVisible();
    expect(screen.getByRole("button", { name: /add certification \/ training/i, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add eligibility/i, hidden: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=official", { scroll: false });
    await user.click(screen.getByRole("button", { name: "Done editing" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=official", { scroll: false });
  });

  it("keeps edit mode when switching tabs", async () => {
    const user = userEvent.setup();
    mocks.search = "tab=official&mode=edit";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    await user.click(screen.getByRole("tab", { name: "Eligibility" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=qualifications&mode=edit", { scroll: false });
  });

  it.each([
    ["created", "Employee account has been saved."],
    ["edited", "Employee account has been edited successfully."],
  ])("confirms a %s employee with a success message", async (saved, message) => {
    const user = userEvent.setup();
    mocks.search = `tab=official&saved=${saved}`;
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByRole("status")).toHaveTextContent(message);
    await user.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/employees/00000000-0000-4000-8000-000000000010?tab=official", { scroll: false });
  });

  it("opens the official record by default and for an unknown tab", () => {
    mocks.search = "tab=nonsense";
    render(<EmployeeRecordDetail employeeId={employeeId} />);

    expect(screen.getByRole("tab", { name: "Official record" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Official record" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Eligibility" })).not.toBeInTheDocument();
  });
  it("opens an eligibility's supporting document", async () => {
    const user = userEvent.setup();
    mocks.search = "tab=qualifications";
    mocks.documentUrl.mockResolvedValue("https://example.test/csc.pdf");
    const open = vi.spyOn(window, "open").mockReturnValue({ opener: null, location: { href: "" }, close: vi.fn() } as unknown as Window);
    mocks.useEntries.mockImplementation((kind: string) => ({
      data: kind === "qualification" ? [{ id: "q1", employee_id: employeeId, name: "Civil Service Professional Examination", institution: null, qualification_level: null, field_of_study: null, awarded_on: "2015-12-10", notes: null, document_path: "qualifications/x/csc.pdf", document_name: "csc.pdf", document_mime_type: "application/pdf", document_size_bytes: 4 }] : [],
      isLoading: false,
    }));
    render(<EmployeeRecordDetail employeeId={employeeId} />);
    await user.click(screen.getByRole("button", { name: "View document csc.pdf" }));
    expect(mocks.documentUrl).toHaveBeenCalledWith("qualifications/x/csc.pdf");
    open.mockRestore();
  });
});
