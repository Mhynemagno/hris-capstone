import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn(), useEmployeeForCurrentUser: vi.fn(), usePersonnelEntries: vi.fn() }));
vi.mock("@/hooks/use-profile-change-requests", () => ({ useSubmitProfileChangeRequest: () => ({ isPending: false, mutateAsync: mocks.mutateAsync }) }));
vi.mock("@/hooks/use-personnel-records", () => ({ useEmployeeForCurrentUser: mocks.useEmployeeForCurrentUser, usePersonnelEntries: mocks.usePersonnelEntries }));
import { ProfileChangeRequestForm } from "./profile-change-request-form";

describe("ProfileChangeRequestForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.useEmployeeForCurrentUser.mockReturnValue({ isLoading: false, data: { id: "00000000-0000-4000-8000-000000000201", personal_email: "employee@example.test", phone: null, address: null, emergency_contact_name: null, emergency_contact_phone: null } });
    mocks.usePersonnelEntries.mockReturnValue({ data: [] });
  });

  it("adds an eligibility proposal and submits it for approval", async () => {
    const user = userEvent.setup();
    render(<ProfileChangeRequestForm />);
    await user.selectOptions(screen.getByLabelText(/^Eligibility/), "Licensed Criminologist (RA 6506)");
    await user.type(screen.getByLabelText(/Date obtained/), "2024-06-01");
    await user.click(screen.getByRole("button", { name: "Add proposal to request" }));
    expect(screen.getByRole("list", { name: "Eligibility proposals" })).toHaveTextContent("Licensed Criminologist (RA 6506)");
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ changes: [expect.objectContaining({ kind: "qualification", operation: "add", requestedValue: expect.objectContaining({ name: "Licensed Criminologist (RA 6506)", institution: null, qualificationLevel: null, fieldOfStudy: null }) })] }) })));
  }, 10_000);

  it("requires at least one proposed change", async () => {
    const user = userEvent.setup();
    render(<ProfileChangeRequestForm />);
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Change at least one contact field or add an eligibility proposal.");
  });

  it("asks only for the eligibility, date, and remarks, and keeps saved details when editing", async () => {
    mocks.usePersonnelEntries.mockReturnValue({ data: [{ id: "00000000-0000-4000-8000-000000000301", name: "Police Academy Diploma", institution: "Law Enforcement University", qualification_level: "Police Academy", field_of_study: null, awarded_on: "2019-06-01", notes: null }] });
    const user = userEvent.setup();
    render(<ProfileChangeRequestForm />);
    expect(screen.queryByLabelText(/Institution/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Qualification level/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Field of study/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Remarks")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Requested action"), "edit");
    await user.selectOptions(screen.getByLabelText(/Existing eligibility/), "00000000-0000-4000-8000-000000000301");
    // A saved name that is no longer listed stays selectable.
    expect(screen.getByLabelText(/^Eligibility/)).toHaveValue("Police Academy Diploma");
    await user.click(screen.getByRole("button", { name: "Add proposal to request" }));
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ changes: [expect.objectContaining({ operation: "edit", originalValue: expect.objectContaining({ institution: "Law Enforcement University", qualificationLevel: "Police Academy" }) })] }) })));
  }, 10_000);

  it("shows inline errors for incomplete eligibility proposals", async () => {
    const user = userEvent.setup();
    render(<ProfileChangeRequestForm />);
    await user.click(screen.getByRole("button", { name: "Add proposal to request" }));

    expect(screen.getByText("Select an eligibility.")).toBeVisible();
    expect(screen.getByLabelText(/^Eligibility/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter the date the eligibility was obtained.")).toBeVisible();
  });

  it("shows only supported contact and emergency-contact fields", () => {
    render(<ProfileChangeRequestForm />);

    expect(screen.queryByLabelText("Address")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Personal email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.getByLabelText("Emergency contact name")).toBeInTheDocument();
    expect(screen.getByLabelText("Emergency contact phone number")).toBeInTheDocument();
  });
});
