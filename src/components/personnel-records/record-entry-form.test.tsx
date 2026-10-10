import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordEntryForm } from "./record-entry-form";

vi.mock("@/hooks/use-personnel-records", () => ({
  useUnitStations: () => ({ data: [{ id: 1, name: "San Juan Police Station", is_active: true }], error: null }),
}));

const stamp = { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({
    data: [{ id: 3, name: "Operations", is_active: true, ...stamp }, { id: 4, name: "Records", is_active: true, ...stamp }],
    isLoading: false,
    error: null,
  }),
  useRankOptions: () => ({
    data: [
      { id: 7, name: "Patrolman / Patrolwoman", code: "PAT", sort_order: 1, is_active: true, ...stamp },
      { id: 9, name: "Police Corporal", code: "PCPL", sort_order: 2, is_active: true, ...stamp },
    ],
    isLoading: false,
    error: null,
  }),
}));

const employeeId = "00000000-0000-4000-8000-000000000010";
const training = {
  id: "00000000-0000-4000-8000-000000000020",
  employee_id: employeeId,
  course_name: "Leadership Development",
  provider: "Police Academy",
  completed_on: "2026-01-01",
  expires_on: null,
  hours: 16,
  notes: "Initial qualification",
};

describe("RecordEntryForm", () => {
  it("edits an existing training record with its current values", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<RecordEntryForm employeeId={employeeId} kind="training" onSaved={onSaved} training={training} />);

    expect(screen.getByLabelText(/^course name/i)).toHaveValue("Leadership Development");
    expect(screen.getByLabelText("Remarks")).toHaveValue("Initial qualification");
    await user.clear(screen.getByLabelText("Remarks"));
    await user.type(screen.getByLabelText("Remarks"), "Updated qualification");
    await user.click(screen.getByRole("button", { name: "Save training" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      courseName: "Leadership Development",
      notes: "Updated qualification",
    }), training.id));
  });

  it("records service history with a unit / section, a rank, and remarks", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<RecordEntryForm employeeId={employeeId} kind="serviceHistory" onSaved={onSaved} />);

    await user.selectOptions(screen.getByLabelText(/^Unit \/ Section/), "4");
    expect(screen.getByRole("option", { name: "PAT — Patrolman / Patrolwoman" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Rank/), "9");
    await user.type(screen.getByLabelText(/start date/i), "2025-01-01");
    expect(screen.getByLabelText(/end date/i)).toHaveAttribute("min", "2025-01-01");
    await user.type(screen.getByLabelText("Remarks"), "Transferred");
    await user.click(screen.getByRole("button", { name: "Add service history" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      departmentId: 4,
      rankId: 9,
      notes: "Transferred",
      startedOn: "2025-01-01",
    }), undefined));
    expect(onSaved.mock.calls[0]![0]).not.toHaveProperty("employmentTitle");
    expect(screen.queryByLabelText(/employment title/i)).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Service history added.");
  });

  it("requires a unit / section and a rank for service history but not an end date", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<RecordEntryForm employeeId={employeeId} kind="serviceHistory" onSaved={onSaved} />);

    await user.type(screen.getByLabelText(/start date/i), "2025-01-01");
    await user.click(screen.getByRole("button", { name: "Add service history" }));

    expect(await screen.findByText("Choose a unit / section.")).toBeInTheDocument();
    expect(screen.getByText("Choose a rank.")).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).not.toBeRequired();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("records a certification / training with a completion date and optional remarks only", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<RecordEntryForm employeeId={employeeId} kind="certification" onSaved={onSaved} />);

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Select a certification / training",
      "Criminal Investigation Course",
      "Police Intelligence Operations Course",
      "Drug Enforcement Operations Course",
      "Leadership and Management Course",
      "Senior Police Leadership and Command Course",
    ]);
    expect(screen.queryByLabelText(/issuer/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/expiry date/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^certification \/ training/i), "Criminal Investigation Course");
    await user.type(screen.getByLabelText(/completion date/i), "2025-05-01");
    await user.click(screen.getByRole("button", { name: "Add certification / training" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      name: "Criminal Investigation Course",
      issuedOn: "2025-05-01",
    }), undefined));
  });

  it("records eligibility from the listed choices without institution, level, or field of study", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<RecordEntryForm employeeId={employeeId} kind="qualification" onSaved={onSaved} />);

    expect(screen.getByRole("option", { name: "NAPOLCOM PNP Entrance Examination" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Philippine National Police Academy (PNPA)" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/institution/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/qualification level/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/field of study/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add eligibility" }));
    expect(screen.getByText("Select an eligibility.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^eligibility/i), "Licensed Criminologist (RA 6506)");
    await user.type(screen.getByLabelText(/date awarded/i), "2024-03-01");
    await user.click(screen.getByRole("button", { name: "Add eligibility" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      name: "Licensed Criminologist (RA 6506)",
      awardedOn: "2024-03-01",
    }), undefined));
  });

  it("offers PNP credentials as dropdowns and asks for a choice when none is made", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<RecordEntryForm employeeId={employeeId} kind="training" onSaved={onSaved} />);

    expect(screen.getByLabelText(/^course name/i)).toHaveRole("combobox");
    expect(screen.getByRole("option", { name: "Public Safety Basic Recruit Course (PSBRC)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "National Police Training Institute (NPTI)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add training" }));

    expect(screen.getByText("Select a course name.")).toBeInTheDocument();
    expect(screen.getByText("Select a provider.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("keeps the fields the form does not show when a record is updated", async () => {
    const user = userEvent.setup();
    const employeeId = "00000000-0000-4000-8000-000000000010";
    const onCertification = vi.fn();
    const { unmount } = render(<RecordEntryForm certification={{ id: "00000000-0000-4000-8000-000000000020", employee_id: employeeId, name: "Criminal Investigation Course", issuer: "PNP Training Service", credential_id: "CIC-1", issued_on: "2020-01-01", expires_on: "2025-01-01", notes: null } as never} employeeId={employeeId} kind="certification" onSaved={onCertification} />);
    await user.click(screen.getByRole("button", { name: "Save certification / training" }));
    await waitFor(() => expect(onCertification).toHaveBeenCalledWith(expect.objectContaining({ issuer: "PNP Training Service", credentialId: "CIC-1", expiresOn: "2025-01-01" }), "00000000-0000-4000-8000-000000000020"));
    unmount();

    const onQualification = vi.fn();
    const { unmount: unmountQualification } = render(<RecordEntryForm employeeId={employeeId} kind="qualification" onSaved={onQualification} qualification={{ id: "00000000-0000-4000-8000-000000000021", employee_id: employeeId, name: "Civil Service Professional Examination", institution: "CSC", qualification_level: "Bachelor's Degree", field_of_study: "Criminology", awarded_on: "2015-12-10", notes: null } as never} />);
    await user.click(screen.getByRole("button", { name: "Save eligibility" }));
    await waitFor(() => expect(onQualification).toHaveBeenCalledWith(expect.objectContaining({ institution: "CSC", qualificationLevel: "Bachelor's Degree", fieldOfStudy: "Criminology" }), "00000000-0000-4000-8000-000000000021"));
    unmountQualification();

    const onService = vi.fn();
    render(<RecordEntryForm employeeId={employeeId} kind="serviceHistory" onSaved={onService} serviceHistory={{ id: "00000000-0000-4000-8000-000000000022", employee_id: employeeId, department_id: 3, rank_id: 7, unit_station: null, employment_title: "Desk officer", started_on: "2017-10-10", ended_on: null, notes: null }} />);
    await user.click(screen.getByRole("button", { name: "Save service history" }));
    await waitFor(() => expect(onService).toHaveBeenCalledWith(expect.objectContaining({ employmentTitle: "Desk officer" }), "00000000-0000-4000-8000-000000000022"));
  });
});
